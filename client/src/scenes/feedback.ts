import * as THREE from "three";

export function dialogueFocus(player: THREE.Vector3, speaker: THREE.Vector3, halfHeight: number): THREE.Vector3 {
  const angle = THREE.MathUtils.degToRad(35);
  const up = new THREE.Vector3(-Math.sin(angle) / Math.SQRT2, Math.cos(angle), -Math.sin(angle) / Math.SQRT2);
  return player.clone().lerp(speaker, .5).add(new THREE.Vector3(0, .35, 0)).addScaledVector(up, -halfHeight / 3);
}
