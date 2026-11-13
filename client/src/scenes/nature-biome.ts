import * as THREE from "three";
import type { Vec2 } from "../core/world/types";

/**
 * What grows where. Every number is a plain function of the position on the map, so the meadow reads differently around
 * the bakery, the lake, or the workshop without reacting to anything the player chose.
 */
export type Biome = {
  /** Added to the ground color (multiplicative offset on r, g, b). */
  tint: [number, number, number];
  /** Wildflowers per square unit at the peak of a flower patch, and the share of white, pink, lilac, yellow. */
  flowers: number; palette: [number, number, number, number];
  clover: number; litter: number; tall: number; shrub: number; mushrooms: number;
  /** 0 fresh green, 1 sun-dried: pushes grass toward straw. */
  dry: number;
};

export const BIOMES: Record<string, Biome> = {
  entrance: { tint: [0, .02, -.01], flowers: 3.2, palette: [.5, .2, .1, .2], clover: 6, litter: .3, tall: 1.2, shrub: .08, mushrooms: 0, dry: 0 },
  plaza: { tint: [.01, .03, 0], flowers: 1.2, palette: [.3, .5, .2, 0], clover: 3, litter: 1.2, tall: .15, shrub: .04, mushrooms: 0, dry: 0 },
  bakery: { tint: [.06, .04, -.05], flowers: 4.5, palette: [.15, .35, 0, .5], clover: 4, litter: .4, tall: .5, shrub: .08, mushrooms: 0, dry: .1 },
  library: { tint: [-.04, -.01, .04], flowers: 2.6, palette: [.3, 0, .7, 0], clover: 8, litter: 2.6, tall: 1, shrub: .18, mushrooms: .3, dry: 0 },
  smithy: { tint: [.08, .04, -.08], flowers: .7, palette: [.1, 0, 0, .9], clover: 2, litter: 3, tall: 1.2, shrub: .1, mushrooms: .05, dry: .8 },
  lake: { tint: [-.03, .04, .03], flowers: 2.8, palette: [.5, .1, .4, 0], clover: 7, litter: .4, tall: 2.6, shrub: .26, mushrooms: .18, dry: 0 },
  gate: { tint: [-.02, 0, .07], flowers: 3, palette: [.4, 0, .6, 0], clover: 5, litter: .6, tall: 1.6, shrub: .12, mushrooms: .1, dry: 0 },
};

export const ZONE_COUNT = 7;
// Distance (world units) over which a zone's character fades. Zones sit about 10 to 15 units apart.
const SIGMA = 5;

type Anchor = Vec2 & { biome: Biome };

/** Blends the biome table by distance to each zone center. The ground shader mirrors `tint` (same anchors, same falloff). */
export class BiomeMap {
  readonly anchors: Anchor[];

  constructor(zones: Record<string, Vec2>) {
    this.anchors = Object.entries(BIOMES).flatMap(([id, biome]) => zones[id] ? [{ x: zones[id]!.x, z: zones[id]!.z, biome }] : []);
  }

  at(x: number, z: number, into: Biome): Biome {
    let sum = 0;
    into.tint.fill(0); into.palette.fill(0);
    into.flowers = into.clover = into.litter = into.tall = into.shrub = into.mushrooms = into.dry = 0;
    for (const a of this.anchors) {
      const w = Math.exp(-((x - a.x) ** 2 + (z - a.z) ** 2) / (2 * SIGMA * SIGMA));
      sum += w;
      for (let i = 0; i < 3; i++) into.tint[i]! += w * a.biome.tint[i]!;
      for (let i = 0; i < 4; i++) into.palette[i]! += w * a.biome.palette[i]!;
      into.flowers += w * a.biome.flowers; into.clover += w * a.biome.clover; into.litter += w * a.biome.litter;
      into.tall += w * a.biome.tall; into.shrub += w * a.biome.shrub; into.mushrooms += w * a.biome.mushrooms; into.dry += w * a.biome.dry;
    }
    if (sum < 1e-6) return into;
    // Rates follow the nearest zones; the color shift fades out far from every zone instead.
    const rate = 1 / sum, fade = 1 / Math.max(sum, 1);
    for (let i = 0; i < 3; i++) into.tint[i]! *= fade;
    for (let i = 0; i < 4; i++) into.palette[i]! *= rate;
    into.flowers *= rate; into.clover *= rate; into.litter *= rate; into.tall *= rate; into.shrub *= rate; into.mushrooms *= rate; into.dry *= rate;
    return into;
  }
}

