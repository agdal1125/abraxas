import * as THREE from "three";

type Material = { hz: number; damping: number; air: number; limit: number; wind: number };

// How each material moves. `hz` is how fast it swings back, `damping` how quickly the swing dies inside the joint,
// `air` how strongly still air holds it back (light cloth trails behind a walker, a heavy bag does not),
// `limit` the widest swing in radians and `wind` how much the breeze moves it.
const MATERIALS: Record<string, Material> = {
  cloth: { hz: 1.7, damping: .3, air: 5, limit: .85, wind: 1 },
  hair: { hz: 3.4, damping: .28, air: 1.5, limit: .5, wind: .35 },
  soft: { hz: 2.6, damping: .35, air: .5, limit: .3, wind: .15 },
  hang: { hz: 1.5, damping: .16, air: 0, limit: .6, wind: .05 },
  heavy: { hz: 3.6, damping: .5, air: 0, limit: .16, wind: 0 },
  shell: { hz: 6.5, damping: .4, air: 0, limit: .1, wind: 0 },
};
// The character generator names secondary bones sec_<material>_<part>_<length in mm>.
const NAME = /^sec_([a-z]+)_\w+_(\d{3})$/;
const WIND = new THREE.Vector3(1, 0, -.4).normalize().multiplyScalar(1.4);
const STEP = 1 / 120;

type Spring = { bone: THREE.Object3D; material: Material; length: number; rest: THREE.Quaternion; restAxis: THREE.Vector3; tip?: THREE.Vector3; target: THREE.Vector3; velocity: THREE.Vector3; phase: number };

/** Lets loosely attached parts lag behind the skeleton, each swinging the way its material would. */
export class SpringBones {
  private springs: Spring[] = [];
  private time = 0;

  constructor(root: THREE.Object3D, private breeze = true) {
    root.traverse(bone => {
      const match = NAME.exec(bone.name), material = match && MATERIALS[match[1]!];
      if (!match || !material) return;
      const rest = bone.quaternion.clone();
      this.springs.push({ bone, material, length: Number(match[2]) / 1000, rest, restAxis: new THREE.Vector3(0, 1, 0).applyQuaternion(rest), target: new THREE.Vector3(), velocity: new THREE.Vector3(), phase: this.springs.length * 1.7 });
    });
  }

  /** Call after the animation mixer has posed the skeleton for this frame. */
  update(dt: number): void {
    if (dt <= 0) return;
    this.time += dt;
    const head = new THREE.Vector3(), target = new THREE.Vector3(), parentTurn = new THREE.Quaternion(), force = new THREE.Vector3(), direction = new THREE.Vector3(), restDirection = new THREE.Vector3(), step = new THREE.Vector3();
    for (const spring of this.springs) {
      const { bone, material } = spring, parent = bone.parent!;
      parent.updateWorldMatrix(true, false);
      head.copy(bone.position).applyMatrix4(parent.matrixWorld);
      parent.getWorldQuaternion(parentTurn);
      restDirection.copy(spring.restAxis).applyQuaternion(parentTurn);
      target.copy(head).addScaledVector(restDirection, spring.length);
      // A first frame or a teleport starts at rest instead of whipping across the map.
      if (!spring.tip || spring.tip.distanceTo(target) > spring.length * 4) { spring.tip = target.clone(); spring.target.copy(target); spring.velocity.set(0, 0, 0); }
      const omega = material.hz * Math.PI * 2, targetVelocity = step.copy(target).sub(spring.target).divideScalar(dt).clone(), steps = Math.ceil(dt / STEP), h = dt / steps;
      const gust = this.breeze ? material.wind * (Math.sin(this.time * 1.3 + spring.phase) + .5 * Math.sin(this.time * 2.9 + spring.phase * 2)) : 0;
      for (let i = 1; i <= steps; i++) {
        step.copy(spring.target).lerp(target, i / steps);
        force.copy(step).sub(spring.tip).multiplyScalar(omega * omega)
          .addScaledVector(spring.velocity, -2 * material.damping * omega - material.air)
          .addScaledVector(targetVelocity, 2 * material.damping * omega)
          .addScaledVector(WIND, gust);
        spring.velocity.addScaledVector(force, h); spring.tip.addScaledVector(spring.velocity, h);
      }
      spring.target.copy(target);
      // The part is rigid: keep the tip on its arc and inside the swing limit.
      direction.copy(spring.tip).sub(head).normalize();
      const angle = restDirection.angleTo(direction);
      if (angle > material.limit) { step.crossVectors(restDirection, direction).normalize(); direction.copy(restDirection).applyAxisAngle(step, material.limit); spring.velocity.multiplyScalar(.5); }
      spring.tip.copy(head).addScaledVector(direction, spring.length);
      bone.quaternion.setFromUnitVectors(spring.restAxis, direction.applyQuaternion(parentTurn.invert())).multiply(spring.rest);
    }
  }
}
