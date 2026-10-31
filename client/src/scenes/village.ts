import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

type Hex = { q: number; r: number };
type MapData = { hexSize: number; tiles: (Hex & { model: string; walk: boolean })[]; props: (Hex & { model: string; rot?: number; scale?: number })[]; zones: Record<string, Hex>; actors: ({ id: string; zone?: string } & Partial<Hex>)[] };
const files = import.meta.glob<{ default: MapData }>("../../../content/world/*.json", { eager: true });
const fallback: MapData = { hexSize: 1, tiles: [], props: [], zones: { entrance: { q: 0, r: 6 }, plaza: { q: 0, r: 0 }, bakery: { q: 5, r: -2 }, library: { q: -5, r: -1 }, smithy: { q: 4, r: 2 }, lake: { q: -4, r: 5 }, gate: { q: 0, r: -6 } }, actors: [{ id: "A", zone: "plaza" }, { id: "B", zone: "bakery" }, { id: "C", zone: "library" }, { id: "D", zone: "smithy" }, { id: "s1j2", q: 2, r: 3 }, { id: "v1j2", q: 6, r: 0 }, { id: "t1p2", q: -6, r: 2 }, { id: "s2j2", q: 2, r: 4 }] };
for (let q = -6; q <= 6; q++) for (let r = -6; r <= 6; r++) if (Math.abs(q + r) <= 6) fallback.tiles.push({ q, r, model: "medieval/hex_grass", walk: true });
const map = files["../../../content/world/village.json"]?.default ?? fallback;
const key = ({ q, r }: Hex) => `${q},${r}`;
const dirs = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]] as const;
const HEX = 2 / Math.sqrt(3);
const world = ({ q, r }: Hex) => new THREE.Vector3(Math.sqrt(3) * (q + r / 2) * HEX, 0, 1.5 * r * HEX);

export class Village {
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera();
  private renderer = new THREE.WebGLRenderer({ antialias: true });
  private loader = new GLTFLoader();
  private models = new Map<string, Promise<THREE.Group>>();
  private walking = new Map(map.tiles.filter(t => t.walk).map(t => [key(t), t]));
  private actors = new Map<string, { hex: Hex; object: THREE.Group; marker: THREE.Object3D }>();
  private player = this.character("player");
  private position = map.zones.entrance ?? { q: 0, r: 0 };
  private path: Hex[] = [];
  private afterMove: (() => void) | undefined;
  private moving = false;
  private dirty = true;
  private cameraTarget = new THREE.Vector3();
  private enabled = false;
  onInteract: (id: string) => void = () => {};

