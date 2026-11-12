import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { step } from "../core/world/move";
import { findPath, findPathVia, followPath } from "../core/world/autowalk";
import { nearest } from "../core/world/nearby";
import type { Bounds, Collider, Vec2 } from "../core/world/types";
import { translations } from "../content";
import { DreamEffects } from "./dream-effects";
import { Nature } from "./nature";
import { LightRig } from "./light-rig";
import { dialogueFocus } from "./feedback";
import type { MokaView } from "../core/moka-errand";
import { MokaProps } from "./moka-props";
import { ResidentProps } from "./resident-props";
import type { lumiView } from "../core/lumi-errand";
import type { echoView } from "../core/echo-errand";
import type { orView } from "../core/or-errand";
import quest from "../../../content/quests/moka-errand.json";
import { Demi, whitenPlayer, type DemiMode } from "./demi";
import { SpringBones } from "./spring-bones";
import { assetUrl } from "../asset-url";

type Placement = Vec2 & { asset: string; rot?: number; scale?: number; zone?: string };
type MapData = { spawn: Vec2; terrain: Placement; bounds: Bounds; zones: Record<string, Vec2>; actors: (Placement & { id: string })[]; props: (Placement & { id: string })[] };
type Asset = { path: string; scale: number; collision: Collider[]; clips?: string[] };
const map = import.meta.glob<{ default: MapData }>("../../../content/world/village.json", { eager: true })["../../../content/world/village.json"]!.default;
const manifest = import.meta.glob<{ default: { assets: Record<string, Asset> } }>("../../../content/assets/manifest.json", { eager: true })["../../../content/assets/manifest.json"]!.default.assets;
// 24px keeps the neutral symbol legible on a mobile screen while staying within the policy range.
const MARKER_SIZE_PX = 24;

// Errand walk-ons stand on zones, not in the map's actor list, so their models are named here.
const WALK_ON_ASSET: Record<string, string> = { "lumi-neighbor-1": "resident-villager-a", "lumi-neighbor-2": "resident-villager-b", "echo-borrower": "resident-villager-b", "or-fisher": "resident-fisher", "or-merchant": "resident-merchant" };

type Character = { object: THREE.Object3D; mixer: THREE.AnimationMixer; springs: SpringBones; actions: Map<string, THREE.AnimationAction>; current?: string };

export class Village {
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera();
  private lights = new LightRig(this.scene);
  private renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  private effects?: DreamEffects;
  private nature = new Nature(this.scene, { props: map.props, zones: map.zones, lake: map.bounds.holes[0] });
  private loader = new GLTFLoader();
  private models = new Map<string, Promise<GLTF>>();
  private actors = new Map<string, { object: THREE.Group; marker: THREE.Sprite; character?: Character }>();
  private props = new Map<string, Placement & { id: string }>();
  private propObjects = new Map<string, THREE.Object3D>();
  private characters: Character[] = [];
  private player = new THREE.Group();
  private demi = new Demi(map.spawn);
  private demiMode: DemiMode = "hidden";
  private demiPath?: { path: Vec2[]; target: Vec2; best: number; stalled: number };
  private postman = new THREE.Group();
  private cameraTarget = new THREE.Vector3();
  private viewHalfHeight = 1.55;
  private cameraHalfHeight = 1.55;
  private viewAspect = 1;
  private playerCharacter?: Character;
  private enabled = false;
  private input: Vec2 = { x: 0, z: 0 };
  private colliders: Collider[] = [];
  private colliderOwners: (string | undefined)[] = [];
  private nearby: string | null = null;
  private talking?: string;
  private speaker: string | null = null;
  private available = new Set<string>();
  private mokaView: MokaView | null = null;
  private mokaProps?: MokaProps;
  private mokaLoading?: Promise<void>;
  public lumiView: ReturnType<typeof lumiView> | null = null;
  public echoView: ReturnType<typeof echoView> | null = null;
  public orView: ReturnType<typeof orView> | null = null;
  private residentProps: Partial<Record<"lumi" | "echo" | "or", ResidentProps>> = {};
  private residentLoading: Partial<Record<"lumi" | "echo" | "or", Promise<void>>> = {};
  private ready = false;
  readonly whenReady: Promise<void>;
  private auto?: { id: string; path: Vec2[]; best: number; stalled: number };
  private nearbyMarker = this.ring("#BFE3F2", .38);
  private tapMarker = this.ring("#F4A7B9", .8);
  private destinationMarker = this.ring("#FFF6E9", .55);
  private tapTime = 0;
  private tapScale = 1;
  private portrait = false;
  onNearbyChange: (target: { id: string; available: boolean; examine?: boolean } | null) => void = () => {};
  private lastTime = 0;
  private frame = 0;
  onInteract: (id: string) => void = () => {};
  onPathBlocked: () => void = () => {};

