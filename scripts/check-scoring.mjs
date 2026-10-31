#!/usr/bin/env node
// Validates content/scoring/{items,npcs}.json against .agents/rules/game-design-policy.md
// and simulates the 16-type distribution.
// Usage: node scripts/check-scoring.mjs [dir]   (default: content/scoring)
// Exit code 1 when there is at least one error. Warnings never fail the run.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.resolve(root, process.argv[2] ?? path.join("content", "scoring"));

// ---- policy constants (keep in sync with .agents/rules/game-design-policy.md) ----
const MAIN = ["A", "B", "C", "D"];
const AXES = [...MAIN, "E"];
const POLE = { A: ["O", "I"], B: ["H", "L"], C: ["V", "K"], D: ["G", "C"] };
const SEGMENT_COUNTS = {
  prologue: 3, ep_lumi: 6, ep_moka: 6, ep_echo: 6, ep_or: 6,
  interlude_1: 2, interlude_2: 2, interlude_3: 2, festival: 5,
};
const AXIS_COUNTS = { A: 8, B: 8, C: 8, D: 8, E: 6 };
const NPCS = {
  lumi: { start: { A: 30, B: 30, C: 30, D: 30 }, theme: ["A", "C"] },
  moka: { start: { A: 30, B: 30, C: -30, D: -30 }, theme: ["B", "D"] },
  echo: { start: { A: -30, B: -30, C: 30, D: -30 }, theme: ["B", "C"] },
  or: { start: { A: -30, B: -30, C: -30, D: 30 }, theme: ["A", "D"] },
};
const KINDS = ["monologue", "errand", "dilemma", "puzzle_pre", "puzzle_post", "dialogue", "diary"];
const VALUES = ["자율", "자극", "즐거움", "성취", "영향력", "안전", "조화", "전통", "박애", "보편"];
const PRIMARY = [8, 15];
const SECONDARY = [3, 5];
const TIE_ZONE = 10;
const GATE_W = 3;
const FORBIDDEN = [/mbti/i, /[A-E]\s*축/, /성향\s*치/, /호감도/, /외향|내향/];
const MIN_SHARE = 0.02;
const MAX_SHARE = 0.12;
const SIM_RUNS = 10000;

const errors = [];
const warnings = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);
const warn = (where, msg) => warnings.push(`${where}: ${msg}`);

function load(name) {
  const p = path.join(dir, name);
  if (!fs.existsSync(p)) {
    err(name, "file not found");
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    err(name, `invalid JSON (${e.message})`);
    return null;
  }
}

const inRange = (v, [lo, hi]) => Math.abs(v) >= lo && Math.abs(v) <= hi;

function checkText(where, text) {
  if (typeof text !== "string" || text.trim() === "") return err(where, "empty text");
  if (FORBIDDEN.some((re) => re.test(text))) err(where, `forbidden wording in player text: "${text}"`);
}

function checkPicks(where, item, { gate = false } = {}) {
  const picks = item.picks;
  if (!picks || typeof picks !== "object") return err(where, "picks missing");
  const keys = Object.keys(picks);
  if (!keys.includes("a") || !keys.includes("b")) err(where, "picks must include a and b");
  for (const k of keys) if (!["a", "b", "c"].includes(k)) err(where, `unknown pick key "${k}"`);

  const signs = new Set();
  for (const k of keys) {
    const p = picks[k];
    const pw = `${where}.${k}`;
    checkText(pw, p?.text);
    const w = p?.w ?? {};
    for (const ax of Object.keys(w)) if (!AXES.includes(ax)) err(pw, `unknown axis "${ax}"`);
    const main = w[item.axis];
    if (typeof main !== "number" || main === 0) {
      err(pw, `no weight on primary axis ${item.axis}`);
      continue;
    }
    signs.add(Math.sign(main));
    if (gate) {
      if (Math.abs(main) !== GATE_W) err(pw, `tiebreaker weight must be ±${GATE_W}`);
      if (Object.keys(w).length !== 1) err(pw, "tiebreaker may only touch its own axis");
    } else {
      if (!inRange(main, PRIMARY)) err(pw, `primary weight ${main} outside ±${PRIMARY.join("~")}`);
      const others = Object.entries(w).filter(([ax]) => ax !== item.axis);
      if (others.length > 1) err(pw, "more than one secondary axis");
      for (const [ax, v] of others) if (!inRange(v, SECONDARY)) err(pw, `secondary ${ax}=${v} outside ±${SECONDARY.join("~")}`);
    }
    if (!gate && item.kind === "dilemma") {
      const vals = p.values;
      if (!Array.isArray(vals) || vals.length < 1 || vals.length > 2) err(pw, "dilemma pick needs 1~2 value tags");
    }
    if (Array.isArray(p.values)) for (const v of p.values) if (!VALUES.includes(v)) err(pw, `unknown value tag "${v}"`);
  }
  if (!(signs.has(1) && signs.has(-1))) err(where, `picks do not cover both poles of ${item.axis}`);
}

// ---- items.json ----
const data = load("items.json");
const items = Array.isArray(data?.items) ? data.items : [];
const gates = Array.isArray(data?.tiebreakers) ? data.tiebreakers : [];
if (data && !Array.isArray(data.items)) err("items.json", "items must be an array");

