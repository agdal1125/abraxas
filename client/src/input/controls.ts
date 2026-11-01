import { Movement, type VillageInput } from "./movement";

const labels = { ko: { move: "이동", talk: "말하기", nearby: "가까이에서 말할 수 있어요", examine: "살펴보기" }, en: { move: "Move", talk: "Talk", nearby: "Someone is nearby", examine: "Examine" } };
const directions = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyW", "KeyA", "KeyS", "KeyD"]);

export class Controls {
  private root = document.createElement("div");
  private pad = document.createElement("div");
  private talk = document.createElement("button");
  private hint = document.createElement("span");
  private movement = new Movement();
  private active = false;
  private pointer: number | null = null;
  private nearby = false;
  private lang: "ko" | "en" = "ko";
  constructor(app: HTMLElement, private village: VillageInput) {
    this.root.className = "game-controls"; this.pad.className = "move-pad"; this.talk.className = "talk-button"; this.hint.className = "nearby-hint";
    this.talk.type = "button"; this.pad.textContent = "✥"; this.root.append(this.pad, this.talk, this.hint); app.append(this.root);
    village.onNearbyChange = target => { this.nearby = !!target?.available; this.talk.textContent = target?.examine ? labels[this.lang].examine : labels[this.lang].talk; this.hint.textContent = target?.examine ? labels[this.lang].examine : labels[this.lang].nearby; this.updateHint(); };
    this.pad.addEventListener("pointerdown", event => { event.preventDefault(); event.stopPropagation(); if (!this.active || this.pointer !== null) return; this.pointer = event.pointerId; this.pad.setPointerCapture(event.pointerId); this.movePad(event); });
    this.pad.addEventListener("pointermove", event => { if (event.pointerId === this.pointer) this.movePad(event); });
    for (const name of ["pointerup", "pointercancel", "lostpointercapture"] as const) this.pad.addEventListener(name, event => { event.stopPropagation(); if (event.pointerId === this.pointer) { this.pointer = null; this.movement.pad = [0, 0]; this.send(); } });
    this.talk.addEventListener("pointerdown", event => { event.stopPropagation(); event.preventDefault(); if (this.active && this.nearby) this.village.interactNearby?.(); });
    this.talk.addEventListener("click", event => { event.stopPropagation(); if (event.detail === 0 && this.active && this.nearby) this.village.interactNearby?.(); });
    window.addEventListener("keydown", event => {
      if (!this.active || event.isComposing || event.ctrlKey || event.altKey || event.metaKey || (event.target instanceof HTMLElement && event.target !== this.talk && event.target.closest("button, input, textarea, select, [contenteditable=true]"))) return;
      if (directions.has(event.code)) { event.preventDefault(); if (!event.repeat) { this.movement.keys.add(event.code); this.send(); } }
      else if (event.code === "Space" || event.code === "Enter") { event.preventDefault(); event.stopImmediatePropagation(); if (!event.repeat && this.nearby) this.village.interactNearby?.(); }
    }, true);
    window.addEventListener("keyup", event => { if (directions.has(event.code)) { this.movement.keys.delete(event.code); this.send(); } }, true);
    window.addEventListener("blur", () => this.clear());
    document.addEventListener("visibilitychange", () => { if (document.hidden) this.clear(); });
    this.setActive(false, "ko");
  }
  setActive(active: boolean, lang: "ko" | "en"): void {
    this.active = active; this.lang = lang; this.clear(); this.nearby = false; this.root.hidden = !active;
    this.pad.setAttribute("aria-label", labels[lang].move); this.talk.textContent = labels[lang].talk; this.hint.textContent = labels[lang].nearby; this.updateHint();
  }
  private updateHint(): void { this.hint.hidden = !this.active || !this.nearby; this.talk.disabled = !this.nearby; }
  private clear(): void {
    const pointer = this.pointer; this.pointer = null;
    if (pointer !== null && this.pad.hasPointerCapture(pointer)) this.pad.releasePointerCapture(pointer);
    this.movement.clear(); this.send();
  }
  private send(): void { const [x, y] = this.movement.value(); this.village.setMoveInput?.(x, y); }
  private movePad(event: PointerEvent): void {
    const rect = this.pad.getBoundingClientRect(), x = event.clientX - (rect.left + rect.width / 2), y = (rect.top + rect.height / 2) - event.clientY;
    if (Math.hypot(x, y) < 20) this.movement.pad = [0, 0];
    else { const angle = Math.round(Math.atan2(y, x) / (Math.PI / 4)); this.movement.pad = [Math.round(Math.cos(angle * Math.PI / 4)), Math.round(Math.sin(angle * Math.PI / 4))]; }
    this.send();
  }
}
