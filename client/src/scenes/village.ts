import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { createCharacter, animateCharacter } from "./characters";
import { addDecor, type Decor } from "./decor";

type Hex = { q: number; r: number };
type MapData = { hexSize: number; tiles: (Hex & { model: string; walk: boolean })[]; props: (Hex & { model: string; rot?: number; scale?: number })[]; decor?: Decor[]; zones: Record<string, Hex>; actors: ({ id: string; zone?: string } & Partial<Hex>)[] };
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
  private player = createCharacter("player");
  private position = map.zones.entrance ?? { q: 0, r: 0 };
  private path: Hex[] = [];
  private afterMove: (() => void) | undefined;
  private moving = false;
  private dirty = true;
  private cameraTarget = new THREE.Vector3();
  private enabled = false;
  private talking?: string;
  private lastTime = 0;
  private elapsed = 0;
  private rippleTime = 0;
  private ripple = new THREE.Mesh(new THREE.RingGeometry(.08, .095, 32), new THREE.MeshBasicMaterial({ color: 0xfff8ec, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  private shadowMaterial = this.makeShadow();
  onInteract: (id: string) => void = () => {};

  constructor(app: HTMLElement) {
    this.scene.background = new THREE.Color("#5bc0f8");
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xb3c4a3, 1.25));
    const light = new THREE.DirectionalLight(0xffffff, 1.1); light.position.set(4, 10, 5); this.scene.add(light);
    // NoToneMapping preserves the palette's bright, saturated colors.
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); app.append(this.renderer.domElement);
    for (const prop of map.props) this.walking.delete(key(prop));
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), new THREE.MeshBasicMaterial({ color: 0x5bc0f8 })); sea.rotation.x = -Math.PI / 2; sea.position.y = -.2; this.scene.add(sea);
    void this.loader.loadAsync("./assets/kaykit/medieval/hex_grass.gltf").then(gltf => {
      gltf.scene.traverse(object => {
        if (!(object instanceof THREE.Mesh) || !(object.material instanceof THREE.MeshStandardMaterial) || !object.material.map) return;
        const texture = this.brightTexture(object.material.map), uv = object.geometry.getAttribute("uv"), normal = object.geometry.getAttribute("normal");
        for (let i = 0; i < normal.count; i++) if (normal.getY(i) > .9) {
          const image = texture.image as HTMLCanvasElement, pixel = image.getContext("2d")!.getImageData(Math.floor(uv.getX(i) * image.width), Math.floor(uv.getY(i) * image.height), 1, 1).data;
          this.addGround(`rgb(${pixel[0]},${pixel[1]},${pixel[2]})`); this.dirty = true; break;
        }
      });
    }).catch(() => { this.addGround("#5cc96b"); this.dirty = true; });
    for (const tile of map.tiles) if (!tile.model.includes("hex_water") && tile.model !== "medieval/hex_grass" && !tile.model.startsWith("medieval/hex_road_")) this.placeModel(tile.model, tile);
    for (const prop of map.props) this.placeModel(prop.model, prop, prop.rot, prop.scale, true);
    const vegetation: Decor[] = [];
    let seed = 1937; const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    const protectedCenters = [...map.tiles.filter(t => t.model.startsWith("medieval/hex_road_")), ...map.actors.flatMap(a => { const h = a.zone ? map.zones[a.zone] : a.q !== undefined && a.r !== undefined ? { q: a.q, r: a.r } : undefined; return h ? [h] : []; })].map(world);
    for (const tile of map.tiles) if (tile.model === "medieval/hex_grass" && this.walking.has(key(tile))) {
      const origin = world(tile), grass = 4 + Math.floor(random() * 4), flowers = Math.floor(random() * 3);
      for (let i = 0; i < grass + flowers; i++) {
        let dx: number, dz: number;
        do { dx = (random() * 2 - 1) * .8; dz = (random() * 2 - 1) * .7; } while (protectedCenters.some(p => (p.x - origin.x - dx) ** 2 + (p.z - origin.z - dz) ** 2 < .35 ** 2));
        vegetation.push({ ...tile, kind: i < grass ? "grass_tuft" : ["flowers_white", "flowers_yellow", "flowers_pink"][Math.floor(random() * 3)]!, dx, dz, rot: random() * Math.PI * 2, scale: i < grass ? .65 + random() * .3 : .25 + random() * .15 });
      }
    }
    addDecor(this.scene, [...(map.decor ?? []), ...vegetation], world, entry => this.placeModel(entry.kind.slice(6), entry, entry.rot, entry.scale, true, false, entry.dx, entry.dz));
    this.player.position.copy(world(this.position)); this.cameraTarget.copy(this.player.position); this.scene.add(this.player); this.addShadow(this.player);
    this.ripple.rotation.x = -Math.PI / 2; this.ripple.visible = false; this.scene.add(this.ripple);
    for (const actor of map.actors) {
      const hex = actor.zone ? map.zones[actor.zone] : actor.q !== undefined && actor.r !== undefined ? { q: actor.q, r: actor.r } : undefined;
      if (!hex) continue;
      const object = createCharacter(actor.id); object.position.copy(world(hex)); object.userData.id = actor.id;
      const marker = this.label("!", .95); object.add(marker);
      if (!"ABCD".includes(actor.id)) object.add(this.label(actor.id, .72));
      this.scene.add(object); this.addShadow(object); this.actors.set(actor.id, { hex, object, marker });
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
  setEnabled(value: boolean): void { this.enabled = value; if (value) this.talking = undefined; else { this.path = []; this.moving = false; this.afterMove = undefined; } this.dirty = true; }
  setAvailable(ids: string[]): void { for (const [id, actor] of this.actors) actor.marker.visible = ids.includes(id); this.dirty = true; }
  private addGround(grassColor: string): void {
    const land = map.tiles.filter(t => !t.model.includes("hex_water")); if (!land.length) return;
    const points = land.map(world), minX = Math.min(...points.map(p => p.x)) - 1, maxX = Math.max(...points.map(p => p.x)) + 1, minZ = Math.min(...points.map(p => p.z)) - HEX, maxZ = Math.max(...points.map(p => p.z)) + HEX;
    const canvas = document.createElement("canvas"); const span = Math.max(maxX - minX, maxZ - minZ); canvas.width = Math.round(2048 * (maxX - minX) / span); canvas.height = Math.round(2048 * (maxZ - minZ) / span); const ctx = canvas.getContext("2d")!;
    const x = (n: number) => (n - minX) / (maxX - minX) * canvas.width, z = (n: number) => (n - minZ) / (maxZ - minZ) * canvas.height, unit = canvas.width / (maxX - minX);
    ctx.beginPath(); for (const p of points) { for (let i = 0; i < 6; i++) { const a = Math.PI / 3 * i; const px = x(p.x + Math.sin(a) * HEX), pz = z(p.z + Math.cos(a) * HEX); if (!i) ctx.moveTo(px, pz); else ctx.lineTo(px, pz); } ctx.closePath(); } ctx.clip();
    ctx.fillStyle = grassColor; ctx.fillRect(0, 0, canvas.width, canvas.height);
    let seed = 7123; const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < 180; i++) { const px = random() * canvas.width, pz = random() * canvas.height, radius = (1 + random() * 2) * unit; const gradient = ctx.createRadialGradient(px, pz, 0, px, pz, radius); gradient.addColorStop(0, i % 2 ? "rgba(255,255,255,.09)" : "rgba(0,0,0,.08)"); gradient.addColorStop(1, "rgba(255,255,255,0)"); ctx.fillStyle = gradient; ctx.fillRect(px - radius, pz - radius, radius * 2, radius * 2); }
    for (let i = 0; i < 9000; i++) { const px = random() * canvas.width, pz = random() * canvas.height; ctx.strokeStyle = i % 2 ? "rgba(0,0,0,.16)" : "rgba(255,255,255,.18)"; ctx.lineWidth = 1 + random() * 2; ctx.beginPath(); ctx.moveTo(px, pz); ctx.lineTo(px + (random() - .5) * 5, pz - 3 - random() * 7); ctx.stroke(); }
    const roads = map.tiles.filter(t => t.model.startsWith("medieval/hex_road_")), roadKeys = new Set(roads.map(key));
    ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#e8b46a"; ctx.fillStyle = "#e8b46a"; ctx.shadowColor = "#e8b46a"; ctx.shadowBlur = unit * .22; ctx.lineWidth = unit * .55;
    const edge = (a: Hex, b: Hex) => [key(a), key(b)].sort().join("|");
    for (const road of roads) for (const [dq, dr] of dirs.slice(0, 3)) {
      const next = { q: road.q + dq, r: road.r + dr }; if (!roadKeys.has(key(next))) continue;
      const currentEdge = edge(road, next);
      const omit = dirs.some(([q, r]) => {
        const third = { q: road.q + q, r: road.r + r };
        return roadKeys.has(key(third)) && dirs.some(([nq, nr]) => next.q + nq === third.q && next.r + nr === third.r)
          && currentEdge > edge(road, third) && currentEdge > edge(next, third);
      });
      if (omit) continue;
      const p = world(road), n = world(next); ctx.beginPath(); ctx.moveTo(x(p.x), z(p.z)); ctx.lineTo(x(n.x), z(n.z)); ctx.stroke();
    }
    ctx.shadowBlur = 0; for (const road of roads) { const p = world(road); for (let i = 0; i < 5; i++) { ctx.fillStyle = i % 2 ? "rgba(130,100,73,.32)" : "rgba(255,240,201,.55)"; ctx.beginPath(); ctx.ellipse(x(p.x + (random() - .5) * .65), z(p.z + (random() - .5) * .65), 1 + random() * 2, 1 + random() * 1.5, 0, 0, Math.PI * 2); ctx.fill(); } }
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(maxX - minX, maxZ - minZ), new THREE.MeshStandardMaterial({ map: texture, transparent: true, roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.position.set((minX + maxX) / 2, 0, (minZ + maxZ) / 2); this.scene.add(ground);
  }
  private label(text: string, y: number): THREE.Sprite {
    const canvas = document.createElement("canvas"); canvas.width = text === "!" ? 128 : 512; canvas.height = 128; const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = text === "!" ? "#FFD23F" : "#ffffff"; ctx.beginPath(); if (text === "!") ctx.arc(64, 64, 60, 0, Math.PI * 2); else ctx.roundRect(0, 0, 512, 128, 24); ctx.fill();
    ctx.fillStyle = "#3B2A22"; ctx.font = text === "!" ? "bold 96px sans-serif" : "bold 56px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(text, canvas.width / 2, 68);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true })); sprite.scale.set(text === "!" ? .25 : .55, text === "!" ? .25 : .14, 1); sprite.position.y = y; sprite.userData.baseY = y; return sprite;
  }
  private makeShadow(): THREE.MeshBasicMaterial {
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 128;
    const ctx = canvas.getContext("2d")!; const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, "rgba(38,30,23,0.32)"); gradient.addColorStop(1, "rgba(38,30,23,0)");
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
    return new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false });
  }
  private addShadow(object: THREE.Object3D): void {
    object.updateWorldMatrix(true, true); const box = new THREE.Box3().setFromObject(object); const size = box.getSize(new THREE.Vector3());
    if (box.isEmpty()) return;
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.shadowMaterial); shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(0, .015, 0); shadow.scale.set(Math.max(.3, size.x * 1.1) / object.scale.x, Math.max(.3, size.z * 1.1) / object.scale.z, 1); shadow.raycast = () => {}; object.add(shadow);
  }
  private placeModel(model: string, hex: Hex, rot = 0, scale = 1, shadow = false, grass = false, dx = 0, dz = 0): void {
    if (!this.models.has(model)) this.models.set(model, this.loader.loadAsync(`./assets/kaykit/${model}.gltf`).then(gltf => {
      if (model.startsWith("medieval/")) gltf.scene.traverse(object => { if (object instanceof THREE.Mesh) { const materials = Array.isArray(object.material) ? object.material : [object.material]; for (const material of materials) if (material instanceof THREE.MeshStandardMaterial && material.map) material.map = this.brightTexture(material.map); } });
      return gltf.scene;
    }));
    void this.models.get(model)!.then(source => {
      const object = source.clone(); object.position.copy(world(hex)).add(new THREE.Vector3(dx, 0, dz)); object.rotation.y = rot; object.scale.setScalar(scale * (({ medieval: 1, city: .6, furniture: .25, restaurant: .12 } as Record<string, number>)[model.split("/")[0]!] ?? 1));
      if (grass) { const hash = Math.abs(Math.sin(hex.q * 127.1 + hex.r * 311.7) * 43758.5453) % 1; object.traverse(child => { if (child instanceof THREE.Mesh) { const tint = (material: THREE.Material) => { const copy = material.clone(); if (copy instanceof THREE.MeshStandardMaterial) copy.color.multiplyScalar(.96 + hash * .08); return copy; }; child.material = Array.isArray(child.material) ? child.material.map(tint) : tint(child.material); } }); }
      this.scene.add(object); if (shadow) this.addShadow(object); this.dirty = true;
    }).catch(() => { this.dirty = true; });
  }
  private texture?: THREE.Texture;
  private brightTexture(original: THREE.Texture): THREE.Texture {
    if (this.texture) return this.texture;
    const image = original.image as CanvasImageSource; const canvas = document.createElement("canvas"); canvas.width = (image as HTMLImageElement).width; canvas.height = (image as HTMLImageElement).height;
    const ctx = canvas.getContext("2d")!; ctx.filter = "saturate(1.3) hue-rotate(10deg)"; ctx.drawImage(image, 0, 0); const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = original.colorSpace; texture.flipY = original.flipY; this.texture = texture; return texture;
  }
  private resize(): void { const w = window.innerWidth, h = window.innerHeight, halfHeight = 2.4, halfWidth = halfHeight * w / h; this.camera.left = -halfWidth; this.camera.right = halfWidth; this.camera.top = halfHeight; this.camera.bottom = -halfHeight; this.camera.near = .1; this.camera.far = 100; this.camera.updateProjectionMatrix(); this.renderer.setSize(w, h); this.dirty = true; }
  private tap(event: PointerEvent): void {
    if (!this.enabled) return;
    const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(event.clientX / window.innerWidth * 2 - 1, 1 - event.clientY / window.innerHeight * 2), this.camera);
    for (const hit of ray.intersectObjects([...this.actors.values()].map(a => a.object), true)) { let object: THREE.Object3D | null = hit.object; while (object && !object.userData.id) object = object.parent; const id = object?.userData.id as string | undefined; if (id) { const actor = this.actors.get(id)!; this.moveTo(actor.hex, () => { const delta = actor.object.position.clone().sub(this.player.position); if (delta.lengthSq() > .0001) { this.player.rotation.y = Math.atan2(delta.x, delta.z); actor.object.rotation.y = Math.atan2(-delta.x, -delta.z); } this.talking = id; this.onInteract(id); }, true); return; } }
    const point = new THREE.Vector3(); if (!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), point)) return;
    let nearest: Hex | undefined; let distance = Infinity; for (const tile of this.walking.values()) { const d = world(tile).distanceToSquared(point); if (d < distance) { distance = d; nearest = tile; } } if (nearest && distance < 4) { this.ripple.position.set(point.x, .04, point.z); this.rippleTime = .4; this.ripple.visible = true; this.moveTo(nearest); }
  }
  private moveTo(target: Hex, after?: () => void, adjacent = false): void {
    const queue: Hex[] = [this.position]; const prev = new Map<string, Hex | null>([[key(this.position), null]]); let found: Hex | undefined;
    for (let i = 0; i < queue.length; i++) { const current = queue[i]!; if (adjacent ? dirs.some(([q, r]) => current.q + q === target.q && current.r + r === target.r) || key(current) === key(target) : key(current) === key(target)) { found = current; break; } for (const [q, r] of dirs) { const next = { q: current.q + q, r: current.r + r }, k = key(next); if (this.walking.has(k) && !prev.has(k)) { prev.set(k, current); queue.push(next); } } }
    if (!found) return; const path: Hex[] = []; while (prev.get(key(found))) { path.unshift(found); found = prev.get(key(found))!; } this.path = path; this.afterMove = after; this.moving = true; this.dirty = true;
  }
  private tick(): void {
    const now = performance.now() / 1000; const dt = this.lastTime ? Math.min(now - this.lastTime, .1) : 0; this.lastTime = now; this.elapsed += dt;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (this.moving) {
      const next = this.path[0];
      if (next) {
        const dest = world(next), delta = dest.clone().sub(this.player.position), distance = delta.length();
        if (distance <= 2.2 * dt) { this.position = next; this.player.position.copy(dest); this.path.shift(); }
        else { this.player.position.addScaledVector(delta, 2.2 * dt / distance); this.player.rotation.y = Math.atan2(delta.x, delta.z); }
      } else { this.moving = false; const done = this.afterMove; this.afterMove = undefined; done?.(); }
      this.dirty = true;
    }
    animateCharacter(this.player, this.moving ? "walk" : "idle", this.elapsed, dt);
    const inView = (object: THREE.Object3D) => { const p = object.getWorldPosition(new THREE.Vector3()).project(this.camera); return Math.abs(p.x) < 1.2 && Math.abs(p.y) < 1.2 && Math.abs(p.z) <= 1; };
    if (inView(this.player) && !reducedMotion) this.dirty = true;
    for (const [id, { object, marker }] of this.actors) {
      if (object.getObjectByName("figure") && inView(object)) {
        animateCharacter(object, !this.enabled && this.talking === id ? "talk" : "idle", this.elapsed, dt);
        if (!reducedMotion) this.dirty = true;
      }
      if (marker.visible && inView(marker) && !reducedMotion) { marker.position.y = marker.userData.baseY + Math.sin(this.elapsed * Math.PI * 2 / 1.6) * .03; this.dirty = true; }
      else if (marker.position.y !== marker.userData.baseY) { marker.position.y = marker.userData.baseY; this.dirty = true; }
    }
    if (this.rippleTime > 0) { this.rippleTime = Math.max(0, this.rippleTime - dt); const progress = 1 - this.rippleTime / .4; this.ripple.scale.setScalar(1 + progress * 2); this.ripple.material.opacity = 1 - progress; this.ripple.visible = this.rippleTime > 0; this.dirty = true; }
    if (this.dirty) {
      const bounds = map.tiles.map(world); const minX = Math.min(...bounds.map(p => p.x)), maxX = Math.max(...bounds.map(p => p.x)), minZ = Math.min(...bounds.map(p => p.z)), maxZ = Math.max(...bounds.map(p => p.z));
      const follow = this.player.position.clone(); follow.x = THREE.MathUtils.clamp(follow.x, minX, maxX); follow.z = THREE.MathUtils.clamp(follow.z, minZ, maxZ);
      this.cameraTarget.lerp(follow, 1 - Math.exp(-dt * 10)); const following = this.cameraTarget.distanceToSquared(follow) > .0001; if (!following) this.cameraTarget.copy(follow);
      const target = this.cameraTarget.clone().add(new THREE.Vector3(1, -Math.sqrt(2) / Math.tan(THREE.MathUtils.degToRad(35)), 1).normalize().multiplyScalar(this.camera.top * .2));
      this.camera.position.copy(target).add(new THREE.Vector3(10, 10 * Math.tan(THREE.MathUtils.degToRad(35)) * Math.sqrt(2), 10)); this.camera.lookAt(target); this.renderer.render(this.scene, this.camera); this.dirty = following;
    }
    requestAnimationFrame(() => this.tick());
  }
}
