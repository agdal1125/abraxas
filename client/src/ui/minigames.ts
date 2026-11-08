import "./minigames.css";
import { sfx } from "./sfx";
import { aligned, gauge, inZone, scrambled, seeded, sequence, shelfHint, shuffledOrder, sorted, swap, turn } from "../core/minigames";

// One round of an errand minigame. `clear` fires once when the round is won; the caller saves progress
// and renders the next round. The element the player should tap next carries data-solve, so the
// manual E2E scenario can play it the way a person would.
export type MinigameKind = "ribbons" | "oven" | "shelf" | "gears";
export type MinigameCopy = { title: string; howto: string; watch: string; yourTurn: string; retry: string; cleared: string; action: string; early: string; late: string; marks: string[]; round: string };
export type Round = { kind: MinigameKind; index: number; rounds: number; label?: string; variant?: string };
export type Controls = { auto: string; close: string; onAuto: () => void; onClose: () => void };

export const MINIGAME_ROUNDS = 3;
const RIBBONS = ["pink", "yellow", "mint", "lilac"] as const;
const OVEN_ZONE = [.62, .8] as const;
const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
// Static, trusted markup only: the art below never contains player or server text.
const art = (className: string, markup: string): HTMLElement => { const node = document.createElement("span"); node.className = className; node.setAttribute("aria-hidden", "true"); node.innerHTML = markup; return node; };

export function minigameBoard(round: Round, copy: MinigameCopy, controls: Controls, clear: () => void, boardClass = "resident-board"): HTMLElement {
  const board = document.createElement("div"); board.className = `panel ${boardClass} minigame minigame-${round.kind}`;
  board.setAttribute("role", "dialog"); board.setAttribute("aria-label", copy.title);
  const heading = document.createElement("p"); heading.className = "minigame-heading";
  heading.textContent = `${copy.title} · ${copy.round.replace("{n}", String(round.index + 1)).replace("{total}", String(round.rounds))}${round.label ? ` · ${round.label}` : ""}`;
  const status = document.createElement("p"); status.className = "minigame-status"; status.setAttribute("role", "status"); status.textContent = copy.howto;
  const stage = document.createElement("div"); stage.className = "minigame-stage";
  const footer = document.createElement("div"); footer.className = "minigame-footer";
  let done = false; const win = () => { if (done) return; done = true; sfx.cleared(); status.textContent = copy.cleared; board.classList.add("is-cleared"); stop(); setTimeout(clear, 650); };
  const auto = document.createElement("button"); auto.textContent = controls.auto; auto.onclick = () => { if (!done) { done = true; stop(); controls.onAuto(); } };
  const close = document.createElement("button"); close.textContent = controls.close; close.onclick = () => { if (!done) { done = true; stop(); controls.onClose(); } };
  footer.append(auto, close);
  board.append(heading, status, stage, footer);
  const stop = { ribbons, oven, shelf, gears }[round.kind](stage, status, copy, round, win);
  return board;
}

// Starts focus on the play area, never on the skip button: the ribbons are disabled while they play back.
export function focusMinigame(board: HTMLElement): void {
  const target = board.querySelector<HTMLElement>(".minigame-stage button:not(:disabled)");
  if (target) { target.focus(); return; }
  board.tabIndex = -1; board.focus();
}

type Game = (stage: HTMLElement, status: HTMLElement, copy: MinigameCopy, round: Round, win: () => void) => () => void;

