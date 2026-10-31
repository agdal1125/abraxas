import * as THREE from "three";

export type CharacterState = "idle" | "walk" | "talk";

const materials = new Map<number, THREE.MeshStandardMaterial>();

function material(color: number): THREE.MeshStandardMaterial {
  let result = materials.get(color);
  if (!result) {
    result = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
    materials.set(color, result);
  }
  return result;
}

export function createCharacter(id: string): THREE.Group {
  const group = new THREE.Group();
  const figure = new THREE.Group();
  figure.name = "figure";
  group.add(figure);
  const colors: Record<string, number> = { A: 0xff7a59, B: 0xffb020, C: 0x8e6bff, D: 0x14b8a6, player: 0xfff8ec };
  const color = colors[id] ?? 0xa0a0a0;
  const cream = 0xfff8ec;
  const ink = 0x3b2a22;

  function mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, shade: number, x: number, y: number, z: number, name = ""): THREE.Mesh {
    const object = new THREE.Mesh(geometry, material(shade));
    object.position.set(x, y, z);
    object.name = name;
    parent.add(object);
    return object;
  }

  const bodyGeometry = id === "D" ? new THREE.BoxGeometry(0.27, 0.20, 0.15)
    : id === "C" ? new THREE.CylinderGeometry(0.07, 0.08, 0.20, 12)
      : id === "B" ? new THREE.CylinderGeometry(0.065, 0.13, 0.20, 12)
        : new THREE.SphereGeometry(0.115, 16, 12);
  const body = mesh(figure, bodyGeometry, color, 0, 0.225, 0, "body");
  if (id !== "B" && id !== "C" && id !== "D") body.scale.set(1, 0.9, 0.8);
  body.userData.baseScaleY = body.scale.y;

  const head = new THREE.Group();
  head.name = "head";
  head.position.set(0, 0.415, 0);
  figure.add(head);
  const radius = id === "C" ? 0.155 : 0.145;
  mesh(head, new THREE.SphereGeometry(radius, 20, 16), id === "player" ? color : cream, 0, 0, 0);
  if (id !== "player") {
    for (const side of [-1, 1]) {
      mesh(head, new THREE.SphereGeometry(0.009, 8, 6), ink, side * 0.047, 0.006, radius * 0.94, `eye${side}`);
    }
    mesh(head, new THREE.SphereGeometry(0.008, 8, 6), ink, 0, -0.035, radius * 0.97).scale.set(1.3, 0.45, 0.5);
  }

  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.name = `arm${side}`;
    arm.position.set(side * (id === "D" ? 0.15 : 0.115), 0.28, 0);
    figure.add(arm);
    mesh(arm, new THREE.CapsuleGeometry(0.025, 0.055, 4, 8), color, side * 0.015, -0.045, 0).rotation.z = side * 0.3;
    mesh(arm, new THREE.SphereGeometry(0.027, 10, 8), id === "player" ? color : cream, side * 0.03, -0.095, 0);
    const leg = new THREE.Group();
    leg.name = `leg${side}`;
    leg.position.set(side * 0.055, 0.13, 0);
    figure.add(leg);
    mesh(leg, new THREE.CapsuleGeometry(0.028, 0.045, 4, 8), color, 0, -0.045, 0);
    mesh(leg, new THREE.SphereGeometry(0.037, 10, 8), color, 0, -0.10114, 0.018).scale.set(1, 0.78, 1.3);
  }

  if (id === "A") {
    const arm = figure.getObjectByName("arm1")!;
    mesh(arm, new THREE.CylinderGeometry(0.006, 0.006, 0.17, 6), ink, 0.04, -0.035, 0.02);
    const flag = mesh(arm, new THREE.ConeGeometry(0.046, 0.075, 3), cream, 0.073, 0.025, 0.02);
    flag.rotation.z = -Math.PI / 2;
  } else if (id === "B") {
    mesh(figure, new THREE.BoxGeometry(0.15, 0.12, 0.015), cream, 0, 0.205, 0.097);
  } else if (id === "C") {
    for (const side of [-1, 1]) {
      mesh(head, new THREE.TorusGeometry(0.035, 0.004, 6, 16), ink, side * 0.047, 0.006, radius * 0.96);
    }
  } else if (id === "D") {
    const arm = figure.getObjectByName("arm1")!;
    mesh(arm, new THREE.CylinderGeometry(0.007, 0.007, 0.12, 6), ink, 0.03, -0.075, 0.02);
    mesh(arm, new THREE.BoxGeometry(0.08, 0.04, 0.04), 0x777777, 0.03, -0.015, 0.02);
  } else if (id === "player") {
    mesh(head, new THREE.SphereGeometry(0.15, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), 0xe9d7bb, 0, 0.015, 0);
    for (let i = 0; i < 4; i++) {
      const angle = i * Math.PI / 2;
      const point = mesh(head, new THREE.ConeGeometry(0.045, 0.045, 4), 0xe9d7bb, Math.cos(angle) * 0.115, 0.005, Math.sin(angle) * 0.115);
      point.rotation.z = Math.PI;
    }
  } else {
    mesh(head, new THREE.CylinderGeometry(0.07, 0.09, 0.045, 12), 0x777777, 0, 0.14, 0);
    mesh(head, new THREE.CylinderGeometry(0.105, 0.105, 0.012, 12), 0x777777, 0, 0.12, 0);
  }
  return group;
}

export function animateCharacter(group: THREE.Group, state: CharacterState, t: number, dt: number): void {
  const figure = group.getObjectByName("figure");
  const body = group.getObjectByName("body");
  const head = group.getObjectByName("head");
  if (!figure || !body || !head) return;
  const blend = 1 - Math.exp(-Math.max(0, dt) * 10);
  const walk = state === "walk";
  const swing = Math.sin(t * 9);
  figure.position.y = THREE.MathUtils.lerp(figure.position.y, walk ? 0.02 * (1 + Math.sin(t * 18)) / 2 : 0, blend);
  body.scale.y = THREE.MathUtils.lerp(body.scale.y, body.userData.baseScaleY * (state === "idle" ? 1 + 0.02 * Math.sin(t * Math.PI * 2 / 3) : 1), blend);
  head.rotation.x = THREE.MathUtils.lerp(head.rotation.x, state === "talk" ? 0.09 * Math.sin(t * 5) : 0, blend);
  for (const side of [-1, 1]) {
    const arm = group.getObjectByName(`arm${side}`);
    const leg = group.getObjectByName(`leg${side}`);
    if (arm) arm.rotation.x = THREE.MathUtils.lerp(arm.rotation.x, walk ? side * swing * 0.5 : 0, blend);
    if (leg) leg.rotation.x = THREE.MathUtils.lerp(leg.rotation.x, walk ? -side * swing * 0.5 : 0, blend);
    const eye = group.getObjectByName(`eye${side}`);
    if (eye) {
      const phase = ((t % 4) + 4) % 4;
      const blink = phase < 0.14 ? Math.abs(phase - 0.07) / 0.07 : 1;
      eye.scale.y = THREE.MathUtils.lerp(eye.scale.y, Math.max(0.08, blink), blend);
    }
  }
}
