import * as THREE from "three";

/** Screen height of a character in CSS px; the head line sits this far above the feet. */
export const CHARACTER_SCREEN_HEIGHT = 70;
const CHOICES_GAP = 8, HEAD_MARGIN = 12;

/**
 * Distance in world units along the camera's up axis to move the dialogue focus so the feet midpoint
 * sits CHOICES_GAP px above the choices box, without the head line rising above HEAD_MARGIN px.
 */
export function choicesFocusShift(viewportHeight: number, halfHeight: number, choicesTop: number): number {
  const angle = THREE.MathUtils.degToRad(35);
  // Feet midpoint is this many world units above the screen centre under the base dialogue focus.
  const feetAbove = halfHeight / 3 - .35 * Math.cos(angle);
  const baseFeetTop = viewportHeight / 2 - feetAbove * viewportHeight / (2 * halfHeight);
  const wantedFeetTop = Math.max(choicesTop - CHOICES_GAP, CHARACTER_SCREEN_HEIGHT + HEAD_MARGIN);
  return (wantedFeetTop - baseFeetTop) * 2 * halfHeight / viewportHeight;
}

export function dialogueFocus(player: THREE.Vector3, speaker: THREE.Vector3, halfHeight: number, choices?: { top: number; viewportHeight: number }): THREE.Vector3 {
  const angle = THREE.MathUtils.degToRad(35);
  const up = new THREE.Vector3(-Math.sin(angle) / Math.SQRT2, Math.cos(angle), -Math.sin(angle) / Math.SQRT2);
  const focus = player.clone().lerp(speaker, .5).add(new THREE.Vector3(0, .35, 0)).addScaledVector(up, -halfHeight / 3);
  if (choices) focus.addScaledVector(up, choicesFocusShift(choices.viewportHeight, halfHeight, choices.top));
  return focus;
}