// A faceted bow: two loops, a knot and two tails, each with a lighter and a darker face like the village's flat shading.
const BOW = `<svg viewBox="0 0 64 64"><path class="dark" d="M30 32 8 18 6 44Z"/><path class="light" d="M30 32 8 18 18 34Z"/><path class="dark" d="M34 32 56 18 58 44Z"/><path class="light" d="M34 32 56 18 46 34Z"/><path class="dark" d="M28 34 20 60 27 56 31 36Z"/><path class="light" d="M36 34 44 60 37 56 33 36Z"/><rect class="knot" x="26" y="26" width="12" height="12" rx="2"/></svg>`;
// Lumi: watch the ribbons light up, then tap them back in the same order. A garland fills one pennant per correct tap.
const ribbons: Game = (stage, status, copy, round, win) => {
  const order = sequence(RIBBONS, 3 + round.index, seeded(101 + round.index));
  const garland = document.createElement("div"); garland.className = "garland"; garland.setAttribute("aria-hidden", "true");
  const flags = order.map(() => { const flag = document.createElement("span"); flag.className = "pennant"; garland.append(flag); return flag; });
  const row = document.createElement("div"); row.className = "ribbon-row";
  const buttons = RIBBONS.map((color, i) => { const b = document.createElement("button"); b.className = `ribbon ribbon-${color}`; b.dataset.ribbon = color; b.setAttribute("aria-label", copy.marks[i] ?? color); b.append(art("ribbon-art", BOW)); row.append(b); return b; });
  stage.append(garland, row);
  let step = 0, timers: ReturnType<typeof setTimeout>[] = [];
  const mark = () => { for (const b of buttons) delete b.dataset.solve; if (step < order.length) buttons[RIBBONS.indexOf(order[step]!)]!.dataset.solve = "1"; };
  const fill = () => flags.forEach((flag, i) => { flag.className = i < step ? `pennant ribbon-${order[i]}` : "pennant"; });
  const show = () => {
    step = 0; fill(); for (const b of buttons) { b.disabled = true; delete b.dataset.solve; }
    status.textContent = copy.watch;
    const beat = reducedMotion() ? 900 : 650;
    order.forEach((color, i) => {
      const b = buttons[RIBBONS.indexOf(color)]!;
      timers.push(setTimeout(() => { b.classList.add("lit"); sfx.ribbon(RIBBONS.indexOf(color)); }, beat * i + 300), setTimeout(() => b.classList.remove("lit"), beat * i + 300 + beat * .6));
    });
    timers.push(setTimeout(() => { for (const b of buttons) b.disabled = false; status.textContent = copy.yourTurn; mark(); }, beat * order.length + 300));
  };
  buttons.forEach((b, i) => b.addEventListener("click", () => {
    if (RIBBONS[i] !== order[step]) { sfx.wrong(); status.textContent = copy.retry; garland.classList.add("shake"); timers.push(setTimeout(() => garland.classList.remove("shake"), 400), setTimeout(show, 700)); for (const x of buttons) x.disabled = true; return; }
    b.classList.add("lit"); sfx.ribbon(i); timers.push(setTimeout(() => b.classList.remove("lit"), 200));
    step++; fill(); mark(); if (step === order.length) win();
  }));
  show();
  return () => { for (const t of timers) clearTimeout(t); timers = []; };
};

