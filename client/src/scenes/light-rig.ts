import * as THREE from "three";

type Focus = { x: number; z: number };

// Points from the scene toward the sun. The camera looks along (-1, -, -1), so this puts the sun to screen-left:
// shadows fall sideways across the ground and the two visible wall faces get different brightness.
const SUN_DIRECTION = new THREE.Vector3(-3.2, 5.6, 5.3).normalize();
const SUN_DISTANCE = 14;
// The village camera looks down at 35 degrees, so on the ground screen right runs along (1, 0, -1) and screen up
// along (-1, 0, -1).
const VIEW_TILT = THREE.MathUtils.degToRad(35);
const VIEW_RIGHT = new THREE.Vector3(1, 0, -1).normalize();
const VIEW_UP = new THREE.Vector3(-1, 0, -1).normalize();
const TO_CAMERA = new THREE.Vector3(1, Math.SQRT2 * Math.tan(VIEW_TILT), 1).normalize();
// Shadows have to land on everything up to about character height. A point that high is drawn over ground lying
// farther along the view, so the box covers the slab of the view between the ground and that height. SLAB is the
// distance along the view from the ground to the middle of the slab; SLAB_CENTRE is that middle slid back onto the
// ground along the sunlight, which leaves it at the same place in the shadow map.
const RECEIVER_HEIGHT = .7;
const SLAB = RECEIVER_HEIGHT / 2 / Math.sin(VIEW_TILT);
const SLAB_CENTRE = TO_CAMERA.clone().multiplyScalar(SLAB).addScaledVector(SUN_DIRECTION, -TO_CAMERA.y * SLAB / SUN_DIRECTION.y);
// Casters this tall over the visible ground have to stay in front of the shadow camera's near plane (.5), which also
// sits about .5 nearer than the slab's middle.
const CASTER_HEIGHT = 3;

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
  private distance = SUN_DISTANCE;
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

  /** Fits the shadow map to what the camera can see, around the view centre that `update` receives. */
  resize(halfHeight: number, aspect: number, mapSize: number): void {
    // The visible ground reaches halfHeight * aspect to each side and halfHeight / sin(35deg) up and down the screen,
    // and the slab above it reaches SLAB along the view either way from its middle. The box takes the farthest reach
    // along the shadow camera's axes, with a small margin for the texel snapping and the soft edge.
    const across = halfHeight * aspect, deep = halfHeight / Math.sin(VIEW_TILT);
    const reach = (axis: THREE.Vector3) => across * Math.abs(VIEW_RIGHT.dot(axis)) + deep * Math.abs(VIEW_UP.dot(axis)) + SLAB * Math.abs(TO_CAMERA.dot(axis));
    const extent = Math.max(3, Math.max(reach(this.right), reach(this.up)) * 1.02), depth = reach(SUN_DIRECTION), camera = this.sun.shadow.camera;
    this.distance = Math.max(SUN_DISTANCE, depth + CASTER_HEIGHT / SUN_DIRECTION.y + 2);
    camera.left = camera.bottom = -extent; camera.right = camera.top = extent; camera.far = this.distance + depth + 1; camera.updateProjectionMatrix();
    if (this.sun.shadow.mapSize.x !== mapSize) { this.sun.shadow.mapSize.set(mapSize, mapSize); this.sun.shadow.map?.dispose(); this.sun.shadow.map = null; }
    this.texel = 2 * extent / mapSize;
  }

  update(dt: number, focus: Focus): void {
    if (!this.reduced.matches) this.cloudShade.material.uniforms.time!.value += dt;
    this.cloudShade.position.set(focus.x, 0, focus.z);
    // Moving the shadow camera in whole texels keeps shadow edges from crawling while the player walks.
    const point = new THREE.Vector3(focus.x + SLAB_CENTRE.x, 0, focus.z + SLAB_CENTRE.z);
    if (this.texel) for (const axis of [this.right, this.up]) { const along = point.dot(axis); point.addScaledVector(axis, Math.round(along / this.texel) * this.texel - along); }
    this.sun.target.position.copy(point); this.sun.position.copy(point).addScaledVector(SUN_DIRECTION, this.distance);
  }
}
