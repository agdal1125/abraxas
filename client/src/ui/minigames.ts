import "./minigames.css";
import { aligned, gauge, inZone, scrambled, seeded, sequence, shelfHint, shuffledOrder, sorted, swap, turn } from "../core/minigames";

// One round of an errand minigame. `clear` fires once when the round is won; the caller saves progress
// and renders the next round. The element the player should tap next carries data-solve, so the
// manual E2E scenario can play it the way a person would.
export type MinigameKind = "ribbons" | "oven" | "shelf" | "gears";
export type MinigameCopy = { title: string; howto: string; watch: string; yourTurn: string; retry: string; cleared: string; action: string; early: string; late: string; marks: string[]; round: string };
export type Round = { kind: MinigameKind; index: number; rounds: number; label?: string };
export type Controls = { auto: string; close: string; onAuto: () => void; onClose: () => void };

export const MINIGAME_ROUNDS = 3;
const RIBBONS = ["pink", "yellow", "mint", "lilac"] as const;
const OVEN_ZONE = [.62, .8] as const;
const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function minigameBoard(round: Round, copy: MinigameCopy, controls: Controls, clear: () => void, boardClass = "resident-board"): HTMLElement {
  const board = document.createElement("div"); board.className = `panel ${boardClass} minigame minigame-${round.kind}`;
  board.setAttribute("role", "dialog"); board.setAttribute("aria-label", copy.title);
  const heading = document.createElement("p"); heading.className = "minigame-heading";
  heading.textContent = `${copy.title} · ${copy.round.replace("{n}", String(round.index + 1)).replace("{total}", String(round.rounds))}${round.label ? ` · ${round.label}` : ""}`;
  const status = document.createElement("p"); status.className = "minigame-status"; status.setAttribute("role", "status"); status.textContent = copy.howto;
  const stage = document.createElement("div"); stage.className = "minigame-stage";
  const footer = document.createElement("div"); footer.className = "minigame-footer";
  let done = false; const win = () => { if (done) return; done = true; status.textContent = copy.cleared; stop(); setTimeout(clear, 450); };
  const auto = document.createElement("button"); auto.textContent = controls.auto; auto.onclick = () => { if (!done) { done = true; stop(); controls.onAuto(); } };
  const close = document.createElement("button"); close.textContent = controls.close; close.onclick = () => { if (!done) { done = true; stop(); controls.onClose(); } };
  footer.append(auto, close);
  board.append(heading, status, stage, footer);
  const stop = { ribbons, oven, shelf, gears }[round.kind](stage, status, copy, round.index, win);
  return board;
}

// Starts focus on the play area, never on the skip button: the ribbons are disabled while they play back.
export function focusMinigame(board: HTMLElement): void {
  const target = board.querySelector<HTMLElement>(".minigame-stage button:not(:disabled)");
  if (target) { target.focus(); return; }
  board.tabIndex = -1; board.focus();
}

type Game = (stage: HTMLElement, status: HTMLElement, copy: MinigameCopy, index: number, win: () => void) => () => void;

// Lumi: watch the ribbons light up, then tap them back in the same order.
const ribbons: Game = (stage, status, copy, index, win) => {
  const order = sequence(RIBBONS, 3 + index, seeded(101 + index));
  const buttons = RIBBONS.map((color, i) => { const b = document.createElement("button"); b.className = `ribbon ribbon-${color}`; b.dataset.ribbon = color; b.setAttribute("aria-label", copy.marks[i] ?? color); stage.append(b); return b; });
  let step = 0, timers: ReturnType<typeof setTimeout>[] = [];
  const mark = () => { for (const b of buttons) delete b.dataset.solve; if (step < order.length) buttons[RIBBONS.indexOf(order[step]!)]!.dataset.solve = "1"; };
  const show = () => {
    step = 0; for (const b of buttons) { b.disabled = true; delete b.dataset.solve; }
    status.textContent = copy.watch;
    const beat = reducedMotion() ? 900 : 650;
    order.forEach((color, i) => {
      const b = buttons[RIBBONS.indexOf(color)]!;
      timers.push(setTimeout(() => b.classList.add("lit"), beat * i + 300), setTimeout(() => b.classList.remove("lit"), beat * i + 300 + beat * .6));
    });
    timers.push(setTimeout(() => { for (const b of buttons) b.disabled = false; status.textContent = copy.yourTurn; mark(); }, beat * order.length + 300));
  };
  buttons.forEach((b, i) => b.addEventListener("click", () => {
    if (RIBBONS[i] !== order[step]) { status.textContent = copy.retry; timers.push(setTimeout(show, 700)); for (const x of buttons) x.disabled = true; return; }
    b.classList.add("lit"); timers.push(setTimeout(() => b.classList.remove("lit"), 200));
    step++; mark(); if (step === order.length) win();
  }));
  show();
  return () => { for (const t of timers) clearTimeout(t); timers = []; };
};