// Bread silhouettes for each round's batch.
const BREAD: Record<string, string> = {
  walnut: `<ellipse class="crust" cx="40" cy="30" rx="22" ry="15"/><path class="score" d="M28 24q6 4 0 9M40 21q6 5 0 11M52 24q6 4 0 9"/>`,
  roll: `<ellipse class="crust" cx="40" cy="30" rx="26" ry="11"/><path class="score" d="M24 27h32M28 33h24"/>`,
  flower: `<g class="crust"><circle cx="40" cy="18" r="8"/><circle cx="52" cy="27" r="8"/><circle cx="47" cy="40" r="8"/><circle cx="33" cy="40" r="8"/><circle cx="28" cy="27" r="8"/><circle cx="40" cy="30" r="9"/></g><circle class="score-dot" cx="40" cy="30" r="3"/>`,
};
// Dough to golden to burnt, following the needle so the player sees the bread bake.
const DOUGH: [number, [number, number, number]][] = [[0, [243, 227, 195]], [.62, [226, 160, 74]], [.8, [196, 120, 46]], [1, [96, 54, 28]]];
function crust(value: number): string {
  const upper = DOUGH.findIndex(([at]) => at >= value), [b, to] = DOUGH[Math.max(upper, 1)]!, [a, from] = DOUGH[Math.max(upper, 1) - 1]!;
  const t = b === a ? 0 : (value - a) / (b - a);
  return `rgb(${from.map((c, i) => Math.round(c + (to[i]! - c) * t)).join(" ")})`;
}
// Moka: stop the oven needle inside the golden band; the bread in the window browns as the needle moves.
const oven: Game = (stage, status, copy, round, win) => {
  const box = art("oven", `<svg viewBox="0 0 160 96"><path class="brick" d="M8 92V40Q8 6 80 6T152 40V92Z"/><path class="brick-line" d="M8 40h144M8 64h144M44 16v24M116 16v24M80 40v24M44 64v28M116 64v28"/><path class="mouth" d="M36 88V54Q36 30 80 30T124 54V88Z"/><g class="bread" transform="translate(40 40)">${BREAD[round.variant ?? "walnut"] ?? BREAD.walnut}</g></svg>`);
  const bar = document.createElement("div"); bar.className = "oven-bar";
  const zone = document.createElement("span"); zone.className = "oven-zone"; zone.style.left = `${OVEN_ZONE[0] * 100}%`; zone.style.width = `${(OVEN_ZONE[1] - OVEN_ZONE[0]) * 100}%`;
  const needle = document.createElement("span"); needle.className = "oven-needle"; bar.append(zone, needle);
  const button = document.createElement("button"); button.className = "oven-action"; button.textContent = copy.action;
  const controls = document.createElement("div"); controls.className = "oven-controls"; controls.append(bar, button);
  stage.append(box, controls);
  const bread = box.querySelector<SVGGElement>(".bread")!;
  const period = (reducedMotion() ? 3.2 : 2.2) - round.index * .2, start = performance.now();
  let frame = 0, value = 0, inside = false;
  const tick = () => {
    value = gauge((performance.now() - start) / 1000, period);
    // A soft tick as the needle enters the band gives an audio cue for the timing.
    if (inZone(value, OVEN_ZONE) !== inside) { inside = !inside; if (inside) sfx.ovenTick(); }
    needle.style.left = `${value * 100}%`; bread.style.setProperty("--crust", crust(value));
    if (inZone(value, OVEN_ZONE)) button.dataset.solve = "1"; else delete button.dataset.solve;
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  button.addEventListener("click", () => { if (inZone(value, OVEN_ZONE)) { cancelAnimationFrame(frame); sfx.ovenDing(); win(); } else { sfx.ovenThud(); status.textContent = value < OVEN_ZONE[0] ? copy.early : copy.late; } });
  return () => cancelAnimationFrame(frame);
};

// Echo: swap books until their spine marks run in order. Taller books carry later marks, so the finished row steps up.
const shelf: Game = (stage, status, copy, round, win) => {
  let order = shuffledOrder(4 + Math.min(round.index, 1), seeded(211 + round.index)), picked: number | null = null;
  const case_ = document.createElement("div"); case_.className = "bookcase";
  const row = document.createElement("div"); row.className = "shelf-row"; case_.append(row); stage.append(case_);
  const render = () => {
    row.replaceChildren();
    const hint = shelfHint(order);
    order.forEach((book, spot) => {
      const b = document.createElement("button"); b.className = `book book-${book % 4}`; b.style.setProperty("--height", `${78 + book * 6}px`);
      const plate = document.createElement("span"); plate.className = "book-plate"; plate.textContent = copy.marks[book] ?? String(book + 1);
      const bands = document.createElement("span"); bands.className = "book-bands"; bands.setAttribute("aria-hidden", "true"); b.append(bands, plate);
      b.setAttribute("aria-pressed", String(picked === spot)); if (book === spot) b.classList.add("in-place");
      if (hint && spot === (picked === null ? hint[0] : picked === hint[0] ? hint[1] : hint[0])) b.dataset.solve = "1";
      b.onclick = () => {
        if (picked === null) { picked = spot; sfx.bookTok(); render(); return; }
        if (picked !== spot) { order = swap(order, picked, spot); sfx.bookSwap(); }
        picked = null; render(); if (sorted(order)) win();
      };
      row.append(b);
    });
  };
  render();
  return () => {};
};

// An eight-tooth gear with a bright tooth that must point up to the arrow.
const GEAR = `<svg viewBox="-34 -34 68 68"><g class="gear-body">${Array.from({ length: 8 }, (_, i) => `<rect class="tooth${i === 0 ? " key" : ""}" x="-6" y="-32" width="12" height="12" rx="2" transform="rotate(${i * 45})"/>`).join("")}<circle class="rim" r="22"/><circle class="face" r="16"/><circle class="hub" r="6"/></g></svg>`;
// Or: turn each gear until its bright tooth points up to the arrow.
const gears: Game = (stage, status, copy, round, win) => {
  let rotations = scrambled(2 + round.index, seeded(307 + round.index));
  const row = document.createElement("div"); row.className = "gear-row"; stage.append(row);
  const buttons = rotations.map((_, i) => {
    const b = document.createElement("button"); b.className = "gear"; b.setAttribute("aria-label", `${copy.marks[i] ?? i + 1}`);
    b.append(art("gear-arrow", "▼"), art("gear-art", GEAR));
    b.onclick = () => { rotations = turn(rotations, i); if (rotations[i] === 0) sfx.gearSet(); else sfx.gearClick(); paint(); if (aligned(rotations)) win(); };
    row.append(b); return b;
  });
  // Rotation accumulates so a quarter turn from 270° keeps spinning forward instead of snapping back.
  const spins = rotations.map(value => value);
  const paint = () => buttons.forEach((b, i) => {
    const value = rotations[i]!;
    while (spins[i]! % 4 !== value) spins[i] = spins[i]! + 1;
    b.style.setProperty("--turn", String(spins[i]));
    b.classList.toggle("set", value === 0);
    if (value !== 0) b.dataset.solve = "1"; else delete b.dataset.solve;
  });
  paint();
  return () => {};
};
