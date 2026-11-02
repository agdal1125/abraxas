import * as THREE from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import type { MokaView, SlotId } from "../core/moka-errand";

type Placement = { id: string; asset: string; x: number; z: number; rot?: number };
const keys = [...["basket", "display", "bread-round", "bread-long", "bread-flower", "dropoff", "ledger", "plate", "mold"].map(key => `prop-moka-${key}`), "quest-npc"];

export class MokaProps {
  private group = new THREE.Group();
  private basket: THREE.Object3D;
  private extras = new THREE.Group();
  readonly objects = new Map<string, THREE.Object3D>();

  private constructor(scene: THREE.Scene, private player: THREE.Group, private placements: Placement[], private models: Map<string, GLTF>) {
    scene.add(this.group);
    for (const placement of placements) {
      if (placement.id === "moka-basket-source") continue;
      const object = this.make(placement.asset);
      object.position.set(placement.x, 0, placement.z); object.rotation.y = placement.rot ?? 0;
      this.group.add(object); this.objects.set(placement.id, object);
    }
    const source = this.point("moka-basket-source");
    const stand = this.make("prop-moka-dropoff"); stand.position.set(source.x, 0, source.z); this.group.add(stand);
    this.group.add(this.extras);
    this.basket = this.make("prop-moka-basket");
    this.objects.set("moka-basket-source", this.basket);
  }

  static async load(scene: THREE.Scene, player: THREE.Group, placements: Placement[], load: (key: string) => Promise<GLTF>): Promise<MokaProps> {
    const models = new Map(await Promise.all(keys.map(async key => [key, await load(key)] as const)));
    return new MokaProps(scene, player, placements, models);
  }

  private make(key: string): THREE.Object3D {
    const object = clone(this.models.get(key)!.scene);
    object.traverse(child => { if (child instanceof THREE.Mesh) { child.castShadow = true; child.receiveShadow = true; } });
    return object;
  }
  private point(id: string): Placement { return this.placements.find(p => p.id === id)!; }

  setView(view: MokaView | null): void {
    this.group.visible = !!view && view.phase !== "locked";
    this.basket.removeFromParent();
    this.extras.clear();
    if (!this.group.visible || !view) return;
    for (const [id, object] of this.objects) if (!["moka-display", "moka-rest", "moka-workshop-dropoff", "moka-basket-source", "moka-tired-neighbor"].includes(id)) object.visible = view.activeTargetIds.includes(id);
    if (view.basket === "player") {
      this.player.add(this.basket); this.basket.position.set(0, .3, .5); this.basket.scale.setScalar(.65);
    } else {
      const point = this.point(view.basket === "source" ? "moka-basket-source" : view.basket === "moka-rest" ? "moka-rest" : "moka-workshop-dropoff");
      this.group.add(this.basket); this.basket.position.set(point.x, .51, point.z); this.basket.scale.setScalar(1);
    }
    const base = this.point("moka-display");
    if (view.display === "high") for (const height of [.29, .58]) {
      const tier = this.make("prop-moka-display"); tier.position.set(base.x, height, base.z); this.extras.add(tier);
    }
    const slots: SlotId[] = ["walnut-left", "walnut-right", "roll-left", "roll-right", "flower-left", "flower-right"];
    slots.forEach((slot, index) => {
      const bread = view.placements[slot]; if (!bread) return;
      const key = bread.startsWith("walnut") ? "bread-round" : bread.startsWith("roll") ? "bread-long" : "bread-flower";
      const object = this.make(`prop-moka-${key}`); object.scale.setScalar(.45);
      const tier = view.display === "high" ? Math.floor(index / 2) : 0;
      const front = view.display === "high" ? (2 - tier) * .08 : 0;
      object.position.set(base.x + (view.display === "high" ? (index % 2 ? .15 : -.15) : (index - 2.5) * .13) + front, .345 + tier * .29, base.z + front);
      this.extras.add(object);
    });
  }
}