const ids = new Set();
const segCount = {};
const axisCount = {};
const firstPickSign = {};
const npcAxis = {};
let npcFree = 0;

for (const [i, it] of items.entries()) {
  const where = `items[${i}]${it?.id ? ` ${it.id}` : ""}`;
  if (!/^[a-z0-9]+(_[a-z0-9]+)*_\d{2}$/.test(it.id ?? "")) err(where, "id must look like <segment>_<NN>");
  if (ids.has(it.id)) err(where, "duplicate id");
  ids.add(it.id);
  if (!(it.segment in SEGMENT_COUNTS)) err(where, `unknown segment "${it.segment}"`);
  if (!KINDS.includes(it.kind)) err(where, `unknown kind "${it.kind}"`);
  if (!AXES.includes(it.axis)) {
    err(where, `unknown axis "${it.axis}"`);
    continue;
  }
  checkText(`${where}.situation`, it.situation);

  segCount[it.segment] = (segCount[it.segment] ?? 0) + 1;
  axisCount[it.axis] = (axisCount[it.axis] ?? 0) + 1;

  const epNpc = it.segment?.startsWith("ep_") ? it.segment.slice(3) : null;
  if (epNpc) {
    if (it.npc !== epNpc) err(where, `npc must be "${epNpc}" in ${it.segment}`);
    const theme = NPCS[epNpc]?.theme ?? [];
    if (!theme.includes(it.axis)) err(where, `${epNpc} items may only measure ${theme.join("/")}`);
    const key = `${epNpc}:${it.axis}`;
    npcAxis[key] = (npcAxis[key] ?? 0) + 1;
  } else {
    if (it.npc != null) err(where, "npc must be null outside ep_* segments");
    npcFree++;
  }

  checkPicks(where, it);
  const s = Math.sign(it.picks?.a?.w?.[it.axis] ?? 0);
  if (s) (firstPickSign[it.axis] ??= []).push(s);
}

for (const [seg, n] of Object.entries(SEGMENT_COUNTS)) {
  if ((segCount[seg] ?? 0) !== n) err("segments", `${seg} has ${segCount[seg] ?? 0} items, expected ${n}`);
}
for (const [ax, n] of Object.entries(AXIS_COUNTS)) {
  if ((axisCount[ax] ?? 0) !== n) err("axes", `${ax} has ${axisCount[ax] ?? 0} items, expected ${n}`);
  const signs = firstPickSign[ax] ?? [];
  const plus = signs.filter((v) => v > 0).length;
  if (signs.length && plus * 2 !== signs.length) err("counterbalance", `${ax}: pick a is + pole in ${plus}/${signs.length} items, expected half`);
}
for (const [npc, def] of Object.entries(NPCS)) {
  for (const ax of def.theme) {
    const n = npcAxis[`${npc}:${ax}`] ?? 0;
    if (n !== 3) err("npc", `${npc} measures ${ax} in ${n} items, expected 3`);
  }
}
if (items.length && npcFree < 14) err("npc", `only ${npcFree} items without NPC expectation, need ≥ 14`);

// ---- tiebreakers ----
const gateAxes = gates.map((g) => g.axis).sort().join("");
if (gateAxes !== "ABCD") err("tiebreakers", `need exactly one per A,B,C,D (got "${gateAxes}")`);
for (const [i, g] of gates.entries()) {
  const where = `tiebreakers[${i}] ${g.id ?? ""}`;
  if (g.id !== `gate_${String(g.axis).toLowerCase()}`) err(where, `id must be gate_${String(g.axis).toLowerCase()}`);
  if (ids.has(g.id)) err(where, "id collides with an item");
  checkText(`${where}.situation`, g.situation);
  checkPicks(where, g, { gate: true });
}

// ---- npcs.json ----
const npcData = load("npcs.json");
const npcList = Array.isArray(npcData?.npcs) ? npcData.npcs : [];
if (npcData && npcList.map((n) => n.id).sort().join(",") !== Object.keys(NPCS).sort().join(",")) {
  err("npcs.json", `npc ids must be ${Object.keys(NPCS).join(", ")}`);
}
for (const n of npcList) {
  const def = NPCS[n.id];
  if (!def) continue;
  for (const ax of MAIN) if (n.start?.[ax] !== def.start[ax]) err(`npcs.json ${n.id}`, `start.${ax} must be ${def.start[ax]}`);
  const e = n.start?.E;
  if (typeof e !== "number" || e < -100 || e > 100) err(`npcs.json ${n.id}`, "start.E must be a number in [-100, 100]");
  if ([...(n.themeAxes ?? [])].sort().join("") !== [...def.theme].sort().join("")) err(`npcs.json ${n.id}`, `themeAxes must be ${def.theme.join(",")}`);
}

