import * as THREE from "three";

type Spot = { asset: string; x: number; z: number };

export class DreamEffects {
  private particles: THREE.Points[];
  private mist: THREE.Points;
  private glow: THREE.Points;
  private time = 0;
  private reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

  constructor(scene: THREE.Scene, props: Spot[], lake?: { x: number; z: number }) {
    const make = (name: string, count: number, size: number, blending: THREE.Blending = THREE.NormalBlending) => {
      const texture = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}assets/abraxas/fx/fx-${name}.png`);
      texture.colorSpace = THREE.SRGBColorSpace;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
      const points = new THREE.Points(geometry, new THREE.PointsMaterial({ map: texture, size, sizeAttenuation: false, transparent: true, opacity: name === "mist" ? .18 : name === "glow" ? .32 : .75, depthWrite: false, blending }));
      points.frustumCulled = false; scene.add(points); return points;
    };
    this.particles = [make("petal", 30, 14), make("firefly", 30, 12, THREE.AdditiveBlending)];
    this.mist = make("mist", 4, 150);
    const spots = props.filter(p => p.asset === "streetlight" || p.asset === "well");
    if (lake) spots.push({ asset: "lake", ...lake });
    this.glow = make("glow", spots.length, 100, THREE.AdditiveBlending);
    const positions = this.glow.geometry.getAttribute("position") as THREE.BufferAttribute;
    spots.forEach((spot, i) => positions.setXYZ(i, spot.x, spot.asset === "streetlight" ? 1.4 : .5, spot.z));
    positions.needsUpdate = true;
  }

  resize(mobile: boolean, pixelRatio: number): void {
    this.particles.forEach(points => points.geometry.setDrawRange(0, mobile ? 15 : 30));
    [...this.particles, this.mist, this.glow].forEach((points, i) => { (points.material as THREE.PointsMaterial).size = [14, 12, 150, 100][i]! * pixelRatio; });
  }

  update(dt: number, player: THREE.Vector3, camera: THREE.OrthographicCamera): void {
    if (!this.reduced.matches) this.time += dt;
    const width = camera.right - camera.left;
    this.particles.forEach((points, kind) => {
      const positions = points.geometry.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < positions.count; i++) {
        const phase = i * 2.399 + kind, t = this.time;
        const horizontal = (((i * .618 + kind * .29 + t * .008) % 1) - .5) * width;
        const depth = (((i * .414 + kind * .17) % 1) - .5) * 6;
        positions.setXYZ(i, player.x + (horizontal + depth) / Math.SQRT2, .35 + (i % 7) * .25 + .08 * Math.sin(t * .5 + phase), player.z + (depth - horizontal) / Math.SQRT2);
      }
      positions.needsUpdate = true;
      (points.material as THREE.PointsMaterial).opacity = kind ? .55 + .18 * Math.sin(this.time * .8) : .75;
    });
    const positions = this.mist.geometry.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < positions.count; i++) positions.setXYZ(i, player.x + (i - 1.5) * 1.5 + Math.sin(this.time * .08 + i) * .5, .2, player.z + (i % 2 ? 2 : -2));
    positions.needsUpdate = true;
  }
}
