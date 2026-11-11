import * as THREE from "three";

type Focus = { x: number; z: number };

// Points from the scene toward the sun. The camera looks along (-1, -, -1), so this puts the sun to screen-left:
// shadows fall sideways across the ground and the two visible wall faces get different brightness.
const SUN_DIRECTION = new THREE.Vector3(-3.2, 5.6, 5.3).normalize();
const SUN_DISTANCE = 14;

// Layered sines instead of hashed noise: the pattern is identical on every GPU precision.
// The shade colour is written straight to the sRGB canvas, so it is a display-space multiplier.
const CLOUD_SHADE = /* glsl */`
uniform float time;
uniform vec3 shade;
varying vec2 ground;
void main() {
  vec2 p = ground * .26 + time * vec2( .05, -.022 );
  float n = sin( p.x + 1.3 * sin( p.y * .7 ) ) + sin( p.y * 1.3 + 1.1 * sin( p.x * .9 + 1.7 ) ) + .5 * sin( p.x * 2.1 - p.y * 1.7 );
  gl_FragColor = vec4( mix( vec3( 1. ), shade, smoothstep( .95, 2.05, n ) ), 1. );
}`;

export class LightRig {
  readonly sun = new THREE.DirectionalLight("#fff1dc", 3.05);
  readonly sky = new THREE.HemisphereLight("#eceefc", "#f1e3d2", 1.05);
  private cloudShade = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, shade: { value: new THREE.Color().setRGB(.9, .91, .97) } },
    vertexShader: "varying vec2 ground; void main() { vec4 world = modelMatrix * vec4( position, 1. ); ground = world.xz; gl_Position = projectionMatrix * viewMatrix * world; }",
    fragmentShader: CLOUD_SHADE, blending: THREE.MultiplyBlending, premultipliedAlpha: true, transparent: true, depthTest: false, depthWrite: false,
  }));
  private right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), SUN_DIRECTION).normalize();
  private up = new THREE.Vector3();
  private texel = 0;
  private reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

  constructor(scene: THREE.Scene) {
    this.up.crossVectors(SUN_DIRECTION, this.right);
    this.sun.castShadow = true;
    Object.assign(this.sun.shadow.camera, { near: .5, far: 30 });
    this.sun.shadow.bias = -.0002; this.sun.shadow.normalBias = .025; this.sun.shadow.radius = 2.2;
    // Drawn over the finished opaque scene without a depth test, so drifting cloud shade tints trees and
    // walls along with the ground they stand on. It runs before sprites so markers stay bright.
    this.cloudShade.rotation.x = -Math.PI / 2; this.cloudShade.scale.setScalar(80); this.cloudShade.renderOrder = -1; this.cloudShade.frustumCulled = false;
    scene.add(this.sun, this.sun.target, this.sky, this.cloudShade);
  }

  /** Fits the shadow map to the ground the camera can see. */
  resize(halfHeight: number, aspect: number, mapSize: number): void {
    // The camera looks down at 35 degrees, so the visible ground is halfHeight / sin(35deg) deep and halfHeight * aspect wide.
    const extent = Math.max(3, halfHeight * Math.max(aspect, 1.75) * 1.15), camera = this.sun.shadow.camera;
    camera.left = camera.bottom = -extent; camera.right = camera.top = extent; camera.updateProjectionMatrix();
    if (this.sun.shadow.mapSize.x !== mapSize) { this.sun.shadow.mapSize.set(mapSize, mapSize); this.sun.shadow.map?.dispose(); this.sun.shadow.map = null; }
    this.texel = 2 * extent / mapSize;
  }

  update(dt: number, focus: Focus): void {
    if (!this.reduced.matches) this.cloudShade.material.uniforms.time!.value += dt;
    this.cloudShade.position.set(focus.x, 0, focus.z);
    // Moving the shadow camera in whole texels keeps shadow edges from crawling while the player walks.
    const point = new THREE.Vector3(focus.x, 0, focus.z);
    if (this.texel) for (const axis of [this.right, this.up]) { const along = point.dot(axis); point.addScaledVector(axis, Math.round(along / this.texel) * this.texel - along); }
    this.sun.target.position.copy(point); this.sun.position.copy(point).addScaledVector(SUN_DIRECTION, SUN_DISTANCE);
  }
}