  constructor(app: HTMLElement) {
    this.scene.background = new THREE.Color("#5bc0f8");
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x9aa986, 1.1));
    const light = new THREE.DirectionalLight(0xffffff, 1.4); light.position.set(4, 10, 5); this.scene.add(light);
    this.renderer.toneMapping = THREE.NoToneMapping; this.renderer.toneMappingExposure = 1.0;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); app.append(this.renderer.domElement);
    for (const prop of map.props) this.walking.delete(key(prop));
    for (const tile of map.tiles) this.placeModel(tile.model, tile);
    for (const prop of map.props) this.placeModel(prop.model, prop, prop.rot, prop.scale);
    this.player.position.copy(world(this.position)); this.scene.add(this.player);
    for (const actor of map.actors) {
      const hex = actor.zone ? map.zones[actor.zone] : actor.q !== undefined && actor.r !== undefined ? { q: actor.q, r: actor.r } : undefined;
      if (!hex) continue;
      const object = this.character(actor.id); object.position.copy(world(hex)); object.userData.id = actor.id;
      const marker = this.label("!", 2.8); object.add(marker);
      if (!"ABCD".includes(actor.id)) object.add(this.label(actor.id, 2.4));
      this.scene.add(object); this.actors.set(actor.id, { hex, object, marker });
    }
    for (const id of ["lake", "plaza", "gate"]) {
      const hex = map.zones[id]; if (!hex) continue;
      const object = new THREE.Group(); object.position.copy(world(hex)); object.userData.id = id;
      const marker = this.label("!", 2); object.add(marker); this.scene.add(object); this.actors.set(id, { hex, object, marker });
    }
    this.resize(); window.addEventListener("resize", () => this.resize());
    this.renderer.domElement.addEventListener("pointerup", e => this.tap(e));
    requestAnimationFrame(() => this.tick());
  }
  setEnabled(value: boolean): void { this.enabled = value; }
  setAvailable(ids: string[]): void { for (const [id, actor] of this.actors) actor.marker.visible = ids.includes(id); this.dirty = true; }
  private label(text: string, y: number): THREE.Sprite {
    const canvas = document.createElement("canvas"); canvas.width = text === "!" ? 128 : 512; canvas.height = 128; const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = text === "!" ? "#FFD23F" : "#ffffff"; ctx.beginPath(); if (text === "!") ctx.arc(64, 64, 60, 0, Math.PI * 2); else ctx.roundRect(0, 0, 512, 128, 24); ctx.fill();
    ctx.fillStyle = "#3B2A22"; ctx.font = text === "!" ? "bold 96px sans-serif" : "bold 56px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(text, canvas.width / 2, 68);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true })); sprite.scale.set(text === "!" ? .8 : 1.5, text === "!" ? .8 : .38, 1); sprite.position.y = y; return sprite;
  }
  private character(id: string): THREE.Group {
    const group = new THREE.Group(); group.scale.setScalar(.4); const color = ({ A: "#ff7a59", B: "#ffb020", C: "#8e6bff", D: "#14b8a6", player: "#fff8ec" } as Record<string, string>)[id] ?? "#a0a0a0";
    const mat = new THREE.MeshStandardMaterial({ color, roughness: .65 });
    const body = new THREE.Mesh(id === "D" ? new THREE.BoxGeometry(1.05, 1, .65) : id === "C" ? new THREE.CylinderGeometry(.42, .42, 1, 16) : new THREE.SphereGeometry(.55, 16, 12), mat); body.position.y = .7; if (id === "B") body.scale.set(.8, 1.2, .8); group.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(id === "C" ? .55 : .48, 16, 12), mat); head.position.y = 1.55; group.add(head);
    if (id !== "player") {
      for (const x of [-.16, .16]) { const eye = new THREE.Mesh(new THREE.SphereGeometry(.05), new THREE.MeshBasicMaterial({ color: 0x302422 })); eye.position.set(x, 1.6, .44); group.add(eye); if (id === "C") { const glasses = new THREE.Mesh(new THREE.TorusGeometry(.12, .018, 6, 20), new THREE.MeshBasicMaterial({ color: 0x3b2a22 })); glasses.position.set(x, 1.6, .5); group.add(glasses); } }
      const mouth = new THREE.Mesh(new THREE.SphereGeometry(.035), new THREE.MeshBasicMaterial({ color: 0x302422 })); mouth.position.set(0, 1.4, .47); group.add(mouth);
    }
    if (id === "B") { const apron = new THREE.Mesh(new THREE.BoxGeometry(.55, .55, .05), new THREE.MeshStandardMaterial({ color: 0xfff8ec })); apron.position.set(0, .7, .46); group.add(apron); }
    if (id === "player") { const shell = new THREE.Mesh(new THREE.SphereGeometry(.57, 12, 8, 0, Math.PI * 2, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xffeac7 })); shell.position.y = .65; group.add(shell); }
    if (id === "A" || id === "D") { const stick = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, 1), new THREE.MeshStandardMaterial({ color: 0x79543a })); stick.position.set(.65, 1.2, 0); group.add(stick); const tip = new THREE.Mesh(id === "A" ? new THREE.BoxGeometry(.4, .25, .04) : new THREE.BoxGeometry(.4, .3, .3), mat); tip.position.set(.8, 1.65, 0); group.add(tip); }
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(.55, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .18, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; shadow.position.y = .03; group.add(shadow); return group;
  }
  private placeModel(model: string, hex: Hex, rot = 0, scale = 1): void {
    if (!this.models.has(model)) this.models.set(model, this.loader.loadAsync(`./assets/kaykit/${model}.gltf`).then(gltf => {
      if (model.startsWith("medieval/")) gltf.scene.traverse(object => { if (object instanceof THREE.Mesh) { const materials = Array.isArray(object.material) ? object.material : [object.material]; for (const material of materials) if (material instanceof THREE.MeshStandardMaterial && material.map) material.map = this.brightTexture(material.map); } });
      return gltf.scene;
    }));
    void this.models.get(model)!.then(source => { const object = source.clone(); object.position.copy(world(hex)); object.rotation.y = rot; object.scale.setScalar(scale * (({ medieval: 1, city: .6, furniture: .25, restaurant: .12 } as Record<string, number>)[model.split("/")[0]!] ?? 1)); this.scene.add(object); this.dirty = true; }).catch(() => { this.dirty = true; });
  }
  private texture?: THREE.Texture;
  private brightTexture(original: THREE.Texture): THREE.Texture {
    if (this.texture) return this.texture;
    const image = original.image as CanvasImageSource; const canvas = document.createElement("canvas"); canvas.width = (image as HTMLImageElement).width; canvas.height = (image as HTMLImageElement).height;
    const ctx = canvas.getContext("2d")!; ctx.filter = "saturate(1.3) hue-rotate(10deg)"; ctx.drawImage(image, 0, 0); const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = original.colorSpace; texture.flipY = original.flipY; this.texture = texture; return texture;
  }
  private resize(): void { const w = window.innerWidth, h = window.innerHeight, halfWidth = 7, halfHeight = 7 * h / w; this.camera.left = -halfWidth; this.camera.right = halfWidth; this.camera.top = halfHeight; this.camera.bottom = -halfHeight; this.camera.near = .1; this.camera.far = 100; this.camera.updateProjectionMatrix(); this.renderer.setSize(w, h); this.dirty = true; }
  private tap(event: PointerEvent): void {
    if (!this.enabled) return;
    const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(event.clientX / window.innerWidth * 2 - 1, 1 - event.clientY / window.innerHeight * 2), this.camera);
    for (const hit of ray.intersectObjects([...this.actors.values()].map(a => a.object), true)) { let object: THREE.Object3D | null = hit.object; while (object && !object.userData.id) object = object.parent; const id = object?.userData.id as string | undefined; if (id) { const actor = this.actors.get(id)!; this.moveTo(actor.hex, () => this.onInteract(id), true); return; } }
    const point = new THREE.Vector3(); if (!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), point)) return;
    let nearest: Hex | undefined; let distance = Infinity; for (const tile of this.walking.values()) { const d = world(tile).distanceToSquared(point); if (d < distance) { distance = d; nearest = tile; } } if (nearest && distance < 4) this.moveTo(nearest);
  }
  private moveTo(target: Hex, after?: () => void, adjacent = false): void {
    const queue: Hex[] = [this.position]; const prev = new Map<string, Hex | null>([[key(this.position), null]]); let found: Hex | undefined;
    for (let i = 0; i < queue.length; i++) { const current = queue[i]!; if (adjacent ? dirs.some(([q, r]) => current.q + q === target.q && current.r + r === target.r) || key(current) === key(target) : key(current) === key(target)) { found = current; break; } for (const [q, r] of dirs) { const next = { q: current.q + q, r: current.r + r }, k = key(next); if (this.walking.has(k) && !prev.has(k)) { prev.set(k, current); queue.push(next); } } }
    if (!found) return; const path: Hex[] = []; while (prev.get(key(found))) { path.unshift(found); found = prev.get(key(found))!; } this.path = path; this.afterMove = after; this.moving = true; this.dirty = true;
  }
  private tick(): void {
    if (this.moving) { const next = this.path[0]; if (next) { const dest = world(next), delta = dest.clone().sub(this.player.position); if (delta.length() < .09) { this.position = next; this.player.position.copy(dest); this.path.shift(); } else this.player.position.add(delta.normalize().multiplyScalar(.09)); } else { this.moving = false; const done = this.afterMove; this.afterMove = undefined; done?.(); } this.dirty = true; }
    if (this.dirty) { this.cameraTarget.lerp(this.player.position, .15); const following = this.cameraTarget.distanceToSquared(this.player.position) > .0001; if (!following) this.cameraTarget.copy(this.player.position); this.camera.position.copy(this.cameraTarget).add(new THREE.Vector3(10, 10 * Math.tan(THREE.MathUtils.degToRad(35)) * Math.sqrt(2), 10)); this.camera.lookAt(this.cameraTarget); this.renderer.render(this.scene, this.camera); this.dirty = following; }
    requestAnimationFrame(() => this.tick());
  }
}
