import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { step } from "../core/world/move";
import { nearest } from "../core/world/nearby";
import type { Bounds, Collider, Vec2 } from "../core/world/types";
import { translations } from "../content";
import { DreamEffects } from "./dream-effects";

type Placement = Vec2 & { asset: string; rot?: number; scale?: number; zone?: string };
type MapData = { spawn: Vec2; terrain: Placement; bounds: Bounds; zones: Record<string, Vec2>; actors: (Placement & { id: string })[]; props: (Placement & { id: string })[] };
type Asset = { path: string; scale: number; collision: Collider[]; clips?: string[] };
const map = import.meta.glob<{ default: MapData }>("../../../content/world/village.json", { eager: true })["../../../content/world/village.json"]!.default;
const manifest = import.meta.glob<{ default: { assets: Record<string, Asset> } }>("../../../content/assets/manifest.json", { eager: true })["../../../content/assets/manifest.json"]!.default.assets;

type Character = { object: THREE.Object3D; mixer: THREE.AnimationMixer; actions: Map<string, THREE.AnimationAction>; current?: string };

export class Village {
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera();
  private light = new THREE.DirectionalLight("#fff0df", 1.4);
  private renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  private effects?: DreamEffects;
  private loader = new GLTFLoader();
  private models = new Map<string, Promise<GLTF>>();
  private actors = new Map<string, { object: THREE.Group; marker: THREE.Sprite; character?: Character }>();
  private props = new Map<string, Placement & { id: string }>();
  private characters: Character[] = [];
  private player = new THREE.Group();
  private cameraTarget = new THREE.Vector3();
  private viewHalfHeight = 1.75;
  private cameraHalfHeight = 1.75;
  private viewAspect = 1;
  private playerCharacter?: Character;
  private enabled = false;
  private input: Vec2 = { x: 0, z: 0 };
  private colliders: Collider[] = [];
  private colliderOwners: (string | undefined)[] = [];
  private nearby: string | null = null;
  private talking?: string;
  private available = new Set<string>();
  private ready = false;
  onNearbyChange: (target: { id: string; available: boolean; examine?: boolean } | null) => void = () => {};
  private lastTime = 0;
  private frame = 0;
  onInteract: (id: string) => void = () => {};