// ---- simulation (only when structure is valid) ----
const clamp = (v) => Math.max(-100, Math.min(100, v));
function typeOf(s, gatePick) {
  return MAIN.map((ax) => {
    let v = s[ax];
    if (Math.abs(v) < TIE_ZONE) v = gatePick[ax];
    return v >= 0 ? POLE[ax][0] : POLE[ax][1];
  }).join("");
}
function play(choose) {
  const s = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  for (const it of items) {
    const w = it.picks[choose(it)].w;
    for (const [ax, v] of Object.entries(w)) s[ax] = clamp(s[ax] + v);
  }
  const gatePick = {};
  for (const g of gates) {
    const k = choose(g);
    const v = g.picks[k].w[g.axis];
    gatePick[g.axis] = Math.sign(v);
    s[g.axis] = clamp(s[g.axis] + v);
  }
  return { s, type: typeOf(s, gatePick) };
}

const report = [];
if (errors.length === 0 && items.length) {
  // 1) every pure profile must land on its own type
  const unreachable = [];
  for (let mask = 0; mask < 16; mask++) {
    const want = {};
    MAIN.forEach((ax, i) => (want[ax] = mask & (1 << i) ? -1 : 1));
    const expected = MAIN.map((ax) => (want[ax] > 0 ? POLE[ax][0] : POLE[ax][1])).join("");
    const choose = (it) => {
      const keys = Object.keys(it.picks);
      if (it.axis === "E") return keys[0];
      return keys.find((k) => Math.sign(it.picks[k].w[it.axis]) === want[it.axis]) ?? keys[0];
    };
    const got = play(choose).type;
    if (got !== expected) unreachable.push(`${expected}→${got}`);
  }
  if (unreachable.length) err("simulation", `consistent players do not get their own type: ${unreachable.join(", ")}`);

  // 2) expected drift per axis for a random player (secondary loadings that all lean one way skew types)
  const drift = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  for (const it of [...items, ...gates]) {
    const keys = Object.keys(it.picks);
    for (const k of keys) for (const [ax, v] of Object.entries(it.picks[k].w)) drift[ax] += v / keys.length;
  }
  for (const ax of AXES) {
    if (Math.abs(drift[ax]) > TIE_ZONE) warn("drift", `${ax}축이 무작위 선택에서도 평균 ${drift[ax] > 0 ? "+" : ""}${drift[ax].toFixed(1)} 쪽으로 치우침 (보조 적재·선택지 수 확인)`);
  }
  report.push(`축별 평균 치우침(무작위 선택): ${AXES.map((ax) => `${ax} ${drift[ax] >= 0 ? "+" : ""}${drift[ax].toFixed(1)}`).join(" · ")}`);

  // 3) random players
  let seed = 20261031;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const counts = {};
  const mods = { "오늘을 사는": 0, "오늘과 내일 사이": 0, "내일을 그리는": 0 };
  let tieDecided = 0;
  for (let r = 0; r < SIM_RUNS; r++) {
    const { s, type } = play((it) => {
      const keys = Object.keys(it.picks);
      return keys[Math.floor(rand() * keys.length)];
    });
    counts[type] = (counts[type] ?? 0) + 1;
    for (const ax of MAIN) if (Math.abs(s[ax]) < TIE_ZONE) tieDecided++;
    if (s.E >= TIE_ZONE) mods["오늘을 사는"]++;
    else if (s.E <= -TIE_ZONE) mods["내일을 그리는"]++;
    else mods["오늘과 내일 사이"]++;
  }
  const allTypes = [];
  for (let mask = 0; mask < 16; mask++) {
    allTypes.push(MAIN.map((ax, i) => (mask & (1 << i) ? POLE[ax][1] : POLE[ax][0])).join(""));
  }
  report.push(`16유형 분포 (무작위 선택 ${SIM_RUNS.toLocaleString()}회, 기대값 6.25%):`);
  for (const t of allTypes) {
    const share = (counts[t] ?? 0) / SIM_RUNS;
    const flag = share < MIN_SHARE || share > MAX_SHARE ? "  ← 경고" : "";
    report.push(`  ${t}  ${(share * 100).toFixed(2).padStart(5)}%${flag}`);
    if (flag) warn("distribution", `${t} ${(share * 100).toFixed(2)}% (허용 ${MIN_SHARE * 100}~${MAX_SHARE * 100}%)`);
  }
  report.push(`수식어: ${Object.entries(mods).map(([k, v]) => `${k} ${((v / SIM_RUNS) * 100).toFixed(1)}%`).join(" · ")}`);
  report.push(`타이브레이커로 결정된 축: 플레이당 평균 ${(tieDecided / SIM_RUNS).toFixed(2)}개`);
}

// ---- output ----
console.log(`검사 대상: ${path.relative(root, dir) || dir}`);
console.log(`문항 ${items.length}개 · 타이브레이커 ${gates.length}개\n`);
for (const line of report) console.log(line);
if (report.length) console.log("");
if (warnings.length) {
  console.log(`경고 ${warnings.length}개`);
  for (const w of warnings) console.log(`  · ${w}`);
}
if (errors.length) {
  console.log(`오류 ${errors.length}개`);
  for (const e of errors) console.log(`  ✘ ${e}`);
  process.exit(1);
}
console.log(warnings.length ? "구조 검사 통과 (경고 확인 필요)" : "모든 검사 통과");
