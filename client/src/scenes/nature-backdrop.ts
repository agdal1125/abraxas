import * as THREE from "three";
import type { Vec2 } from "../core/world/types";
import { seeded } from "./nature-grass";
import { liteMaterial, wind } from "./nature-wind";

type V3 = [number, number, number];

/** Distance from `origin` along `angle` to the polygon's outline (the farthest crossing, so concave bays do not fool it). */
function reach(outer: Vec2[], origin: Vec2, angle: number): number {
  const dx = Math.cos(angle), dz = Math.sin(angle);
  let best = 0;
  for (let i = 0; i < outer.length; i++) {
    const a = outer[i]!, b = outer[(i + 1) % outer.length]!;
    const ex = b.x - a.x, ez = b.z - a.z, det = dx * ez - dz * ex;
    if (Math.abs(det) < 1e-9) continue;
    const t = ((a.x - origin.x) * ez - (a.z - origin.z) * ex) / det, u = ((a.x - origin.x) * dz - (a.z - origin.z) * dx) / det;
    if (t > 0 && u >= 0 && u <= 1) best = Math.max(best, t);
  }
  return best;
}

/**
 * The sky beyond the island's rim: a few small floating islets and low cloud banks, so the edge of the map opens onto a
 * larger world instead of a bare gradient. One static mesh; the clouds drift in the vertex shader from the shared wind
 * clock. It is only drawn while the player is within a few steps of the rim, since nothing else ever shows it.
 */
export class Backdrop {
  readonly mesh: THREE.Mesh;

  constructor(scene: THREE.Scene, outer: Vec2[], private readonly nearRim: (x: number, z: number) => number) {
    const random = seeded(4242), position: number[] = [], color: number[] = [], drift: number[] = [];
    const center = outer.reduce((c, p) => ({ x: c.x + p.x / outer.length, z: c.z + p.z / outer.length }), { x: 0, z: 0 });
    const tri = (a: V3, b: V3, c: V3, shade: V3, moves = 0, shadeB = shade, shadeC = shade) => { position.push(...a, ...b, ...c); color.push(...shade, ...shadeB, ...shadeC); drift.push(moves, moves, moves); };
    const lerp = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    const spot = (angle: number, out: number): Vec2 => { const d = reach(outer, center, angle) + out; return { x: center.x + Math.cos(angle) * d, z: center.z + Math.sin(angle) * d }; };

    // Islets: a grassy cap on an upside-down cone of rock, some with a small fir. Hazier (paler) the farther they sit.
    const GRASS: V3 = [.46, .7, .44], EDGE: V3 = [.5, .4, .32], ROCK: V3 = [.58, .5, .5], DEEP: V3 = [.42, .36, .4], FIR: V3 = [.26, .5, .36];
    for (let k = 0; k < 12; k++) {
      const angle = (k + random() * .8) / 12 * Math.PI * 2, far = random(), at = spot(angle, 3.5 + far * 15);
      const r = 1.4 + random() * 2.2 + far, y = -1.8 + random() * 3.2, sides = 8, twist = random() * 6, haze = .3 + far * .35;
      const mix = (c: V3) => lerp(c, [.82, .8, .92], haze);
      const ring = (radius: number, height: number): V3[] => Array.from({ length: sides }, (_, i): V3 => { const a = twist + i / sides * Math.PI * 2, rr = radius * (1 + (random() - .5) * .25); return [at.x + Math.cos(a) * rr, y + height, at.z + Math.sin(a) * rr]; });
      const cap = ring(r, 0), lip = ring(r * .94, -.22), tip: V3 = [at.x + (random() - .5) * r * .4, y - r * (1.1 + random() * .9), at.z + (random() - .5) * r * .4];
      for (let i = 0; i < sides; i++) {
        const j = (i + 1) % sides;
        tri([at.x, y + .06, at.z], cap[i]!, cap[j]!, mix(GRASS));
        tri(cap[i]!, lip[i]!, cap[j]!, mix(EDGE)); tri(cap[j]!, lip[i]!, lip[j]!, mix(EDGE));
        tri(lip[i]!, tip, lip[j]!, mix(ROCK), 0, mix(DEEP), mix(ROCK));
      }
      if (random() < .6) for (let tier = 0; tier < 2; tier++) {
        const base = y + .06 + tier * .42, rad = (tier ? .32 : .5) * (.8 + random() * .5), fx = at.x + r * .2, fz = at.z - r * .15;
        for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2, b = (i + 1) / 5 * Math.PI * 2; tri([fx + Math.cos(a) * rad, base, fz + Math.sin(a) * rad], [fx + Math.cos(b) * rad, base, fz + Math.sin(b) * rad], [fx, base + .85, fz], mix(FIR)); }
      }
    }

    // Clouds: a few flattened lumps each, low around the island and drifting slowly with the wind.
    const lumps = new THREE.IcosahedronGeometry(1, 0).toNonIndexed(), p = lumps.getAttribute("position");
    const TOP: V3 = [1, .97, 1], UNDER: V3 = [.84, .82, .94];
    for (let k = 0; k < 24; k++) {
      const at = spot(random() * Math.PI * 2, 2.5 + random() * 18), y = -4.5 + random() * 5.5, parts = 2 + Math.floor(random() * 3);
      for (let part = 0; part < parts; part++) {
        const ox = at.x + (part - parts / 2) * (.8 + random() * .5), oz = at.z + (random() - .5) * .8, s = .35 + random() * .5;
        const point = (i: number): V3 => [ox + p.getX(i) * s * 1.6, y + p.getY(i) * s * .5, oz + p.getZ(i) * s];
        for (let i = 0; i < p.count; i += 3) { const a = point(i), b = point(i + 1), c = point(i + 2); tri(a, b, c, a[1] > y ? TOP : UNDER, 1, b[1] > y ? TOP : UNDER, c[1] > y ? TOP : UNDER); }
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(position, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(color, 3));
    geometry.setAttribute("drift", new THREE.Float32BufferAttribute(drift, 1));
    geometry.computeVertexNormals();
    const material = liteMaterial({ flat: true });
    material.customProgramCacheKey = () => "nature-backdrop";
    material.onBeforeCompile = shader => {
      shader.uniforms.uTime = wind.uTime; shader.uniforms.uStrength = wind.uStrength;
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nuniform float uTime;\nuniform float uStrength;\nattribute float drift;")
        // Clouds rock slowly back and forth along the wind; islets stay put.
        .replace("#include <begin_vertex>", "#include <begin_vertex>\ntransformed.x += drift * sin(uTime * .05 + position.z * .08) * 1.6 * uStrength;\ntransformed.y += drift * sin(uTime * .11 + position.x * .2) * .12 * uStrength;");
    };
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.name = "backdrop"; this.mesh.frustumCulled = false; this.mesh.castShadow = false; this.mesh.receiveShadow = false;
    scene.add(this.mesh);
  }

  update(player: THREE.Vector3): void { this.mesh.visible = this.nearRim(player.x, player.z) < 9; }
}
