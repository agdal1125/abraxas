import { Story } from "inkjs";
import { data, translations } from "../content";
import { episodeStage, nextSegment } from "../core/flow";
import { npcMatches, score, type Input } from "../core/scoring";
import type { Village } from "../scenes/village";

type Lang = "ko" | "en";
type Save = { lang: Lang; playId: string; log: Input["log"]; completed: string[]; segment: string };
type Item = typeof data.items[number] | typeof data.tiebreakers[number];
const ids = ["lumi", "moka", "echo", "or"];
const quests = ["s1j2", "v1j2", "t1p2", "s2j2"];
const storageKey = "abraxas-prototype";

export class Game {
  private state: Save;
  private overlay = document.createElement("div");
  private token = 0;
  private story: Story | null = null;
  private lastLine = "";
  private resumed = false;
  private episodeLimit = 6;
  constructor(app: HTMLElement, private village: Village) {
    this.overlay.className = "overlay"; app.append(this.overlay);
    let saved: Save | null = null; try { saved = JSON.parse(localStorage.getItem(storageKey) || "null") as Save | null; } catch { /* Storage may be unavailable. */ }
    this.state = saved?.playId && Array.isArray(saved.log) && Array.isArray(saved.completed) ? saved : { lang: "ko", playId: this.newId(), log: [], completed: [], segment: "title" };
    village.onInteract = id => this.interact(id);
    if (saved?.playId && this.state.segment !== "title") { this.resumed = true; this.world(); } else this.title();
  }
  private newId(): string { return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`; }
  private save(): void { try { localStorage.setItem(storageKey, JSON.stringify(this.state)); } catch { /* Continue in memory if storage is unavailable. */ } }
  private get ui() { return translations(this.state.lang).ui; }
  private panel(text: string, buttons: [string, () => void][], kind: "dialogue" | "title" | "result" = "dialogue"): void {
    this.token++; const token = this.token; this.village.setEnabled(false); this.overlay.replaceChildren(); this.overlay.className = `overlay ${kind}`;
    const panel = document.createElement("div"); panel.className = "panel";
    const run = (action: () => void) => { if (token === this.token) { this.token++; action(); } };
    const button = (label: string, action: () => void) => { const element = document.createElement("button"); element.textContent = label; element.addEventListener("click", () => run(action)); return element; };
    if (kind === "title") {
      const [name, subtitle] = text.split("\n\n"); const heading = document.createElement("h1"); heading.textContent = name ?? ""; const p = document.createElement("p"); p.textContent = subtitle ?? ""; panel.append(heading, p);
      const controls = document.createElement("div"); controls.className = "title-controls"; for (const [label, action] of [...buttons].reverse()) controls.append(button(label, action)); this.overlay.append(panel, controls); return;
    }
    if (kind === "result") {
      const [title, modifier, ...rest] = text.split("\n\n"); const heading = document.createElement("h2"); heading.textContent = title ?? ""; const badge = document.createElement("span"); badge.className = "modifier"; badge.textContent = modifier ?? ""; const list = document.createElement("ul"); for (const line of rest.slice(0, 4)) { const item = document.createElement("li"); item.textContent = line; list.append(item); } const disclaimer = document.createElement("p"); disclaimer.className = "disclaimer"; disclaimer.textContent = rest[4] ?? ""; panel.append(heading, badge, list, disclaimer); for (const [label, action] of buttons) panel.append(button(label, action)); this.overlay.append(panel); return;
    }
    const match = text.match(/^([^:\n]+):\s*([\s\S]*)$/); const p = document.createElement("p"); p.textContent = match ? match[2]! : text;
    if (match) { const name = document.createElement("span"); name.className = "speaker"; name.textContent = match[1]!.trim(); const index = Object.values(this.ui.npc).indexOf(name.textContent); name.style.backgroundColor = ["var(--char-a)", "var(--char-b)", "var(--char-c)", "var(--char-d)"][index] ?? "var(--char-npc)"; panel.append(name); }
    panel.append(p);
    if (buttons.length === 1 && buttons[0]![0] === this.ui.next) { panel.classList.add("continue"); panel.tabIndex = 0; panel.setAttribute("role", "button"); panel.setAttribute("aria-label", this.ui.next); panel.addEventListener("click", () => run(buttons[0]![1])); panel.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); run(buttons[0]![1]); } }); const indicator = document.createElement("span"); indicator.className = "indicator"; indicator.textContent = "▼"; indicator.setAttribute("aria-hidden", "true"); panel.append(indicator); }
    else { const choices = document.createElement("div"); choices.className = "choices"; for (const [label, action] of buttons) choices.append(button(label, action)); this.overlay.append(choices); }
    this.overlay.append(panel);
  }
  private title(): void { this.state.segment = "title"; this.panel(`${this.ui.title.name}\n\n${this.ui.title.subtitle}`, [[this.ui.title.language, () => { this.state.lang = this.state.lang === "ko" ? "en" : "ko"; this.title(); }], [this.ui.title.start, () => void this.open("prologue")]], "title"); }
  private world(): void {
    const segment = this.state.segment;
    if (segment === "result") { this.result(); return; }
    if (segment === "prologue") { void this.open(segment); return; }
    if (segment.startsWith("ep_")) {
      const index = ids.indexOf(segment.slice(3)); const stage = episodeStage(this.answered(segment));
      if (stage === "done") { this.finish(); return; }
      this.showWorld([stage === "quest" ? quests[index]! : "ABCD"[index]!]); return;
    }
    if (segment.startsWith("interlude_")) { this.showWorld(["lake"]); return; }
    if (segment === "festival") { this.showWorld(["plaza"]); return; }
    if (segment === "gate") { this.showWorld(["gate"]); return; }
    this.state.segment = "hub"; this.save(); this.showWorld(ids.flatMap((id, index) => this.state.completed.includes(id) ? [] : ["ABCD"[index]!]));
  }
  private showWorld(available: string[]): void { this.token++; this.overlay.replaceChildren(); this.village.setAvailable(available); this.village.setEnabled(true); }
  private answered(segment: string): number { return data.items.filter(item => item.segment === segment && this.state.log.some(entry => entry.id === item.id)).length; }
  private interact(id: string): void {
    const segment = this.state.segment;
    if (segment === "hub") { const index = "ABCD".indexOf(id); if (index >= 0 && !this.state.completed.includes(ids[index]!)) { void this.open(`ep_${ids[index]}`); return; } }
    else if (segment.startsWith("ep_")) { const index = ids.indexOf(segment.slice(3)); const stage = episodeStage(this.answered(segment)); if (id === (stage === "quest" ? quests[index] : "ABCD"[index])) { void this.open(segment); return; } }
    else if ((segment.startsWith("interlude_") && id === "lake") || (segment === "festival" && id === "plaza") || (segment === "gate" && id === "gate")) { void this.open(segment); return; }
    this.panel(this.state.lang === "ko" ? "지금은 다른 곳을 살펴보자." : "Let's look somewhere else for now.", [[this.ui.next, () => this.world()]]);
  }
  private async open(segment: string): Promise<void> {
    const continuing = segment === this.state.segment && this.story !== null;
    this.village.setEnabled(false); this.state.segment = segment; this.save(); if (!continuing) { this.story = null; this.lastLine = ""; } const token = ++this.token;
    const answered = this.answered(segment); this.episodeLimit = answered < 3 ? 3 : answered < 5 ? 5 : 6;
    if (!continuing && !this.resumed && (segment === "prologue" || (segment === "ep_lumi" && this.answered(segment) === 0))) {
      try { const response = await fetch(`./ink/${this.state.lang}/${segment}.json`); if (response.ok) this.story = new Story(await response.text()); } catch { this.story = null; }
    }
    if (token !== this.token) return; this.resumed = false; this.advance();
  }
  private advance(): void {
    const segment = this.state.segment;
    if (segment.startsWith("ep_") && this.episodeLimit < 6 && this.answered(segment) >= this.episodeLimit) { this.world(); return; }
    if (this.story) {
      try {
        while (this.story.canContinue) { const line = (this.story.Continue() ?? "").trim(); if (line) { this.lastLine = line; this.panel(line, [[this.ui.next, () => this.advance()]]); return; } }
        if (this.story.currentChoices.length) { const choices = this.story.currentChoices; this.panel(this.lastLine, choices.map(choice => [choice.text, () => { const id = choice.tags?.find(tag => tag.startsWith("item:"))?.slice(5).trim(); const pick = choice.tags?.find(tag => tag.startsWith("pick:"))?.slice(5).trim(); const item = data.items.find(candidate => candidate.id === id && candidate.segment === segment); if ((id || pick) && (!item || !pick || !item.picks[pick] || this.state.log.some(entry => entry.id === id))) { this.story = null; this.advance(); return; } try { this.story!.ChooseChoiceIndex(choice.index); } catch { this.story = null; this.advance(); return; } if (item && pick) this.choose(item, pick); else this.advance(); }])); return; }
      } catch { /* Continue with remaining questions. */ }
      this.story = null;
    }
    const items = segment === "gate" ? data.tiebreakers : data.items.filter(item => item.segment === segment);
    const item = items.find(candidate => !this.state.log.some(entry => entry.id === candidate.id));
    if (item) { const copy = translations(this.state.lang).items[item.id]; this.panel(copy?.situation ?? item.situation, Object.entries(item.picks).map(([pick, value]) => [copy?.picks[pick] ?? value.text, () => this.choose(item, pick)])); return; }
    this.finish();
  }
  private choose(item: Item, pick: string): void {
    const entry = { id: item.id, pick }; const match = item.npc ? npcMatches(this.state, data, entry) : false; this.state.log.push(entry); this.save();
    if (item.npc) { const name = this.ui.npc[item.npc as keyof typeof this.ui.npc]; this.panel(`${name}: ${this.ui.reaction[match ? "empathy" : "thinking"][0]}`, [[this.ui.next, () => this.advance()]]); } else this.advance();
  }
  private finish(): void { const segment = this.state.segment; if (segment.startsWith("ep_") && !this.state.completed.includes(segment.slice(3))) this.state.completed.push(segment.slice(3)); this.state.segment = nextSegment(segment, this.state.completed.length); this.save(); this.world(); }
  private result(): void {
    const result = score(this.state, data); const axes = ["A", "B", "C", "D"] as const; const lines = axes.map((axis, i) => this.ui.result.poles[axis][result.type[i] === "OHVG"[i] ? "plus" : "minus"]);
    this.panel([this.ui.result.title, this.ui.result.modifier[result.modifier], ...lines, this.ui.result.disclaimer].join("\n\n"), [[this.ui.result.restart, () => { this.state = { lang: this.state.lang, playId: this.newId(), log: [], completed: [], segment: "title" }; try { localStorage.removeItem(storageKey); } catch { /* Storage may be unavailable. */ } this.title(); }]], "result");
  }
}
