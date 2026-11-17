import * as THREE from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import type { lumiView } from "../core/lumi-errand";
import type { echoView } from "../core/echo-errand";
import type { orView } from "../core/or-errand";

type Npc = "lumi" | "echo" | "or";
type Placement = { id: string; asset: string; x: number; z: number; rot?: number; scale?: number };
type View = ReturnType<typeof lumiView> | ReturnType<typeof echoView> | ReturnType<typeof orView>;
const extraKeys: Record<Npc, string[]> = {
  lumi: ["prop-lumi-horn", "prop-lumi-notice", "prop-lumi-material", "prop-lumi-score", ...["circle", "triangle", "square"].map(s => `prop-lumi-decoration-${s}`)],
  echo: ["prop-echo-book"],
  or: ["prop-or-bucket-empty", "prop-or-bucket-sand", "prop-or-bell", ...["circle", "triangle", "square"].map(s => `prop-or-gear-${s}`)]
};
const slots: Record<Npc, string[]> = {
  lumi: ["circle-1", "circle-2", "triangle-1", "triangle-2", "square-1", "square-2"],
  echo: ["plant-1", "plant-2", "cooking-1", "cooking-2", "stars-1", "stars-2"],
  or: ["axle-circle", "axle-triangle", "axle-square"]
};
const boards: Record<Npc, string> = { lumi: "lumi-decoration-board", echo: "echo-bookshelf", or: "or-clock-board" };

export class ResidentProps {
  private group = new THREE.Group();
  private pieces = new Map<string, THREE.Object3D>();
  private carried = new Map<string, THREE.Object3D>();
  private link?: THREE.Line;
  readonly objects = new Map<string, THREE.Object3D>();