  constructor(app: HTMLElement) {
    performance.mark("village:start");
    if (import.meta.env.DEV) Object.assign(this, { teleport: (x: number, z: number) => { this.player.position.set(x, 0, z); this.cameraTarget.copy(this.player.position); } });
    const draco = new DRACOLoader();
    draco.setDecoderPath(`${import.meta.env.BASE_URL}assets/abraxas/decoders/`); draco.setWorkerLimit(1); this.loader.setDRACOLoader(draco);
    this.scene.fog = new THREE.Fog("#eae3f7", 19, 40);
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.domElement.style.background = "linear-gradient(to bottom, #eae3f7 0%, #d8d0f0 38%, #f3d5c5 72%, #94d2cb 100%)";
    app.append(this.renderer.domElement);
    this.effects = new DreamEffects(this.scene, map.props, map.zones.lake);
    const loading: Promise<unknown>[] = [this.ground()];
    this.scene.add(this.nearbyMarker, this.tapMarker, this.destinationMarker);
    this.player.position.set(map.spawn.x, 0, map.spawn.z); this.cameraTarget.copy(this.player.position); this.scene.add(this.player, this.demi.object, this.postman);
    this.postman.visible = false;
    this.postman.position.set(map.spawn.x - .8, 0, map.spawn.z - .8);
    loading.push(this.character("resident-postman", this.postman));
    loading.push(this.character("player", this.player).then(character => { this.playerCharacter = character; }));
    const scenery: typeof map.props = [];
    for (const prop of map.props) {
      if (/^(moka|lumi|echo|or)-/.test(prop.id)) continue;
      if (prop.id.startsWith("nature-")) { this.addColliders(prop, prop.id); scenery.push(prop); continue; }
      const register = () => { this.addColliders(prop, prop.id); if (translations("ko").examine[prop.zone ? `${prop.asset}.${prop.zone}` : prop.asset]) this.props.set(prop.id, prop); };
      if (prop.asset === "signboard") loading.push(this.place(prop).then(object => { this.propObjects.set(prop.id, object); register(); }).catch(error => console.warn(`Village prop failed to load: ${prop.id}`, error)));
      else { register(); loading.push(this.place(prop).then(object => { this.propObjects.set(prop.id, object); })); }
    }
    loading.push(this.nature.scenery(scenery, async asset => ({ scene: (await this.load(asset)).scene, scale: manifest[asset]!.scale })));
    for (const actor of map.actors) {
      this.addColliders(actor, actor.id);
      const object = new THREE.Group(); object.position.set(actor.x, 0, actor.z); object.userData.id = actor.id;
      const marker = this.label(); object.add(marker); this.scene.add(object);
      const entry = { object, marker, character: undefined as Character | undefined }; this.actors.set(actor.id, entry);
      loading.push(this.character(actor.asset, object).then(character => { entry.character = character; }));
    }
    for (const id of ["lake", "plaza", "gate"]) {
      const position = map.zones[id]; if (!position) continue;
      const object = new THREE.Group(); object.position.set(position.x, 0, position.z); object.userData.id = id;
      const marker = this.label(); object.add(marker); this.scene.add(object); this.actors.set(id, { object, marker });
    }
    let pointer: { id: number; x: number; y: number } | undefined;
    this.renderer.domElement.addEventListener("pointerdown", event => { if (pointer) { pointer = undefined; return; } pointer = { id: event.pointerId, x: event.clientX, y: event.clientY }; });
    this.renderer.domElement.addEventListener("pointercancel", () => { pointer = undefined; });
    this.renderer.domElement.addEventListener("pointerup", event => { if (pointer?.id === event.pointerId && Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) < 14) { const id = this.hitTargetAt(event.clientX, event.clientY); if (id) this.interactTarget(id); } pointer = undefined; });
    this.resize();
    const modelsReady = Promise.all(loading).then(() => { performance.mark("village:models-ready"); });
    const effectsReady = this.effects.whenReady.then(() => { performance.mark("village:effects-ready"); });
    this.whenReady = Promise.all([modelsReady, effectsReady]).then(async () => {
      this.updateCamera(0, true);
      this.effects?.update(0, this.player.position, this.camera);
      await this.renderer.compileAsync(this.scene, this.camera);
      performance.mark("village:compiled");
      this.renderer.render(this.scene, this.camera);
      performance.mark("village:first-render");
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      this.ready = true;
      performance.mark("village:ready");
      performance.measure("village:prepare", "village:start", "village:ready");
    }).catch(error => {
      console.error("Village assets failed to load", error); this.enabled = false;
      const message = document.createElement("div"); message.textContent = "마을을 불러오지 못했어요. 새로고침해 주세요."; message.setAttribute("role", "alert"); Object.assign(message.style, { position: "fixed", inset: "0", display: "grid", placeItems: "center", background: "#fff8ec", color: "#3b2a22", zIndex: "1000" }); app.append(message);
      throw error;
    });
    window.addEventListener("abraxas:viewport", (event: Event) => { this.portrait = !!(event as CustomEvent<{ portrait: boolean }>).detail?.portrait; if (this.portrait) { this.input = { x: 0, z: 0 }; this.auto = undefined; } this.resize(); });
    document.addEventListener("visibilitychange", () => {
      cancelAnimationFrame(this.frame);
      if (!document.hidden) { this.lastTime = 0; this.frame = requestAnimationFrame(() => this.tick()); }
    });
    if (!document.hidden) this.frame = requestAnimationFrame(() => this.tick());
  }
  setEnabled(value: boolean): void { this.enabled = value; if (value) { this.talking = undefined; this.speaker = null; } else { this.auto = undefined; this.input = { x: 0, z: 0 }; this.nearby = null; this.onNearbyChange(null); } this.setAvailable([...this.available]); }
  setDemiMode(mode: DemiMode): void {
    if (mode === this.demiMode) return;
    if (mode === "follow") this.demi.reset(this.player.position);
    this.demiMode = mode; this.demi.setMode(mode, this.player.position); this.demiPath = undefined;
    if (mode === "lead" || mode === "ending") {
      const target = { x: this.player.position.x - 1.5, z: this.player.position.z - 1.5 };
      const path = findPath(this.demi.object.position, target, this.colliders, map.bounds);
      if (path?.length) this.demiPath = { path, target, best: Infinity, stalled: 0 };
    }
  }
  setStoryScene(scene: "entrance" | "hub" | "interlude" | "festival" | "gate" | "confession" | "ending"): void {
    const wasGathered = this.gathered;
    this.gathered = scene === "confession" || scene === "ending";
    this.postman.visible = scene === "entrance";
    this.positionResidents();
    const spot = map.zones["ending-player"];
    if (this.gathered && !wasGathered && spot) { this.player.position.set(spot.x, 0, spot.z); this.cameraTarget.copy(this.player.position); }
  }
  focusSpeaker(id: string | null): void { this.speaker = id && this.target(id) ? id : null; this.setAvailable([...this.available]); }
  targetScreenPos(id: string): { x: number; y: number; onScreen: boolean } | null {
    const target = this.target(id); if (!target) return null;
    const point = new THREE.Vector3(target.x, 0, target.z).project(this.camera);
    const rect = this.renderer.domElement.getBoundingClientRect();
    return { x: rect.left + (point.x + 1) * rect.width / 2, y: rect.top + (1 - point.y) * rect.height / 2, onScreen: Math.abs(point.x) <= 1 && Math.abs(point.y) <= 1 && Math.abs(point.z) <= 1 };
  }
  setAvailable(ids: string[]): void { this.available = new Set(ids); for (const [id, actor] of this.actors) actor.marker.visible = this.available.has(id) && (this.enabled || id !== this.speaker); }
  setMokaView(view: MokaView | null): void {
    this.mokaView = view;
    this.auto = undefined;
    this.positionResidents();
    const guide = this.actors.get("v1j2");
    const originalGuide = map.actors.find(actor => actor.id === "v1j2");
    if (guide && originalGuide) {
      const point = view && view.phase !== "locked" && view.phase !== "completed" ? map.zones["moka-guide"]! : originalGuide;
      guide.object.position.set(point.x, 0, point.z);
      this.colliders = this.colliders.filter((_, index) => this.colliderOwners[index] !== "v1j2");
      this.colliderOwners = this.colliderOwners.filter(owner => owner !== "v1j2");
      this.addColliders({ ...originalGuide, ...point }, "v1j2");
    }
    for (const prop of map.props) if (prop.id.startsWith("moka-")) this.props.delete(prop.id);
    this.mokaProps?.setView(view);
    if (!view || view.phase === "locked") {
      this.colliders = this.colliders.filter((_, index) => !this.colliderOwners[index]?.startsWith("moka-"));
      this.colliderOwners = this.colliderOwners.filter(owner => !owner?.startsWith("moka-"));
      return;
    }
    if (this.mokaProps) {
      if (!this.colliderOwners.some(owner => owner?.startsWith("moka-"))) for (const prop of map.props) if (prop.id.startsWith("moka-")) this.addColliders(prop.id === "moka-basket-source" ? { ...prop, asset: "prop-moka-dropoff" } : prop, prop.id);
      for (const prop of map.props) if (view.activeTargetIds.includes(prop.id) && prop.id.startsWith("moka-")) this.props.set(prop.id, prop);
      return;
    }
    if (!this.mokaLoading) {
      this.mokaLoading = MokaProps.load(this.scene, this.player, map.props.filter(prop => prop.id.startsWith("moka-")), key => this.load(key)).then(props => {
        this.mokaProps = props;
        for (const [id, object] of props.objects) this.propObjects.set(id, object);
        this.setMokaView(this.mokaView);
      }).catch(error => {
        console.error("Moka assets failed to load", error);
        for (const key of this.models.keys()) if (key.startsWith("prop-moka-")) this.models.delete(key);
      }).finally(() => { this.mokaLoading = undefined; });
    }
  }
  setLumiView(view: ReturnType<typeof lumiView> | null): void { this.lumiView = view; this.setResidentView("lumi"); }
  setEchoView(view: ReturnType<typeof echoView> | null): void { this.echoView = view; this.setResidentView("echo"); }
  setOrView(view: ReturnType<typeof orView> | null): void { this.orView = view; this.setResidentView("or"); }
  private activeTargets(id: string): boolean {
    return [this.mokaView, this.lumiView, this.echoView, this.orView].some(view => view?.activeTargetIds.includes(id));
  }
  private residentActor(id: string): boolean { return ["lumi-neighbor-1", "lumi-neighbor-2", "echo-borrower", "or-fisher", "or-merchant"].includes(id); }
  private retryResidentLoading(): void {
    for (const npc of ["lumi", "echo", "or"] as const) {
      const view = this[`${npc}View`];
      if (view && view.phase !== "locked" && !this.residentProps[npc] && !this.residentLoading[npc]) this.setResidentView(npc);
    }
  }
  private gathered = false;
  private positionResidents(): void {
    const active = (view: { phase: string } | null) => !!view && view.phase !== "locked" && view.phase !== "completed";
    const move = (id: string, zone?: string) => {
      const actor = this.actors.get(id), original = map.actors.find(entry => entry.id === id);
      if (!actor || !original) return;
      const point = zone ? map.zones[zone] : original;
      if (!point) throw new Error(`Missing actor zone: ${zone}`);
      actor.object.position.set(point.x, 0, point.z);
      this.colliders = this.colliders.filter((_, index) => this.colliderOwners[index] !== id);
      this.colliderOwners = this.colliderOwners.filter(owner => owner !== id);
      this.addColliders({ ...original, ...point }, id);
    };
    move("s1j2", active(this.lumiView) ? "lumi-stagekeeper" : undefined);
    move("t1p2", active(this.echoView) ? "echo-organizer" : undefined);
    move("s2j2", active(this.orView) ? "or-assistant" : undefined);
    const elsewhere = active(this.lumiView) || active(this.echoView) || active(this.mokaView);
    const plaza = !elsewhere && this.orView && ["report", "completed"].includes(this.orView.phase) && this.orView.choices[5] === "b";
    for (const id of ["A", "B", "C"]) move(id, this.gathered ? `ending-${id}` : undefined);
    move("D", this.gathered ? "ending-D" : plaza ? "or-report" : undefined);
    for (const [npc, ids] of Object.entries({ lumi: ["lumi-neighbor-1", "lumi-neighbor-2"], echo: ["echo-borrower"], or: ["or-fisher", "or-merchant"] }) as ["lumi" | "echo" | "or", string[]][]) {
      const view = this[`${npc}View`];
      for (const id of ids) {
        const actor = this.actors.get(id); if (!actor) continue;
        const shown = active(view); actor.object.visible = shown;
        this.colliders = this.colliders.filter((_, index) => this.colliderOwners[index] !== id);
        this.colliderOwners = this.colliderOwners.filter(owner => owner !== id);
        if (!shown) continue;
        const review = npc === "or" && this.orView?.phase === "review" && this.orView.choices[3] === "a";
        const zone = review ? id.replace("or-", "or-review-") : id;
        const point = map.zones[zone]; if (!point) throw new Error(`Missing actor zone: ${zone}`);
        actor.object.position.set(point.x, 0, point.z); this.addColliders({ ...point, asset: WALK_ON_ASSET[id]! }, id);
      }
    }
  }
  private setResidentView(npc: "lumi" | "echo" | "or"): void {
    const view = this[`${npc}View`]; this.auto = undefined;
    this.positionResidents();
    for (const prop of map.props) if (prop.id.startsWith(`${npc}-`)) this.props.delete(prop.id);
    this.residentProps[npc]?.setView(view);
    this.colliders = this.colliders.filter((_, index) => !this.colliderOwners[index]?.startsWith(`${npc}-`) || this.actors.has(this.colliderOwners[index]!));
    this.colliderOwners = this.colliderOwners.filter(owner => !owner?.startsWith(`${npc}-`) || this.actors.has(owner));
    if (!view || view.phase === "locked") return;
    const residentProps = this.residentProps[npc];
    if (residentProps) {
      for (const prop of map.props) if (prop.id.startsWith(`${npc}-`)) {
        const object = residentProps.objects.get(prop.id);
        let visible = !!object;
        for (let node = object; node; node = node.parent ?? undefined) visible &&= node.visible;
        if (view.activeTargetIds.includes(prop.id)) {
          if (!visible) throw new Error(`Active resident prop is not visible: ${prop.id}`);
          this.props.set(prop.id, prop);
        }
        if (visible) this.addColliders(prop, prop.id);
      }
      return;
    }
    if (!this.residentLoading[npc]) {
      const ids = npc === "lumi" ? ["lumi-neighbor-1", "lumi-neighbor-2"] : npc === "echo" ? ["echo-borrower"] : ["or-fisher", "or-merchant"];
      const loading = Promise.all([
        ResidentProps.load(npc, this.scene, this.player, map.props.filter(prop => prop.id.startsWith(`${npc}-`)), key => this.load(key)),
        ...ids.map(async id => {
          let actor = this.actors.get(id);
          if (!actor) { const object = new THREE.Group(), marker = this.label(); object.userData.id = id; object.visible = false; object.add(marker); this.scene.add(object); actor = { object, marker }; this.actors.set(id, actor); }
          if (!actor.character) actor.character = await this.character(WALK_ON_ASSET[id]!, actor.object);
        }),
      ]).then(([props]) => {
        this.residentProps[npc] = props;
        for (const [id, object] of props.objects) this.propObjects.set(id, object);
        this.setResidentView(npc); this.setAvailable([...this.available]);
      }).finally(() => { delete this.residentLoading[npc]; });
      this.residentLoading[npc] = loading;
      void loading.catch(error => { console.error(`${npc} assets failed to load`, error); this.onPathBlocked(); });
    }
  }
  private async resumeResident(npc: "lumi" | "echo" | "or"): Promise<void> {
    const view = this[`${npc}View`]; if (!view?.resumePointId) return;
    await this.whenReady;
    if (view !== this[`${npc}View`]) return;
    if (!this.residentProps[npc] && !this.residentLoading[npc]) this.setResidentView(npc);
    await this.residentLoading[npc];
    if (view !== this[`${npc}View`] || !this.residentProps[npc]) return;
    const id = view.resumePointId;
    const placement = this.target(id) ?? [...map.actors, ...map.props].find(entry => entry.id === id);
    if (!placement) throw new Error(`Missing resume point: ${id}`);
    const target = { x: placement.x, z: placement.z, colliders: this.actors.has(id) ? [] : this.colliders.filter((_, index) => this.colliderOwners[index] === id) };
    const position = new THREE.Vector3(target.x, 0, target.z);
    const path = findPath(this.player.position, target, this.colliders, map.bounds, point => this.visible(id, position, point));
    if (!path) { this.onPathBlocked(); return; }
    const destination = path.at(-1) ?? this.player.position;
    this.player.position.set(destination.x, 0, destination.z); this.cameraTarget.copy(this.player.position); this.demi?.reset(this.player.position);
  }
  async resumeLumi(): Promise<void> { await this.resumeResident("lumi"); }
  async resumeEcho(): Promise<void> { await this.resumeResident("echo"); }
  async resumeOr(): Promise<void> { await this.resumeResident("or"); }
  async resumeMoka(): Promise<boolean> {
    const view = this.mokaView;
    if (!view?.resumePointId) return false;
    await this.mokaLoading;
    if (view !== this.mokaView || !this.mokaProps) return false;
    const id = view.resumePointId;
    const placement = [...map.actors, ...map.props].find(entry => entry.id === id);
    if (!placement) return false;
    const actor = this.actors.get(id);
    const actorPosition = actor?.object.position || placement;
    const target = { x: actorPosition.x, z: actorPosition.z, colliders: actor ? [] : this.colliders.filter((_, index) => this.colliderOwners[index] === id) };
    const position = new THREE.Vector3(target.x, 0, target.z);
    const path = findPath(this.player.position, target, this.colliders, map.bounds, point => this.visible(id, position, point));
    if (!path) return false;
    const destination = path.at(-1) ?? this.player.position;
    this.player.position.set(destination.x, 0, destination.z);
    this.demi?.reset(this.player.position);
    this.cameraTarget.copy(this.player.position);
    return true;
  }
  setMoveInput(x: number, y: number): void { if (x || y) this.auto = undefined; this.input = !this.ready || !this.enabled || this.portrait ? { x: 0, z: 0 } : { x: (x - y) / Math.SQRT2, z: (-x - y) / Math.SQRT2 }; }
  private addColliders(placement: Placement, owner?: string): void {
    const asset = manifest[placement.asset]; if (!asset) throw new Error(`Missing asset: ${placement.asset}`);
    const scale = asset.scale * (placement.scale ?? 1), rot = placement.rot ?? 0, c = Math.cos(rot), s = Math.sin(rot);
    for (const shape of asset.collision) {
      const x = placement.x + (c * shape.x + s * shape.z) * scale, z = placement.z + (-s * shape.x + c * shape.z) * scale;
      this.colliders.push(shape.type === "circle" ? { type: "circle", x, z, radius: shape.radius * scale } : { type: "box", x, z, halfX: shape.halfX * scale, halfZ: shape.halfZ * scale, rot });
      this.colliderOwners.push(owner);
    }
  }
  private visible(id: string, target: THREE.Vector3, start: Vec2 = this.player.position): boolean {
    const dx = target.x - start.x, dz = target.z - start.z;
    return !this.colliders.some((shape, index) => {
      const owner = this.colliderOwners[index];
      if (owner === id || (owner && this.actors.get(owner)?.object.position.distanceToSquared(target) === 0)) return false;
      if (shape.type === "circle") {
        const t = Math.max(0, Math.min(1, ((shape.x - start.x) * dx + (shape.z - start.z) * dz) / (dx * dx + dz * dz || 1)));
        return Math.hypot(start.x + dx * t - shape.x, start.z + dz * t - shape.z) < shape.radius;
      }
      const c = Math.cos(shape.rot), s = Math.sin(shape.rot), x = start.x - shape.x, z = start.z - shape.z;
      const origin = [c * x - s * z, s * x + c * z], delta = [c * dx - s * dz, s * dx + c * dz], half = [shape.halfX, shape.halfZ];
      let low = 0, high = 1;
      for (let i = 0; i < 2; i++) {
        if (Math.abs(delta[i]!) < 1e-9) { if (Math.abs(origin[i]!) > half[i]!) return false; continue; }
        const a = (-half[i]! - origin[i]!) / delta[i]!, b = (half[i]! - origin[i]!) / delta[i]!;
        low = Math.max(low, Math.min(a, b)); high = Math.min(high, Math.max(a, b)); if (low > high) return false;
      }
      return true;
    });
  }
  private findNearby(previous?: string | null): string | null {
    const active = [...this.props.values()].filter(prop => this.activeTargets(prop.id) && this.available.has(prop.id) && this.visible(prop.id, new THREE.Vector3(prop.x, 0, prop.z))).map(prop => ({ ...prop, colliders: this.colliders.filter((_, index) => this.colliderOwners[index] === prop.id) }));
    const activeId = nearest(this.player.position, active, .85, previous);
    if (activeId) return activeId;
    const targets = [...this.actors].filter(([id, actor]) => actor.object.visible && (!this.residentActor(id) || this.available.has(id)) && this.visible(id, actor.object.position) && (this.available.has(id) || ![...this.actors].some(([otherId, other]) => other.object.visible && this.available.has(otherId) && other.object.position.distanceToSquared(actor.object.position) < 1e-8))).map(([id, actor]) => ({ id, x: actor.object.position.x, z: actor.object.position.z }));
    const pos = { x: this.player.position.x, z: this.player.position.z };
    const actor = nearest(pos, targets, .85, previous);
    if (actor) return actor;
    const props = [...this.props.values()].filter(prop => (!this.activeTargets(prop.id) || this.available.has(prop.id)) && this.visible(prop.id, new THREE.Vector3(prop.x, 0, prop.z))).map(prop => ({ ...prop, colliders: this.colliders.filter((_, index) => this.colliderOwners[index] === prop.id) }));
    return nearest(pos, props, .85, previous);
  }
  interactNearby(): void {
    if (!this.enabled || !this.ready || this.portrait || this.talking) return;
    this.retryResidentLoading();
    const id = this.findNearby(); if (!id) return;
    this.interactTarget(id);
  }
  private target(id: string): (Vec2 & { colliders?: Collider[] }) | undefined {
    const actor = this.actors.get(id), prop = this.props.get(id);
    if (actor && actor.object.visible !== false) return { x: actor.object.position.x, z: actor.object.position.z };
    if (prop) return { x: prop.x, z: prop.z, colliders: this.colliders.filter((_, index) => this.colliderOwners[index] === id) };
    return undefined;
  }
  interactTarget(id: string): void {
    if (!this.enabled || !this.ready || this.portrait || this.talking) return;
    const target = this.target(id); if (!target) return;
    if ((this.activeTargets(id) || this.residentActor(id)) && !this.available.has(id)) return;
    const actorAtTarget = this.actors.get(id);
    if (actorAtTarget && !this.available.has(id) && [...this.actors].some(([otherId, other]) => this.available.has(otherId) && other.object.position.distanceToSquared(actorAtTarget.object.position) < 1e-8)) return;
    this.tapMarker.position.set(target.x, .05, target.z); this.tapScale = this.targetRingScale(id); this.tapTime = .3;
    const playerPosition = this.player.position;
    const targetPosition = new THREE.Vector3(target.x, 0, target.z);
    if (!nearest(playerPosition, [{ id, ...target }]) || !this.visible(id, targetPosition)) {
      this.input = { x: 0, z: 0 };
      const route = id === "moka-workshop-dropoff" && this.mokaView?.basket === "player" ? this.mokaView.route : null;
      const waypoints = route ? quest.routes[route === "shortcut" ? "a" : "b"].waypoints.map(key => map.zones[key]!) : [];
      const path = waypoints.length ? findPathVia(playerPosition, waypoints, target, this.colliders, map.bounds, position => this.visible(id, targetPosition, position)) : findPath(playerPosition, target, this.colliders, map.bounds, position => this.visible(id, targetPosition, position));
      this.auto = path ? { id, path, best: Infinity, stalled: 0 } : undefined;
      if (!path) this.onPathBlocked();
      return;
    }
    this.auto = undefined;
    if (!this.visible(id, targetPosition)) return;
    const actor = this.actors.get(id); const prop = this.props.get(id); const position = actor?.object.position ?? prop!; const dx = position.x - this.player.position.x, dz = position.z - this.player.position.z;
    this.input = { x: 0, z: 0 }; if (dx || dz) { this.player.rotation.y = Math.atan2(dx, dz); if (actor?.character) actor.object.rotation.y = Math.atan2(-dx, -dz); }
    this.talking = id; this.focusSpeaker(id); this.onInteract(prop && !this.activeTargets(id) ? `examine:${prop.zone ? `${prop.asset}.${prop.zone}` : prop.asset}` : id);
  }
  hitTargetAt(clientX: number, clientY: number): string | null {
    if (!this.enabled || !this.ready || this.portrait || this.talking) return null;
    this.retryResidentLoading();
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height || clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return null;
    const candidates: { id: string; distance: number; available: boolean }[] = [];
    for (const id of [...this.actors.keys(), ...this.props.keys()]) {
      const target = this.target(id); if (!target || ((this.activeTargets(id) || this.residentActor(id)) && !this.available.has(id))) continue;
      const actor = this.actors.get(id), object = actor?.character?.object ?? this.propObjects.get(id);
      const box = object ? new THREE.Box3().setFromObject(object) : new THREE.Box3();
      if (box.isEmpty()) box.set(new THREE.Vector3(target.x, 0, target.z), new THREE.Vector3(target.x, .6, target.z));
      let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
        const p = new THREE.Vector3(x, y, z).project(this.camera);
        const sx = rect.left + (p.x + 1) * rect.width / 2, sy = rect.top + (1 - p.y) * rect.height / 2;
        left = Math.min(left, sx); right = Math.max(right, sx); top = Math.min(top, sy); bottom = Math.max(bottom, sy);
      }
      const cx = (left + right) / 2, cy = (top + bottom) / 2;
      if (Math.abs(clientX - cx) <= Math.max(24, (right - left) / 2) && Math.abs(clientY - cy) <= Math.max(24, (bottom - top) / 2)) candidates.push({ id, distance: Math.hypot(clientX - cx, clientY - cy), available: this.available.has(id) });
    }
    candidates.sort((a, b) => Number(b.available) - Number(a.available) || a.distance - b.distance || a.id.localeCompare(b.id));
    return candidates[0]?.id ?? null;
  }
  private async ground(): Promise<void> {
    const asset = manifest[map.terrain.asset];
    if (!asset) throw new Error("Missing terrain asset");
    // Start the real load at once. Only when it fails do we probe whether the file is simply absent (a dev server answers 200 with HTML).
    try { this.nature.build(await this.place(map.terrain), this.colliders); return; } catch (error) {
      const response = await fetch(assetUrl(asset.path)).catch(() => undefined);
      if (!response || !(response.status === 404 || (response.ok && response.headers.get("content-type")?.includes("text/html")))) throw error;
    }
    const polygon = (points: Vec2[]) => points.map(point => new THREE.Vector2(point.x, -point.z));
    const shape = new THREE.Shape(polygon(map.bounds.outer));
    for (const hole of map.bounds.holes) shape.holes.push(new THREE.Path(polygon(hole)));
    const ground = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshStandardMaterial({ color: "#6BCB6B", side: THREE.DoubleSide }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; this.scene.add(ground);
  }
  private load(key: string): Promise<GLTF> {
    const asset = manifest[key];
    if (!asset || !/^assets\/abraxas\/[\w/-]+\.glb$/.test(asset.path) || asset.path.includes("..")) return Promise.reject(new Error(`Invalid asset: ${key}`));
    if (!this.models.has(key)) this.models.set(key, this.loader.loadAsync(assetUrl(asset.path)).catch(error => { this.models.delete(key); throw error; }));
    return this.models.get(key)!;
  }
  private async place(placement: Placement): Promise<THREE.Object3D> {
    const gltf = await this.load(placement.asset); const object = gltf.scene.clone();
    const terrain = placement.asset === map.terrain.asset;
    const castsShadow = !terrain && !/^(flower-cluster-|grass-|mushroom$|pebbles$)/.test(placement.asset);
    object.traverse(child => { if (child instanceof THREE.Mesh) { child.castShadow = castsShadow; child.receiveShadow = terrain || castsShadow; } });
    object.position.set(placement.x, 0, placement.z); object.rotation.y = placement.rot ?? 0;
    if (!terrain) this.nature.dress(object, placement.asset);
    object.scale.setScalar(manifest[placement.asset]!.scale * (placement.scale ?? 1)); this.scene.add(object); return object;
  }
  private async character(key: string, parent: THREE.Group): Promise<Character> {
    const gltf = await this.load(key); const object = clone(gltf.scene); object.scale.setScalar(manifest[key]!.scale); parent.add(object);
    if (key === "player") whitenPlayer(object);
    object.traverse(child => { if (child instanceof THREE.Mesh) { child.castShadow = true; child.receiveShadow = true; } });
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 64; const ctx = canvas.getContext("2d")!;
    const gradient = ctx.createRadialGradient(32, 32, 2, 32, 32, 32); gradient.addColorStop(0, "rgba(55,38,42,.26)"); gradient.addColorStop(1, "rgba(55,38,42,0)");
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 64, 64);
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(.55, .55), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = .012; parent.add(shadow);
    // Secondary bones belong to the spring solver; the exporter still writes rest-pose tracks for them.
    for (const clip of gltf.animations) clip.tracks = clip.tracks.filter(track => !track.name.startsWith("sec_"));
    const mixer = new THREE.AnimationMixer(object), actions = new Map(gltf.animations.map(clip => [clip.name.toLowerCase(), mixer.clipAction(clip)]));
    const character: Character = { object, mixer, springs: new SpringBones(object, !window.matchMedia("(prefers-reduced-motion: reduce)").matches), actions }; this.characters.push(character); this.animate(character, "idle"); return character;
  }
  private animate(character: Character | undefined, name: string): void {
    if (!character || character.current === name) return;
    const action = character.actions.get(name); if (!action) return;
    if (character.current) character.actions.get(character.current)?.fadeOut(.12);
    action.reset().fadeIn(.12).play(); character.current = name;
  }
  private label(): THREE.Sprite {
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 128; const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#FFD23F"; ctx.beginPath(); ctx.arc(64, 64, 60, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#3B2A22"; ctx.font = "bold 96px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("!", 64, 68);
    const marker = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true })); marker.visible = false; return marker;
  }
  private ring(color: string, opacity: number): THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial> {
    const ring = new THREE.Mesh(new THREE.RingGeometry(.25, .3, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.visible = false; return ring;
  }
  private targetRingScale(id: string): number {
    const object = this.actors.get(id)?.character?.object ?? this.propObjects.get(id);
    if (!object) return 1;
    const size = new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3());
    return Math.max(1, Math.hypot(size.x, size.z) / .6);
  }
  private resize(): void {
    const w = this.renderer.domElement.parentElement!.clientWidth, h = this.renderer.domElement.parentElement!.clientHeight;
    if (!w || !h) return;
    this.viewAspect = w / h; this.portrait = h > w;
    const mobile = navigator.maxTouchPoints > 0 || Math.min(w, h) < 600;
    const shadowSize = Math.min(mobile ? 1024 : 2048, Math.max(512, 2 ** Math.ceil(Math.log2(Math.max(w, h) * Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2)))));
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2));
    this.lights.resize(this.viewHalfHeight, this.viewAspect, shadowSize);
    this.effects?.resize(mobile, this.renderer.getPixelRatio()); this.nature.resize(mobile);
    this.camera.near = .1; this.camera.far = 100; this.renderer.setSize(w, h);
    this.updateCamera(0, true);
  }
  private updateCamera(dt: number, snap = false): void {
    const speaker = this.speaker ? this.target(this.speaker) : undefined;
    const focus = !this.enabled && speaker ? dialogueFocus(this.player.position, new THREE.Vector3(speaker.x, 0, speaker.z), this.viewHalfHeight)
      : this.enabled ? this.player.position.clone().add(new THREE.Vector3(this.input.x, 0, this.input.z).multiplyScalar(.25)).add(new THREE.Vector3(1, -Math.sqrt(2) / Math.tan(THREE.MathUtils.degToRad(35)), 1).normalize().multiplyScalar(this.viewHalfHeight * -.12)) : this.cameraTarget;
    this.cameraTarget.lerp(focus, snap ? 1 : 1 - Math.exp(-5 * dt));
    const target = this.cameraTarget.clone();
    this.camera.position.copy(target).add(new THREE.Vector3(10, 10 * Math.tan(THREE.MathUtils.degToRad(35)) * Math.sqrt(2), 10)); this.camera.lookAt(target); this.camera.updateMatrixWorld();
    if (snap && this.playerCharacter) {
      const size = new THREE.Box3().setFromObject(this.playerCharacter.object).getSize(new THREE.Vector3());
      const m = this.camera.matrixWorldInverse.elements;
      const height = Math.abs(m[1]! * size.x) + Math.abs(m[5]! * size.y) + Math.abs(m[9]! * size.z);
      if (height > 0) this.viewHalfHeight = height * this.renderer.domElement.clientHeight / 140;
    }
    const desired = this.viewHalfHeight;
    this.cameraHalfHeight = snap ? desired : this.cameraHalfHeight + (desired - this.cameraHalfHeight) * (1 - Math.exp(-5 * dt));
    this.camera.left = -this.cameraHalfHeight * this.viewAspect; this.camera.right = -this.camera.left; this.camera.top = this.cameraHalfHeight; this.camera.bottom = -this.cameraHalfHeight; this.camera.updateProjectionMatrix();
    const pixel = 2 * this.cameraHalfHeight / this.renderer.domElement.clientHeight;
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);
    for (const actor of this.actors.values()) {
      if (!actor.marker.visible) continue;
      const box = actor.character ? new THREE.Box3().setFromObject(actor.character.object) : new THREE.Box3().setFromCenterAndSize(actor.object.position.clone().add(new THREE.Vector3(0, .3, 0)), new THREE.Vector3(0, .6, 0));
      const size = box.getSize(new THREE.Vector3());
      const top = (Math.abs(up.x) * size.x + Math.abs(up.y) * size.y + Math.abs(up.z) * size.z) / 2;
      actor.marker.scale.set(MARKER_SIZE_PX * pixel, MARKER_SIZE_PX * pixel, 1);
      actor.marker.position.copy(actor.object.worldToLocal(box.getCenter(new THREE.Vector3()).addScaledVector(up, top + (8 + MARKER_SIZE_PX / 2) * pixel)));
    }
    this.lights.update(dt, this.player.position);
  }
  private tick(): void {
    if (document.hidden) return;
    const now = performance.now() / 1000, elapsed = this.lastTime ? now - this.lastTime : 0, dt = Math.min(elapsed, .05); this.lastTime = now;
    let moving = false, distance = 0;
    if (this.enabled && this.ready && !this.portrait && this.auto) {
      const target = this.target(this.auto.id);
      if (!target) this.auto = undefined;
      else {
        const result = followPath({ position: { x: this.player.position.x, z: this.player.position.z }, path: this.auto.path, best: this.auto.best, stalled: this.auto.stalled, status: "walking" }, target, this.colliders, map.bounds, elapsed);
        const dx = result.position.x - this.player.position.x, dz = result.position.z - this.player.position.z;
        distance = Math.hypot(dx, dz); moving = distance > 1e-6;
        if (moving) { this.player.rotation.y = Math.atan2(dx, dz); this.player.position.set(result.position.x, 0, result.position.z); }
        this.auto.path = result.path; this.auto.best = result.best; this.auto.stalled = result.stalled;
        if (result.status !== "walking") { const id = this.auto.id; this.auto = undefined; if (result.status === "arrived") this.interactTarget(id); else this.onPathBlocked(); }
      }
    } else if (this.enabled && this.ready && !this.portrait && (this.input.x || this.input.z)) {
      const before = this.player.position, next = step({ x: before.x, z: before.z }, this.input, dt, this.colliders, map.bounds);
      const dx = next.x - before.x, dz = next.z - before.z; distance = Math.hypot(dx, dz); moving = distance > 1e-6;
      if (moving) { this.player.rotation.y = Math.atan2(dx, dz); this.player.position.set(next.x, 0, next.z); }
    }
    this.animate(this.playerCharacter, moving ? "walk" : "idle");
    this.demi.update(this.player.position, dt);
    if (this.demiPath && Math.hypot(this.player.position.x - this.demi.object.position.x, this.player.position.z - this.demi.object.position.z) < 1.5) {
      const result = followPath({ position: this.demi.object.position, ...this.demiPath, status: "walking" }, this.demiPath.target, this.colliders, map.bounds, dt);
      const dx = result.position.x - this.demi.object.position.x, dz = result.position.z - this.demi.object.position.z;
      this.demi.object.position.set(result.position.x, 0, result.position.z);
      if (dx || dz) this.demi.object.rotation.y = Math.atan2(dx, dz);
      this.demiPath = result.status === "walking" ? { ...this.demiPath, path: result.path, best: result.best, stalled: result.stalled } : undefined;
      if (!this.demiPath) this.demi.object.rotation.y = Math.atan2(this.player.position.x - result.position.x, this.player.position.z - result.position.z);
    }
    if (moving && this.playerCharacter) this.playerCharacter.actions.get("walk")?.setEffectiveTimeScale(distance / (1.4 * dt));
    for (const [id, actor] of this.actors) this.animate(actor.character, !this.enabled && this.talking === id ? "talk" : "idle");
    const nearby = this.enabled && this.ready && !this.portrait && !this.talking ? this.findNearby(this.nearby) : null;
    if (nearby !== this.nearby) { this.nearby = nearby; if (nearby) this.nearbyMarker.scale.setScalar(this.targetRingScale(nearby)); this.onNearbyChange(nearby ? { id: nearby, available: true, examine: this.props.has(nearby) && !this.activeTargets(nearby) } : null); }
    this.nearbyMarker.visible = !!nearby;
    if (nearby) { const target = this.target(nearby)!; this.nearbyMarker.position.set(target.x, .04, target.z); }
    this.tapTime = Math.max(0, this.tapTime - dt); this.tapMarker.visible = this.tapTime > 0;
    if (this.tapMarker.visible) { const progress = 1 - this.tapTime / .3; this.tapMarker.scale.setScalar(this.tapScale * (1 + progress * .6)); this.tapMarker.material.opacity = .8 * (1 - progress); }
    const destination = this.auto?.path.at(-1); this.destinationMarker.visible = !!destination;
    if (destination) this.destinationMarker.position.set(destination.x, .04, destination.z);
    for (const character of this.characters) { character.mixer.update(dt); character.springs.update(dt); }
    this.updateCamera(dt);
    this.effects?.update(dt, this.player.position, this.camera);
    this.nature.update(dt, this.player.position, this.camera);
    if (this.ready) this.renderer.render(this.scene, this.camera); this.frame = requestAnimationFrame(() => this.tick());
  }
}
