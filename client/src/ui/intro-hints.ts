const MOVE_HINT_SEEN = "abraxas-move-hint-seen";

export function showIntent(parent: HTMLElement, copy: { text: string; prompt: string }): Promise<void> {
  return new Promise(resolve => {
    const card = document.createElement("button"), text = document.createElement("p"), prompt = document.createElement("small");
    card.type = "button"; card.className = "intent-card"; card.dataset.action = "next";
    text.textContent = copy.text; prompt.textContent = copy.prompt;
    card.addEventListener("click", () => { card.remove(); resolve(); }, { once: true });
    card.append(text, prompt); parent.append(card); card.focus();
  });
}

export function showMoveHint(parent: HTMLElement, lines: string[]): void {
  try { if (localStorage.getItem(MOVE_HINT_SEEN)) return; } catch { /* Show the hint when storage is unavailable. */ }
  const hint = document.createElement("div");
  hint.className = "move-hint"; hint.setAttribute("role", "status"); hint.textContent = lines.join("\n");
  const dismiss = () => {
    window.removeEventListener("pointerdown", dismiss, true); window.removeEventListener("keydown", dismiss, true);
    hint.remove();
    try { localStorage.setItem(MOVE_HINT_SEEN, "1"); } catch { /* The hint may return next session. */ }
  };
  window.addEventListener("pointerdown", dismiss, true); window.addEventListener("keydown", dismiss, true);
  parent.append(hint);
}