  private constructor(private npc: Npc, scene: THREE.Scene, private player: THREE.Group, placements: Placement[], private models: Map<string, GLTF>) {
    scene.add(this.group);
    for (const p of placements) {
      const object = this.make(p.asset);
      object.position.set(p.x, 0, p.z); object.rotation.y = p.rot ?? 0; object.scale.setScalar(p.scale ?? 1);
      this.group.add(object); this.objects.set(p.id, object);
    }
    const carriedKeys = npc === "lumi" ? extraKeys.lumi.slice(0, 4) : npc === "or" ? extraKeys.or.slice(0, 3) : [];
    for (const key of carriedKeys) {
      const object = this.make(key); object.visible = false; this.carried.set(key, object);
    }
    if (npc === "lumi") {
      const mailbox = new THREE.Mesh(new THREE.BoxGeometry(.3, .23, .2), new THREE.MeshStandardMaterial({ color: "#d58a79" }));
      mailbox.position.y = .625; this.objects.get("lumi-mailbox")?.add(mailbox);
    }
    if (npc === "echo") {
      for (const id of ["book", "record", "notebook", "legend"]) {
        const object = this.make("prop-echo-book"); object.visible = false; this.carried.set(`echo:${id}`, object);
      }
      const door = this.objects.get("echo-attic-door");
      door?.traverse(child => { if (child instanceof THREE.Mesh) child.visible = false; });
      const panel = new THREE.Mesh(new THREE.BoxGeometry(.48, .8, .06), new THREE.MeshStandardMaterial({ color: "#ab8577" }));
      panel.position.y = .4; panel.castShadow = true; door?.add(panel);
      const glass = new THREE.Mesh(new THREE.BoxGeometry(.42, .3, .32), new THREE.MeshStandardMaterial({ color: "#c9e9ee", transparent: true, opacity: .22, depthWrite: false }));
      glass.position.y = .65; this.objects.get("echo-glass-case")?.add(glass);
    }
    const board = this.objects.get(boards[npc]);
    if (!board) throw new Error(`Missing resident board: ${boards[npc]}`);
    slots[npc].forEach((slot, i) => {
      const shape = npc === "lumi" ? slot.split("-")[0] : slot.slice(5);
      const key = npc === "lumi" ? `prop-lumi-decoration-${shape}` : npc === "echo" ? "prop-echo-book" : `prop-or-gear-${shape}`;
      const piece = this.make(key); piece.name = `piece:${slot}`; piece.visible = false;
      if (npc === "or") { piece.scale.setScalar(.55); piece.position.set((i - 1) * .2, .085, 0); }
      else { piece.scale.setScalar(npc === "echo" ? .5 : .85); piece.position.set((i % 3 - 1) * .2, .095, i < 3 ? -.1 : .1); }
      board.add(piece); this.pieces.set(slot, piece);
    });
    if (npc === "or") {
      const diagram = this.objects.get("or-lantern-link");
      if (!diagram) throw new Error("Missing lantern diagram");
      const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-.18, .1, 0), new THREE.Vector3(0, .1, -.1), new THREE.Vector3(.18, .1, 0)]);
      this.link = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: "#d99c64" })); this.link.name = "lantern-link"; this.link.visible = false; diagram.add(this.link);
    }
    this.group.visible = false;
  }

  static async load(npc: Npc, scene: THREE.Scene, player: THREE.Group, placements: Placement[], load: (key: string) => Promise<GLTF>): Promise<ResidentProps> {
    const residentPlacements = placements.filter(p => p.id.startsWith(`${npc}-`));
    const keys = new Set([...residentPlacements.map(p => p.asset), ...extraKeys[npc]]);
    const models = new Map(await Promise.all([...keys].map(async key => [key, await load(key)] as const)));
    return new ResidentProps(npc, scene, player, residentPlacements, models);
  }

  private make(key: string): THREE.Object3D {
    const model = this.models.get(key); if (!model) throw new Error(`Missing resident model: ${key}`);
    const object = clone(model.scene);
    object.traverse(child => { if (child instanceof THREE.Mesh) { child.castShadow = true; child.receiveShadow = true; } });
    return object;
  }

  setView(view: View | null): void {
    this.group.visible = !!view && view.phase !== "locked";
    for (const object of this.carried.values()) { object.visible = false; object.removeFromParent(); }
    if (!view || !this.group.visible) return;
    for (const [id, object] of this.objects) object.visible = view.activeTargetIds.includes(id);
    const board = this.objects.get(boards[this.npc])!;
    board.visible = board.visible || Object.keys(view.placements).length > 0;
    for (const [slot, object] of this.pieces) object.visible = Object.hasOwn(view.placements, slot);
    if (this.npc === "lumi") this.setLumi(view as ReturnType<typeof lumiView>);
    else if (this.npc === "echo") this.setEcho(view as ReturnType<typeof echoView>);
    else this.setOr(view as ReturnType<typeof orView>);
  }

  private move(key: string, location: string, destination: string): void {
    const object = this.carried.get(key)!;
    if (location === "player") { this.player.add(object); object.position.set(.24, .35, .34); object.scale.setScalar(.7); object.visible = true; }
    else if (location === `${this.npc}-rest` || location === "delivered") {
      const target = this.objects.get(location === "delivered" ? destination : `${this.npc}-rest`);
      if (target) { target.add(object); object.position.set(0, .51, 0); object.scale.setScalar(.8); object.visible = true; target.visible = true; }
    }
  }

  private setLumi(view: ReturnType<typeof lumiView>): void {
    const notice = view.choices[2] === "a" ? "prop-lumi-horn" : "prop-lumi-notice";
    for (const [id, sources] of Object.entries({ notice: ["lumi-horn", "lumi-notices"], material: ["lumi-ribbon-source", "lumi-field-source"], score: ["lumi-score-new", "lumi-score-old"] })) {
      if (view.objects[id as keyof typeof view.objects] !== "source") for (const source of sources) this.objects.get(source)!.visible = false;
    }
    for (const [id, object] of Object.entries(view.objects)) {
      const key = id === "notice" ? notice : `prop-lumi-${id}`;
      const destination = id === "notice" ? "lumi-notice-return" : id === "material" ? "lumi-stage-workbench" : "lumi-musician-stand";
      this.move(key, object, destination);
    }
  }

  private setEcho(view: ReturnType<typeof echoView>): void {
    const destinations: Record<string, string> = { book: "echo-story", record: "echo-reading-desk", notebook: view.choices[2] === "a" ? "echo-cooking-shelf" : "echo-story-table", legend: view.choices[5] === "a" ? "echo-glass-case" : "echo-open-display" };
    slots.echo.forEach((slot, i) => {
      const piece = this.pieces.get(slot)!;
      piece.position.set(view.choices[3] === "a" ? (Math.floor(i / 2) - 1) * .2 : (i % 3 - 1) * .2, .095, view.choices[3] === "a" ? (i % 2 ? .1 : -.1) : (i < 3 ? -.1 : .1));
    });
    for (const [id, sources] of Object.entries({ book: ["echo-picture-book"], record: ["echo-history-record", "echo-attic-record"], notebook: ["echo-notebook"], legend: ["echo-legend"] })) {
      if (view.objects[id as keyof typeof view.objects] !== "source") for (const source of sources) this.objects.get(source)!.visible = false;
    }
    // Each delivered book uses its own clone so several destinations remain visible.
    for (const [id, location] of Object.entries(view.objects)) this.moveEcho(id, location, destinations[id]!);
  }

  private moveEcho(id: string, location: string, destination: string): void {
    const key = `echo:${id}`; const object = this.carried.get(key)!;
    object.visible = false; object.removeFromParent();
    if (location === "player") { this.player.add(object); object.position.set(.24, .35, .34); object.scale.setScalar(.7); object.visible = true; }
    else if (location === "echo-rest" || location === "delivered") {
      const target = this.objects.get(location === "delivered" ? destination : "echo-rest");
      if (target) { target.add(object); object.position.set(0, location === "delivered" && destination === "echo-cooking-shelf" ? .3 : location === "delivered" && destination === "echo-story" ? .45 : .51, 0); object.scale.setScalar(.8); object.visible = true; target.visible = true; }
    }
  }

  private setOr(view: ReturnType<typeof orView>): void {
    const filled = !["find_sand", "sand"].includes(view.phase);
    if (view.objects.bucket !== "source") this.objects.get("or-bucket")!.visible = false;
    const bell = this.objects.get("or-bell")!;
    if (view.objects.bell !== "source") bell.visible = false;
    else if (view.phase === "completed" || view.phase === "report") bell.visible = view.choices[5] === "a";
    this.move(filled ? "prop-or-bucket-sand" : "prop-or-bucket-empty", view.objects.bucket, "or-grinding-bench");
    this.move("prop-or-bell", view.objects.bell, "or-plaza-stand");
    if (this.link) this.link.visible = ["choose_05", "hook", "choose_06", "finish", "bell_delivery", "report", "completed"].includes(view.phase);
    const diagram = this.objects.get("or-lantern-link")!; diagram.visible ||= !!this.link?.visible;
  }
}
