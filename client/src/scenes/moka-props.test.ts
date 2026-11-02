import { describe, expect, it } from "vitest";
import * as THREE from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import type { MokaView } from "../core/moka-errand";
import { MokaProps } from "./moka-props";

describe("moka props", () => {
  it("restores the basket, display and placed bread from the confirmed view", async () => {
    const scene = new THREE.Scene(), player = new THREE.Group();
    const placements = [
      { id: "moka-basket-source", asset: "prop-moka-basket", x: 1, z: 1 },
      { id: "moka-display", asset: "prop-moka-display", x: 2, z: 2 },
      { id: "moka-rest", asset: "prop-moka-dropoff", x: 3, z: 3 },
      { id: "moka-workshop-dropoff", asset: "prop-moka-dropoff", x: 4, z: 4 },
    ];
    const props = await MokaProps.load(scene, player, placements, async () => ({ scene: new THREE.Group() }) as GLTF);
    const view: MokaView = { phase: "deliver", basket: "player", placements: { "walnut-left": "walnut-1" }, objectiveKey: "", activeTargetIds: [], resumePointId: null, route: "gentle", display: "high" };
    const basket = props.objects.get("moka-basket-source")!;
    props.setView(view);
    expect(basket.parent).toBe(player);
    expect(basket.position.toArray()).toEqual([0, .3, .5]);
    expect(basket.scale.x).toBe(.65);
    const group = scene.children[0]!;
    expect(group.children.at(-1)!.children).toHaveLength(3);
    props.setView({ ...view, basket: "moka-rest", display: "low" });
    expect(basket.position.toArray()).toEqual([3, .51, 3]);
    expect(basket.scale.x).toBe(1);
    expect(group.children.find(child => child.children.length === 1)).toBeDefined();
    props.setView({ ...view, basket: "delivered" });
    expect(basket.position.toArray()).toEqual([4, .51, 4]);
    props.setView(null);
    expect(basket.parent).toBeNull();
    expect(group.visible).toBe(false);
  });
});
