import { Movement, type VillageInput } from "./movement";

const directions = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyW", "KeyA", "KeyS", "KeyD"]);

export class Controls {
  private root = document.createElement("div");
  private pad = document.createElement("div");
  private movement = new Movement();
  private active = false;
  private blocked = false;
  private pointer: { id: number; x: number; y: number; time: number; distance: number; pad: boolean; owned: boolean } | null = null;

  constructor(private app: HTMLElement, private village: VillageInput) {
    this.root.className = "game-controls"; this.pad.className = "move-pad";
    this.pad.setAttribute("aria-hidden", "true"); this.root.append(this.pad); app.append(this.root);
    app.addEventListener("pointerdown", event => {
      if (event.target instanceof HTMLElement && event.target.closest("button, input, textarea, select, [contenteditable=true], [role=button]")) return;
      event.stopPropagation();
      if (!this.active || this.blocked || this.pointer || event.button !== 0) return;
      event.preventDefault();
      const rect = app.getBoundingClientRect();
      const pad = event.pointerType !== "mouse" && event.clientX >= rect.left && event.clientX < rect.left + rect.width * .45 && event.clientY >= rect.top + rect.height * .4 && event.clientY <= rect.top + rect.height;
      const target = this.village.hitTargetAt?.(event.clientX, event.clientY);
      this.pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, time: event.timeStamp, distance: 0, pad, owned: pad && !target };
      app.setPointerCapture(event.pointerId);
      if (pad) {
        this.pad.style.setProperty("--pad-x", `${event.clientX - rect.left}px`); this.pad.style.setProperty("--pad-y", `${event.clientY - rect.top}px`);
        this.pad.style.setProperty("--knob-x", "0px"); this.pad.style.setProperty("--knob-y", "0px"); this.pad.classList.add("is-active");
      }
    }, true);
    app.addEventListener("pointermove", event => {
      const pointer = this.pointer; if (!pointer || event.pointerId !== pointer.id) return;
      event.stopPropagation(); event.preventDefault();
      const x = event.clientX - pointer.x, y = event.clientY - pointer.y, distance = Math.hypot(x, y);
      pointer.distance = Math.max(pointer.distance, distance);
      if (pointer.pad) {
        if (distance >= 14) pointer.owned = true;
        const scale = distance > 32 ? 32 / distance : 1;
        this.pad.style.setProperty("--knob-x", `${x * scale}px`); this.pad.style.setProperty("--knob-y", `${y * scale}px`);
        if (distance < 14) this.movement.pad = [0, 0];
        else { const angle = Math.round(Math.atan2(-y, x) / (Math.PI / 4)); this.movement.pad = [Math.round(Math.cos(angle * Math.PI / 4)), Math.round(Math.sin(angle * Math.PI / 4))]; }
        this.send();
      }
    }, true);
    for (const name of ["pointerup", "pointercancel", "lostpointercapture"] as const) app.addEventListener(name, event => {
      if (event.target instanceof HTMLElement && event.target.closest("button, input, textarea, select, [contenteditable=true], [role=button]")) return;
      event.stopPropagation();
      const pointer = this.pointer; if (!pointer || event.pointerId !== pointer.id) return;
      const distance = Math.max(pointer.distance, Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y));
      const tap = name === "pointerup" && !pointer.owned && distance < 10 && event.timeStamp - pointer.time < 300;
      this.releasePointer();
      if (tap && this.active && !this.blocked) { const id = this.village.hitTargetAt?.(event.clientX, event.clientY); if (id) this.village.interactTarget?.(id); }
    }, true);
    window.addEventListener("keydown", event => {
      if (!this.active || this.blocked || event.isComposing || event.ctrlKey || event.altKey || event.metaKey || (event.target instanceof HTMLElement && event.target.closest("button, input, textarea, select, [contenteditable=true], [role=button]"))) return;
      if (directions.has(event.code)) { event.preventDefault(); if (!event.repeat) { this.movement.keys.add(event.code); this.send(); } }
      else if (event.code === "Space" || event.code === "Enter" || event.code === "KeyE") { event.preventDefault(); event.stopImmediatePropagation(); if (!event.repeat) this.village.interactNearby?.(); }
    }, true);
    window.addEventListener("keyup", event => { if (directions.has(event.code)) { this.movement.keys.delete(event.code); this.send(); } }, true);
    window.addEventListener("blur", () => this.clear());
    window.addEventListener("abraxas:viewport", event => { this.blocked = (event as CustomEvent<{ portrait: boolean }>).detail.portrait; this.clear(); });
    document.addEventListener("visibilitychange", () => { if (document.hidden) this.clear(); });
    this.setActive(false, "ko");
  }
  setActive(active: boolean, _lang: "ko" | "en"): void { this.active = active; this.clear(); this.root.hidden = !active; }
  private releasePointer(): void {
    const pointer = this.pointer; this.pointer = null;
    if (pointer && this.app.hasPointerCapture(pointer.id)) this.app.releasePointerCapture(pointer.id);
    this.pad.classList.remove("is-active"); this.movement.pad = [0, 0]; this.send();
  }
  private clear(): void { this.releasePointer(); this.movement.clear(); this.send(); }
  private send(): void { const [x, y] = this.movement.value(); this.village.setMoveInput?.(x, y); }
}
