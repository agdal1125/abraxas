import * as THREE from "three";

// Shared wind state. Every patched material points at these same {value} objects, so one write per frame moves everything.
export const wind = {
  uTime: { value: 0 },
  uStrength: { value: 1 },
  uDir: { value: new THREE.Vector2(.82, .57).normalize() },
  uPlayer: { value: new THREE.Vector3(1e4, 0, 1e4) },
};

const PARS = /* glsl */`
uniform float uTime;
uniform float uStrength;
uniform vec2 uDir;
uniform float uAmp;
uniform float uHeight;
uniform vec3 uPlayer;
// A broad gust that travels across the ground along the wind direction (about 15 units per wave).
float windGust(vec2 p) {
  float a = sin(dot(p, uDir) * .42 - uTime * 1.05) * .5 + .5;
  return a * a;
}
// Displacement in the object's local space. Phase comes from the object origin so a whole crown sways together;
// the weight grows with height, so trunks and stems stay planted.
vec3 windLocal(mat4 wm, vec3 pos) {
  vec2 o = wm[3].xz;
  float h = clamp(pos.y / uHeight, 0., 1.);
  h *= h;
  float flutter = sin(uTime * 2.3 + o.x * 1.7 + o.y * 1.1 + pos.y * 3.);
  float f = uStrength * uAmp * h;
  vec2 d = uDir * f * (.4 + 1.1 * windGust(o)) + vec2(-uDir.y, uDir.x) * f * flutter * .3;
  vec3 w = vec3(d.x, -length(d) * .12, d.y);
  mat3 m = mat3(wm);
  return (transpose(m) * w) / max(dot(m[0], m[0]), 1e-4);
}
`;

type Patch = { amp: number; height: number; grass?: boolean };

/** Adds the wind sway to a material's vertex shader. Safe to call once per material. */
export function applyWind(material: THREE.Material, { amp, height, grass }: Patch): void {
  const uniforms = { uAmp: { value: amp }, uHeight: { value: height } };
  material.userData.wind = uniforms;
  material.customProgramCacheKey = () => grass ? "nature-wind-grass" : "nature-wind";
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, { uTime: wind.uTime, uStrength: wind.uStrength, uDir: wind.uDir, uPlayer: wind.uPlayer, ...uniforms });
    let vertex = shader.vertexShader.replace("#include <common>", `#include <common>\n${PARS}`);
    if (grass) {
      // Brighter tips where a gust passes, and blades lean away from the player.
      vertex = vertex.replace("#include <color_vertex>", `#include <color_vertex>
        mat4 wWm = modelMatrix * instanceMatrix;
        vColor.rgb *= 1. + .26 * windGust(wWm[3].xz) * clamp(position.y / uHeight, 0., 1.);`);
      vertex = vertex.replace("#include <begin_vertex>", `#include <begin_vertex>
        transformed += windLocal(wWm, position);
        vec2 away = wWm[3].xz - uPlayer.xz;
        float near = 1. - smoothstep(.0, .38, length(away));
        vec3 push = vec3(normalize(away + 1e-4), 0.).xzy * near * .09 * pow(clamp(position.y / uHeight, 0., 1.), 1.5);
        transformed += (transpose(mat3(wWm)) * push) / max(dot(wWm[0].xyz, wWm[0].xyz), 1e-4);`);
    } else {
      vertex = vertex.replace("#include <begin_vertex>", `#include <begin_vertex>
        mat4 wWm = modelMatrix;
        #ifdef USE_INSTANCING
          wWm *= instanceMatrix;
        #endif
        transformed += windLocal(wWm, position);`);
    }
    shader.vertexShader = vertex;
    if (grass) shader.fragmentShader = shader.fragmentShader.replace("#include <normal_fragment_begin>", "#include <normal_fragment_begin>\nnormal = normalize(vNormal);");
  };
  material.needsUpdate = true;
}

const depthMaterials = new Map<THREE.Material, THREE.MeshDepthMaterial>();

/** A depth material that sways with the same uniforms, so a tree's shadow follows its crown. */
export function windDepthMaterial(source: THREE.Material): THREE.MeshDepthMaterial | undefined {
  const uniforms = source.userData.wind as { uAmp: { value: number }; uHeight: { value: number } } | undefined;
  if (!uniforms) return undefined;
  let depth = depthMaterials.get(source);
  if (depth) return depth;
  depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  depth.customProgramCacheKey = () => "nature-wind-depth";
  depth.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, { uTime: wind.uTime, uStrength: wind.uStrength, uDir: wind.uDir, uPlayer: wind.uPlayer, ...uniforms });
    shader.vertexShader = shader.vertexShader.replace("#include <common>", `#include <common>\n${PARS}`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>
        mat4 wWm = modelMatrix;
        #ifdef USE_INSTANCING
          wWm *= instanceMatrix;
        #endif
        transformed += windLocal(wWm, position);`);
  };
  depthMaterials.set(source, depth);
  return depth;
}

/** Lambert material for generated nature meshes: vertex colors, per-instance tint, and the up-facing normals read the same from both sides. */
export function liteMaterial(options: { flat?: boolean } = {}): THREE.MeshLambertMaterial {
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, flatShading: !!options.flat });
  if (!options.flat) {
    material.customProgramCacheKey = () => "nature-lite";
    material.onBeforeCompile = shader => {
      shader.fragmentShader = shader.fragmentShader.replace("#include <normal_fragment_begin>", "#include <normal_fragment_begin>\nnormal = normalize(vNormal);");
    };
  }
  return material;
}
