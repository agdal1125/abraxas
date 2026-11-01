import * as THREE from "three";

type Spot = { asset: string; x: number; z: number };

export class DreamEffects {
  private particles: THREE.Points[];
  private mist: THREE.Points;
  private glow: THREE.Points;
  private time = 0;
  private initialized = false;
  private reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  readonly whenReady: Promise<void>;

  constructor(scene: THREE.Scene, props: Spot[], lake?: { x: number; z: number }) {
    const loading: Promise<unknown>[] = [];
    const make = (name: string, count: number, size: number, blending: THREE.Blending = THREE.NormalBlending) => {
      const texture = new THREE.Texture();
      loading.push(new THREE.TextureLoader().loadAsync(`${import.meta.env.BASE_URL}assets/abraxas/fx/fx-${name}.png`).then(loaded => { texture.image = loaded.image; texture.needsUpdate = true; }));
      texture.colorSpace = THREE.SRGBColorSpace;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
      const points = new THREE.Points(geometry, new THREE.PointsMaterial({ map: texture, size, sizeAttenuation: false, transparent: true, opacity: name === "mist" ? .08 : name === "glow" ? .16 : .75, depthWrite: false, blending }));
      points.frustumCulled = false; scene.add(points); return points;
    };
    this.particles = [make("petal", 12, 14), make("firefly", 12, 12, THREE.AdditiveBlending)];
    this.mist = make("mist", lake ? 2 : 0, 80);
    if (lake) {
      const mistPositions = this.mist.geometry.getAttribute("position") as THREE.BufferAttribute;
      mistPositions.setXYZ(0, lake.x - 1, .15, lake.z); mistPositions.setXYZ(1, lake.x + 1, .15, lake.z + 1); mistPositions.needsUpdate = true;
    }
    const spots = props.filter(p => p.asset === "streetlight" || p.asset === "well");
    if (lake) spots.push({ asset: "lake", ...lake });
    this.glow = make("glow", spots.length, 55, THREE.AdditiveBlending);
    const positions = this.glow.geometry.getAttribute("position") as THREE.BufferAttribute;
    spots.forEach((spot, i) => positions.setXYZ(i, spot.x, spot.asset === "streetlight" ? 1.4 : .5, spot.z));
    positions.needsUpdate = true;
    this.whenReady = Promise.all(loading).then(() => {});
  }

  resize(mobile: boolean, pixelRatio: number): void {
    [...this.particles, this.mist, this.glow].forEach((points, i) => { (points.material as THREE.PointsMaterial).size = [14, 12, 80, 55][i]! * pixelRatio; });
  }

  update(dt: number, player: THREE.Vector3, camera: THREE.OrthographicCamera): void {
    if (!this.reduced.matches) this.time += dt;
    const radius = Math.max(camera.right - camera.left, (camera.top - camera.bottom) * 2) + 4;
    this.particles.forEach((points, kind) => {
      const positions = points.geometry.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < positions.count; i++) {
        const phase = i * 2.399 + kind;
        let x = this.initialized ? positions.getX(i) + dt * .025 : player.x + (((i * .618 + kind * .29) % 1) - .5) * radius * 2;
        let z = this.initialized ? positions.getZ(i) + dt * .015 : player.z + (((i * .414 + kind * .17) % 1) - .5) * radius * 2;
        if (x < player.x - radius) x += radius * 2; else if (x > player.x + radius) x -= radius * 2;
        if (z < player.z - radius) z += radius * 2; else if (z > player.z + radius) z -= radius * 2;
        positions.setXYZ(i, x, .35 + (i % 7) * .25 + .08 * Math.sin(this.time * .5 + phase), z);
      }
      positions.needsUpdate = true;
      (points.material as THREE.PointsMaterial).opacity = kind ? .55 + .18 * Math.sin(this.time * .8) : .75;
      points.visible = !this.reduced.matches;
    });
    this.initialized = true;
  }
}