// Moka: stop the oven needle inside the golden band.
const oven: Game = (stage, status, copy, index, win) => {
  const bar = document.createElement("div"); bar.className = "oven-bar";
  const zone = document.createElement("span"); zone.className = "oven-zone"; zone.style.left = `${OVEN_ZONE[0] * 100}%`; zone.style.width = `${(OVEN_ZONE[1] - OVEN_ZONE[0]) * 100}%`;
  const needle = document.createElement("span"); needle.className = "oven-needle"; bar.append(zone, needle);
  const button = document.createElement("button"); button.className = "oven-action"; button.textContent = copy.action;
  stage.append(bar, button);
  const period = (reducedMotion() ? 3.2 : 2.2) - index * .2, start = performance.now();
  let frame = 0, value = 0;
  const tick = () => { value = gauge((performance.now() - start) / 1000, period); needle.style.left = `${value * 100}%`; if (inZone(value, OVEN_ZONE)) button.dataset.solve = "1"; else delete button.dataset.solve; frame = requestAnimationFrame(tick); };
  frame = requestAnimationFrame(tick);
  button.addEventListener("click", () => { if (inZone(value, OVEN_ZONE)) win(); else status.textContent = value < OVEN_ZONE[0] ? copy.early : copy.late; });
  return () => cancelAnimationFrame(frame);
};

// Echo: swap books until their spine marks run in order.
const shelf: Game = (stage, status, copy, index, win) => {
  let order = shuffledOrder(4 + Math.min(index, 1), seeded(211 + index)), picked: number | null = null;
  const row = document.createElement("div"); row.className = "shelf-row"; stage.append(row);
  const render = () => {
    row.replaceChildren();
    const hint = shelfHint(order);
    order.forEach((book, spot) => {
      const b = document.createElement("button"); b.className = `book book-${book % 4}`; b.textContent = copy.marks[book] ?? String(book + 1);
      b.setAttribute("aria-pressed", String(picked === spot));
      if (hint && spot === (picked === null ? hint[0] : picked === hint[0] ? hint[1] : hint[0])) b.dataset.solve = "1";
      b.onclick = () => {
        if (picked === null) { picked = spot; render(); return; }
        if (picked !== spot) order = swap(order, picked, spot);
        picked = null; render(); if (sorted(order)) win();
      };
      row.append(b);
    });
  };
  render();
  return () => {};
};

// Or: turn each gear until its tooth points up to the arrow.
const gears: Game = (stage, status, copy, index, win) => {
  let rotations = scrambled(2 + index, seeded(307 + index));
  const row = document.createElement("div"); row.className = "gear-row"; stage.append(row);
  const render = () => {
    row.replaceChildren();
    rotations.forEach((value, i) => {
      const b = document.createElement("button"); b.className = "gear"; b.style.setProperty("--turn", String(value)); b.setAttribute("aria-label", `${copy.marks[i] ?? i + 1}`);
      if (value !== 0) b.dataset.solve = "1"; else b.classList.add("set");
      b.onclick = () => { rotations = turn(rotations, i); render(); if (aligned(rotations)) win(); };
      row.append(b);
    });
  };
  render();
  return () => {};
};
