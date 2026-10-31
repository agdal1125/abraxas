import * as THREE from "three";

export type Decor = { q: number; r: number; kind: string; dx?: number; dz?: number; rot?: number; scale?: number };

export function addDecor(scene: THREE.Scene, entries: Decor[], world: (hex: Decor) => THREE.Vector3, model: (entry: Decor) => void): void {
  const colors: Record<string, number> = { red: 0xff5a5f, yellow: 0xffd23f, white: 0xfff8ec, pink: 0xff7eb6, purple: 0x9b7bff };
  const grouped = new Map<string, Decor[]>();
  for (const entry of entries) {
    if (entry.kind.startsWith("model:")) { model(entry); continue; }
    const list = grouped.get(entry.kind) ?? []; list.push(entry); grouped.set(entry.kind, list);
  }
  for (const [kind, list] of grouped) {
    const parts: { geometry: THREE.BufferGeometry; color: number; x: number; y: number; z: number; rotation?: number; sx?: number; sy?: number; sz?: number }[] = [];
    const flower = colors[kind.slice(8)];
    if (kind.startsWith("flowers_") && flower !== undefined) {
      for (let i = 0; i < 4; i++) {
        const x = (i % 2 - .5) * .12, z = (Math.floor(i / 2) - .5) * .12, y = .14 + i % 2 * .035;
        parts.push({ geometry: new THREE.CylinderGeometry(.008, .008, y, 5), color: 0x6d9b55, x, y: y / 2, z });
        for (let p = 0; p < 5; p++) { const a = p * Math.PI * 2 / 5; parts.push({ geometry: new THREE.SphereGeometry(.028, 6, 4), color: flower, x: x + Math.cos(a) * .027, y, z: z + Math.sin(a) * .027, sy: .35 }); }
      }
    } else if (kind === "grass_tuft") {
      for (let i = 0; i < 5; i++) parts.push({ geometry: new THREE.ConeGeometry(.022, .18, 5), color: 0x79a85c, x: Math.cos(i * 2.4) * .06, y: .09, z: Math.sin(i * 2.4) * .06, rotation: (i - 2) * .12 });
    } else if (kind === "pebbles") {
      for (let i = 0; i < 4; i++) parts.push({ geometry: new THREE.SphereGeometry(.07, 8, 6), color: 0xaaa69b, x: (i % 2 - .5) * .14, y: .025, z: (Math.floor(i / 2) - .5) * .1, sy: .4 });
    } else if (kind === "mushroom") {
      for (const x of [-.06, .06]) { parts.push({ geometry: new THREE.CylinderGeometry(.025, .03, .1, 8), color: 0xfff8ec, x, y: .05, z: 0 }); parts.push({ geometry: new THREE.SphereGeometry(.075, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), color: 0xd67e67, x, y: .1, z: 0, sy: .6 }); }
    } else if (kind === "log") parts.push({ geometry: new THREE.CylinderGeometry(.08, .08, .35, 10), color: 0x946b48, x: 0, y: .08, z: 0, rotation: Math.PI / 2 });
    for (const part of parts) {
      const mesh = new THREE.InstancedMesh(part.geometry, new THREE.MeshStandardMaterial({ color: part.color, roughness: .9 }), list.length);
      const transform = new THREE.Object3D();
      list.forEach((entry, i) => {
        const origin = world(entry); const angle = entry.rot ?? 0; const scale = entry.scale ?? 1;
        transform.position.set(origin.x + (entry.dx ?? 0) + (part.x * Math.cos(angle) + part.z * Math.sin(angle)) * scale, part.y * scale, origin.z + (entry.dz ?? 0) + (part.z * Math.cos(angle) - part.x * Math.sin(angle)) * scale);
        transform.rotation.set(0, angle, part.rotation ?? 0); transform.scale.set((part.sx ?? 1) * scale, (part.sy ?? 1) * scale, (part.sz ?? 1) * scale); transform.updateMatrix(); mesh.setMatrixAt(i, transform.matrix);
      });
      scene.add(mesh);
    }
  }
}