  constructor(app: HTMLElement) {
    if (import.meta.env.DEV) Object.assign(this, { teleport: (x: number, z: number) => { this.player.position.set(x, 0, z); this.cameraTarget.copy(this.player.position); } });
    const draco = new DRACOLoader();
    draco.setDecoderPath(`${import.meta.env.BASE_URL}assets/abraxas/decoders/`); draco.setWorkerLimit(1); this.loader.setDRACOLoader(draco);
    this.scene.fog = new THREE.Fog("#eae3f7", 19, 40);
    this.scene.add(new THREE.HemisphereLight("#fff4ed", "#e8ddf4", 2.5));
    this.light.castShadow = true; this.light.shadow.camera.left = -4; this.light.shadow.camera.right = 4;
    this.light.shadow.camera.top = 4; this.light.shadow.camera.bottom = -4; this.light.shadow.camera.near = .1; this.light.shadow.camera.far = 25;
    this.light.shadow.bias = -.0001; this.light.shadow.normalBias = .02;
    this.scene.add(this.light, this.light.target);
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.domElement.style.background = "linear-gradient(to bottom, #eae3f7 0%, #d8d0f0 38%, #f3d5c5 72%, #94d2cb 100%)";
    app.append(this.renderer.domElement);
    this.effects = new DreamEffects(this.scene, map.props, map.zones.lake);
    const loading: Promise<unknown>[] = [this.ground()];
    this.player.position.set(map.spawn.x, 0, map.spawn.z); this.cameraTarget.copy(this.player.position); this.scene.add(this.player);
    loading.push(this.character("player", this.player).then(character => { this.playerCharacter = character; }));
    for (const prop of map.props) {
      const register = () => { this.addColliders(prop, prop.id); if (translations("ko").examine[prop.zone ? `${prop.asset}.${prop.zone}` : prop.asset]) this.props.set(prop.id, prop); };
      if (prop.asset === "signboard") loading.push(this.place(prop).then(register).catch(error => console.warn(`Village prop failed to load: ${prop.id}`, error)));
      else { register(); loading.push(this.place(prop)); }
    }
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
    this.renderer.domElement.addEventListener("pointerup", event => this.tap(event));
    void Promise.all(loading).then(() => { this.ready = true; }).catch(error => {
      console.error("Village assets failed to load", error); this.enabled = false;
      const message = document.createElement("div"); message.textContent = "마을을 불러오지 못했어요. 새로고침해 주세요."; message.setAttribute("role", "alert"); Object.assign(message.style, { position: "fixed", inset: "0", display: "grid", placeItems: "center", background: "#fff8ec", color: "#3b2a22", zIndex: "1000" }); app.append(message);
    });
    this.resize(); window.addEventListener("abraxas:viewport", () => this.resize());
    document.addEventListener("visibilitychange", () => {
      cancelAnimationFrame(this.frame);
      if (!document.hidden) { this.lastTime = 0; this.frame = requestAnimationFrame(() => this.tick()); }
    });
    if (!document.hidden) this.frame = requestAnimationFrame(() => this.tick());
  }
  setEnabled(value: boolean): void { this.enabled = value; if (value) this.talking = undefined; else { this.input = { x: 0, z: 0 }; this.nearby = null; this.onNearbyChange(null); } }
  setAvailable(ids: string[]): void { this.available = new Set(ids); for (const [id, actor] of this.actors) actor.marker.visible = this.available.has(id); }
  setMoveInput(x: number, y: number): void { this.input = { x: (x - y) / Math.SQRT2, z: (-x - y) / Math.SQRT2 }; }
  private addColliders(placement: Placement, owner?: string): void {
    const asset = manifest[placement.asset]; if (!asset) throw new Error(`Missing asset: ${placement.asset}`);
    const scale = asset.scale * (placement.scale ?? 1), rot = placement.rot ?? 0, c = Math.cos(rot), s = Math.sin(rot);
    for (const shape of asset.collision) {
      const x = placement.x + (c * shape.x + s * shape.z) * scale, z = placement.z + (-s * shape.x + c * shape.z) * scale;
      this.colliders.push(shape.type === "circle" ? { type: "circle", x, z, radius: shape.radius * scale } : { type: "box", x, z, halfX: shape.halfX * scale, halfZ: shape.halfZ * scale, rot });
      this.colliderOwners.push(owner);
    }
  }
  private visible(id: string, target: THREE.Vector3): boolean {
    const start = this.player.position, dx = target.x - start.x, dz = target.z - start.z;
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
    const targets = [...this.actors].filter(([id, actor]) => this.visible(id, actor.object.position) && (this.available.has(id) || ![...this.actors].some(([otherId, other]) => this.available.has(otherId) && other.object.position.distanceToSquared(actor.object.position) < 1e-8))).map(([id, actor]) => ({ id, x: actor.object.position.x, z: actor.object.position.z }));
    const pos = { x: this.player.position.x, z: this.player.position.z };
    const actor = nearest(pos, targets, .85, previous);
    if (actor) return actor;
    const props = [...this.props.values()].filter(prop => this.visible(prop.id, new THREE.Vector3(prop.x, 0, prop.z))).map(prop => ({ ...prop, colliders: this.colliders.filter((_, index) => this.colliderOwners[index] === prop.id) }));
    return nearest(pos, props, .85, previous);
  }
  interactNearby(): void {
    if (!this.enabled || !this.ready) return;
    const id = this.findNearby(); if (!id) return;
    const actor = this.actors.get(id); const prop = this.props.get(id); const position = actor?.object.position ?? prop!; const dx = position.x - this.player.position.x, dz = position.z - this.player.position.z;
    this.input = { x: 0, z: 0 }; if (dx || dz) { this.player.rotation.y = Math.atan2(dx, dz); if (actor?.character) actor.object.rotation.y = Math.atan2(-dx, -dz); }
    this.talking = id; this.onInteract(prop ? `examine:${prop.zone ? `${prop.asset}.${prop.zone}` : prop.asset}` : id);
  }
  private tap(event: PointerEvent): void {
    if (!this.enabled) return;
    const rect = this.renderer.domElement.getBoundingClientRect(), ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2), this.camera);
    for (const hit of ray.intersectObjects([...this.actors.values()].filter(actor => actor.character).map(actor => actor.object), true)) {
      let object: THREE.Object3D | null = hit.object; while (object && !object.userData.id) object = object.parent;
      if (object?.userData.id === this.findNearby()) this.interactNearby(); return;
    }
  }
  private async ground(): Promise<void> {
    const asset = manifest[map.terrain.asset];
    if (!asset) throw new Error("Missing terrain asset");
    const response = await fetch(`${import.meta.env.BASE_URL}${asset.path}`);
    const missing = response.status === 404 || (response.ok && response.headers.get("content-type")?.includes("text/html"));
    if (!missing) { if (!response.ok) throw new Error(`Terrain load failed: ${response.status}`); await this.place(map.terrain); return; }
    const polygon = (points: Vec2[]) => points.map(point => new THREE.Vector2(point.x, -point.z));
    const shape = new THREE.Shape(polygon(map.bounds.outer));
    for (const hole of map.bounds.holes) shape.holes.push(new THREE.Path(polygon(hole)));
    const ground = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshStandardMaterial({ color: "#6BCB6B", side: THREE.DoubleSide }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; this.scene.add(ground);
  }
  private load(key: string): Promise<GLTF> {
    const asset = manifest[key];
    if (!asset || !/^assets\/abraxas\/[\w/-]+\.glb$/.test(asset.path) || asset.path.includes("..")) return Promise.reject(new Error(`Invalid asset: ${key}`));
    if (!this.models.has(key)) this.models.set(key, this.loader.loadAsync(`${import.meta.env.BASE_URL}${asset.path}`));
    return this.models.get(key)!;
  }
  private async place(placement: Placement): Promise<void> {
    const gltf = await this.load(placement.asset); const object = gltf.scene.clone();
    const terrain = placement.asset === map.terrain.asset;
    const castsShadow = !terrain && !/^(flower-cluster-|grass-|mushroom$|pebbles$)/.test(placement.asset);
    object.traverse(child => { if (child instanceof THREE.Mesh) { child.castShadow = castsShadow; child.receiveShadow = terrain; } });
    object.position.set(placement.x, 0, placement.z); object.rotation.y = placement.rot ?? 0;
    object.scale.setScalar(manifest[placement.asset]!.scale * (placement.scale ?? 1)); this.scene.add(object);
  }
  private async character(key: string, parent: THREE.Group): Promise<Character> {
    const gltf = await this.load(key); const object = clone(gltf.scene); object.scale.setScalar(manifest[key]!.scale); parent.add(object);
    object.traverse(child => { if (child instanceof THREE.Mesh) child.castShadow = true; });
    const mixer = new THREE.AnimationMixer(object), actions = new Map(gltf.animations.map(clip => [clip.name.toLowerCase(), mixer.clipAction(clip)]));
    const character: Character = { object, mixer, actions }; this.characters.push(character); this.animate(character, "idle"); return character;
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
    const marker = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true })); marker.scale.set(.25, .25, 1); marker.position.y = .95; return marker;
  }
  private resize(): void {
    const w = this.renderer.domElement.parentElement!.clientWidth, h = this.renderer.domElement.parentElement!.clientHeight;
    if (!w || !h) return;
    this.viewAspect = w / h; this.viewHalfHeight = 1.75 * Math.max(1, Math.min(1.2, 1.6 / this.viewAspect));
    const mobile = navigator.maxTouchPoints > 0 || Math.min(w, h) < 600, shadowSize = mobile ? 512 : 1024;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2));
    if (this.light.shadow.mapSize.x !== shadowSize) {
      this.light.shadow.mapSize.set(shadowSize, shadowSize); this.light.shadow.map?.dispose(); this.light.shadow.map = null;
    }
    this.effects?.resize(mobile, this.renderer.getPixelRatio());
    this.camera.near = .1; this.camera.far = 100; this.renderer.setSize(w, h);
  }
  private tick(): void {
    if (document.hidden) return;
    const now = performance.now() / 1000, dt = this.lastTime ? Math.min(now - this.lastTime, .05) : 0; this.lastTime = now;
    let moving = false, distance = 0;
    if (this.enabled && this.ready && (this.input.x || this.input.z)) {
      const before = this.player.position, next = step({ x: before.x, z: before.z }, this.input, dt, this.colliders, map.bounds);
      const dx = next.x - before.x, dz = next.z - before.z; distance = Math.hypot(dx, dz); moving = distance > 1e-6;
      if (moving) { this.player.rotation.y = Math.atan2(dx, dz); this.player.position.set(next.x, 0, next.z); }
    }
    this.animate(this.playerCharacter, moving ? "walk" : "idle");
    if (moving && this.playerCharacter) this.playerCharacter.actions.get("walk")?.setEffectiveTimeScale(distance / (1.4 * dt));
    for (const [id, actor] of this.actors) this.animate(actor.character, !this.enabled && this.talking === id ? "talk" : "idle");
    const nearby = this.enabled && this.ready ? this.findNearby(this.nearby) : null;
    if (nearby !== this.nearby) { this.nearby = nearby; this.onNearbyChange(nearby ? { id: nearby, available: true, examine: this.props.has(nearby) } : null); }
    for (const character of this.characters) character.mixer.update(dt);
    const actor = this.talking ? this.actors.get(this.talking)?.object.position : undefined;
    const prop = this.talking ? this.props.get(this.talking) : undefined;
    const focus = this.player.position.clone();
    if (!this.enabled && actor) focus.lerp(actor, .5);
    else if (!this.enabled && prop) focus.lerp(new THREE.Vector3(prop.x, 0, prop.z), .35);
    else if (this.enabled) focus.add(new THREE.Vector3(this.input.x, 0, this.input.z).multiplyScalar(.25));
    this.cameraTarget.lerp(focus, 1 - Math.exp(-5 * dt));
    this.cameraHalfHeight += (this.viewHalfHeight * (!this.enabled && this.talking ? .88 : 1) - this.cameraHalfHeight) * (1 - Math.exp(-5 * dt));
    this.camera.left = -this.cameraHalfHeight * this.viewAspect; this.camera.right = -this.camera.left; this.camera.top = this.cameraHalfHeight; this.camera.bottom = -this.cameraHalfHeight; this.camera.updateProjectionMatrix();
    const target = this.cameraTarget.clone().add(new THREE.Vector3(1, -Math.sqrt(2) / Math.tan(THREE.MathUtils.degToRad(35)), 1).normalize().multiplyScalar(this.camera.top * .2));
    this.camera.position.copy(target).add(new THREE.Vector3(10, 10 * Math.tan(THREE.MathUtils.degToRad(35)) * Math.sqrt(2), 10)); this.camera.lookAt(target);
    this.light.target.position.copy(this.player.position); this.light.position.copy(this.player.position).add(new THREE.Vector3(4, 10, 5));
    this.effects?.update(dt, this.player.position, this.camera);
    this.renderer.render(this.scene, this.camera); this.frame = requestAnimationFrame(() => this.tick());
  }
}