/** Value noise stand-in: two crossed sines, -1 to 1, with features about `1 / scale` units wide. Cheap and good enough for patches. */
export function patchNoise(x: number, z: number, scale: number): number {
  return Math.sin(x * scale + Math.sin(z * scale * .78) * 1.7) * Math.sin(z * scale * .91 - x * scale * .38 + 1.3);
}

const GLSL = /* glsl */`
uniform vec2 uZonePos[${ZONE_COUNT}];
uniform vec3 uZoneTint[${ZONE_COUNT}];
varying vec3 vFieldPos;
`;

/**
 * Mottles the grass-colored part of the terrain: broad light and dark meadow patches, hard-edged facets in the
 * low-poly style, and the tint of the nearest zones. It runs in the terrain's own fragment shader, so it costs no
 * draw call and no texture.
 */
export function paintGround(terrain: THREE.Object3D, map: BiomeMap): void {
  const pos = Array.from({ length: ZONE_COUNT }, (_, i) => new THREE.Vector2(map.anchors[i]?.x ?? 1e5, map.anchors[i]?.z ?? 1e5));
  const tint = Array.from({ length: ZONE_COUNT }, (_, i) => new THREE.Vector3(...(map.anchors[i]?.biome.tint ?? [0, 0, 0])));
  const done = new Set<THREE.Material>();
  terrain.traverse(child => {
    if (!(child instanceof THREE.Mesh)) return;
    for (const material of Array.isArray(child.material) ? child.material : [child.material] as THREE.Material[]) {
      if (done.has(material) || !(material as THREE.MeshStandardMaterial).vertexColors) continue;
      done.add(material);
      material.customProgramCacheKey = () => "nature-ground";
      material.onBeforeCompile = (shader: THREE.WebGLProgramParametersWithUniforms) => {
        shader.uniforms.uZonePos = { value: pos }; shader.uniforms.uZoneTint = { value: tint };
        shader.vertexShader = shader.vertexShader
          .replace("#include <common>", `#include <common>\n${GLSL}`)
          .replace("#include <begin_vertex>", "#include <begin_vertex>\nvFieldPos = (modelMatrix * vec4(transformed, 1.)).xyz;");
        shader.fragmentShader = shader.fragmentShader
          .replace("#include <common>", `#include <common>\n${GLSL}`)
          .replace("#include <color_fragment>", `#include <color_fragment>
            {
              // Grass-colored fragments only: paths, water, and stone keep their own colors.
              float grassy = smoothstep(1.08, 1.22, vColor.g / max(vColor.r, .01)) * smoothstep(1.2, 1.45, vColor.g / max(vColor.b, .01));
              vec2 p = vFieldPos.xz;
              float broad = sin(p.x * .21 + sin(p.y * .17) * 1.7) * sin(p.y * .19 - p.x * .08 + 1.3);
              float mid = sin(p.x * .62 + sin(p.y * .5) * 1.7) * sin(p.y * .58 - p.x * .24 + 2.1);
              float facet = floor((sin(p.x * 1.45 + sin(p.y * 1.1) * 1.5) * sin(p.y * 1.3 - p.x * .6 + .4) * .5 + .5) * 3.) / 3.;
              float lift = -.05 + broad * .08 + mid * .05 + (facet - .5) * .12;
              vec3 zone = vec3(0.);
              float sum = 0.;
              for (int i = 0; i < ${ZONE_COUNT}; i++) {
                vec2 d = p - uZonePos[i];
                float w = exp(-dot(d, d) / ${(2 * SIGMA * SIGMA).toFixed(1)});
                zone += w * uZoneTint[i]; sum += w;
              }
              zone /= max(sum, 1.);
              vec3 shifted = diffuseColor.rgb * (1. + lift + zone);
              // Meadow patches lean yellow in the light parts and blue-green in the dark parts.
              shifted.r *= 1. + broad * .05; shifted.b *= 1. - broad * .04;
              diffuseColor.rgb = mix(diffuseColor.rgb, shifted, grassy);
            }`);
      };
      material.needsUpdate = true;
    }
  });
}
