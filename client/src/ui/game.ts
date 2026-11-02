import { Story } from "inkjs";
import { data, translations } from "../content";
import { episodeStage, nextSegment } from "../core/flow";
import { npcMatches, score, type Input } from "../core/scoring";
import type { Village } from "../scenes/village";
import { Controls } from "../input/controls";
import type { VillageInput } from "../input/movement";
import { objectiveKey } from "./hud";

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
  private largeText = false;
  private controls: Controls;
  private notice = document.createElement("div");
  private noticeTimer = 0;
  private goal = document.createElement("div");
  private direction = document.createElement("div");
  private settingsButton = document.createElement("button");
  private settingsMenu = document.createElement("div");
  private exploring = false;
  private targets: string[] = [];
  private get worldApi() { return this.village as Village & { focusSpeaker?: (id: string | null) => void; targetScreenPos?: (id: string) => { x: number; y: number; onScreen: boolean } | null }; }
  constructor(app: HTMLElement, private village: Village) {
    this.controls = new Controls(app, village as Village & VillageInput);
    try { this.largeText = localStorage.getItem("abraxas-large-text") === "true"; } catch { /* Continue in memory if storage is unavailable. */ }
    document.documentElement.style.setProperty("--body-size", this.largeText ? "18px" : "15px");
    this.overlay.className = "overlay"; app.append(this.overlay);
    this.notice.className = "world-notice"; this.notice.setAttribute("role", "status"); app.append(this.notice);
    this.goal.className = "hud-goal"; this.goal.hidden = true; this.direction.className = "hud-direction"; this.direction.hidden = true; this.direction.setAttribute("aria-hidden", "true");
    this.settingsButton.className = "hud-settings-button"; this.settingsButton.textContent = "⚙"; this.settingsButton.addEventListener("click", () => this.settings());
    this.settingsMenu.className = "hud-menu"; this.settingsMenu.hidden = true; app.append(this.goal, this.direction, this.settingsButton, this.settingsMenu);
    let saved: Save | null = null; try { saved = JSON.parse(localStorage.getItem(storageKey) || "null") as Save | null; } catch { /* Storage may be unavailable. */ }
    this.state = saved?.playId && Array.isArray(saved.log) && Array.isArray(saved.completed) ? saved : { lang: "ko", playId: this.newId(), log: [], completed: [], segment: "title" };
    village.onInteract = id => this.interact(id);
    village.onPathBlocked = () => { this.notice.textContent = this.ui.pathBlocked; window.clearTimeout(this.noticeTimer); this.noticeTimer = window.setTimeout(() => { this.notice.textContent = ""; }, 2400); };
    if (saved?.playId && this.state.segment !== "title") { this.resumed = true; this.world(); } else this.title();
    requestAnimationFrame(this.updateDirection);
  }
  private newId(): string { return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`; }
  private save(): void { try { localStorage.setItem(storageKey, JSON.stringify(this.state)); } catch { /* Continue in memory if storage is unavailable. */ } }
  private get ui() { return translations(this.state.lang).ui; }
  private setTextSize(value: boolean): void { this.largeText = value; document.documentElement.style.setProperty("--body-size", value ? "18px" : "15px"); try { localStorage.setItem("abraxas-large-text", String(value)); } catch { /* Continue in memory if storage is unavailable. */ } }
  private restart(): void { this.state = { lang: this.state.lang, playId: this.newId(), log: [], completed: [], segment: "title" }; try { localStorage.removeItem(storageKey); } catch { /* Storage may be unavailable. */ } this.title(); }
  private settings(confirm = false): void {
    this.controls.setActive(false, this.state.lang); this.village.setEnabled(false); this.overlay.inert = true; this.settingsMenu.hidden = false;
    const card = document.createElement("div"); card.className = "hud-menu-card"; card.setAttribute("role", "dialog"); card.setAttribute("aria-modal", "true"); card.setAttribute("aria-label", this.ui.hud.settings);
    const heading = document.createElement("h2"); heading.textContent = confirm ? this.ui.hud.confirm : this.ui.hud.settings; card.append(heading);
    const add = (label: string, action: () => void) => { const button = document.createElement("button"); button.textContent = label; button.addEventListener("click", action); card.append(button); };
    const close = () => { this.settingsMenu.hidden = true; this.overlay.inert = false; if (this.exploring) { this.controls.setActive(true, this.state.lang); this.village.setEnabled(true); } this.settingsButton.focus(); };
    if (confirm) { add(this.ui.hud.restart, () => { close(); this.restart(); }); add(this.ui.hud.cancel, () => this.settings()); }
    else {
      add(`${this.ui.hud.language}: ${this.state.lang === "ko" ? "한국어" : "English"}`, () => { this.state.lang = this.state.lang === "ko" ? "en" : "ko"; this.save(); this.updateHud(); this.settings(); });
      add(`${this.ui.hud.largeText}: ${this.largeText ? this.ui.hud.on : this.ui.hud.off}`, () => { this.setTextSize(!this.largeText); this.settings(); });
      add(this.ui.hud.restart, () => this.settings(true)); add(this.ui.hud.close, close);
    }
    this.settingsMenu.replaceChildren(card); card.querySelector("button")?.focus();
  }
  private updateHud(): void {
    this.settingsButton.hidden = this.state.segment === "title" || this.state.segment === "result";
    this.settingsButton.setAttribute("aria-label", this.ui.hud.settings);
    this.goal.hidden = !this.exploring;
    if (this.exploring) this.goal.textContent = this.ui.hud.goal[objectiveKey(this.state.segment, episodeStage(this.answered(this.state.segment)))];
  }
  private updateDirection = (): void => {
    this.direction.hidden = true;
    if (this.exploring && this.settingsMenu.hidden && this.targets.length) {
      const positions = this.targets.map(id => this.worldApi.targetScreenPos?.(id)).filter((pos): pos is { x: number; y: number; onScreen: boolean } => !!pos);
      const pos = positions.some(point => point.onScreen) ? null : positions[0];
      if (pos && !pos.onScreen) {
        const rect = this.direction.parentElement!.getBoundingClientRect(), x = pos.x - rect.left - rect.width / 2, y = pos.y - rect.top - rect.height / 2;
        const scale = Math.min((rect.width / 2 - 24) / Math.max(Math.abs(x), 1), (rect.height / 2 - 24) / Math.max(Math.abs(y), 1));
        this.direction.style.left = `${rect.width / 2 + x * scale}px`; this.direction.style.top = `${rect.height / 2 + y * scale}px`; this.direction.textContent = "➤"; this.direction.style.rotate = `${Math.atan2(y, x)}rad`; this.direction.hidden = false;
      }
    }
    requestAnimationFrame(this.updateDirection);
  };
  private panel(text: string, buttons: [string, () => void][], kind: "dialogue" | "title" | "result" = "dialogue", speaker?: string): void {
    this.exploring = false; this.updateHud(); this.token++; const token = this.token; this.controls.setActive(false, this.state.lang); this.village.setEnabled(false); this.overlay.replaceChildren(); this.overlay.className = `overlay ${kind}`;
    const panel = document.createElement("div"); panel.className = "panel";
    const run = (action: () => void) => { if (token === this.token) { this.token++; action(); } };
    const button = (label: string, action: () => void) => { const element = document.createElement("button"); element.textContent = label; element.addEventListener("click", () => run(action)); return element; };
    if (kind === "title") {
      const [name, subtitle] = text.split("\n\n"); const heading = document.createElement("h1"); heading.textContent = name ?? ""; const p = document.createElement("p"); p.textContent = subtitle ?? ""; panel.append(heading, p);
      const controls = document.createElement("div"); controls.className = "title-controls"; for (const [label, action] of [...buttons].reverse()) controls.append(button(label, action)); const size = document.createElement("button"); size.textContent = this.largeText ? "가+" : "가"; size.setAttribute("aria-label", this.state.lang === "ko" ? "글자 크기 변경" : "Change text size"); size.setAttribute("aria-pressed", String(this.largeText)); size.addEventListener("click", () => { this.largeText = !this.largeText; document.documentElement.style.setProperty("--body-size", this.largeText ? "18px" : "15px"); try { localStorage.setItem("abraxas-large-text", String(this.largeText)); } catch { /* Continue in memory if storage is unavailable. */ } size.textContent = this.largeText ? "가+" : "가"; size.setAttribute("aria-pressed", String(this.largeText)); }); controls.append(size); this.overlay.append(panel, controls); return;
    }
    if (kind === "result") {
      const [title, modifier, ...rest] = text.split("\n\n"); const intro = document.createElement("div"); intro.className = "result-intro"; const details = document.createElement("div"); details.className = "result-details"; const heading = document.createElement("h2"); heading.textContent = title ?? ""; const badge = document.createElement("span"); badge.className = "modifier"; badge.textContent = modifier ?? ""; const list = document.createElement("ul"); for (const line of rest.slice(0, 4)) { const item = document.createElement("li"); item.textContent = line; list.append(item); } const disclaimer = document.createElement("p"); disclaimer.className = "disclaimer"; disclaimer.textContent = rest[4] ?? ""; const actions = document.createElement("div"); actions.className = "result-actions"; if (typeof navigator.share === "function") actions.append(button(this.ui.hud.share, () => { void navigator.share({ text: [title, modifier, ...rest.slice(0, 4)].join("\n") }).catch(() => {}); this.result(); })); for (const [label, action] of buttons) actions.append(button(label, action)); intro.append(heading, badge); details.append(list, disclaimer, actions); panel.append(intro, details); this.overlay.append(panel); return;
    }
    const match = text.match(/^([^:\n]+):\s*([\s\S]*)$/); const p = document.createElement("p"); p.textContent = match ? match[2]! : text;
    const speakerName = match?.[1]?.trim() ?? speaker; if (speakerName) { const index = Object.values(this.ui.npc).indexOf(speakerName); if (index >= 0 || quests.includes(speakerName)) this.worldApi.focusSpeaker?.(index >= 0 ? "ABCD"[index]! : speakerName); }
    if (match || speaker) { const name = document.createElement("span"); name.className = "speaker"; name.textContent = match ? match[1]!.trim() : speaker!; const index = Object.values(this.ui.npc).indexOf(name.textContent); name.style.backgroundColor = ["var(--char-a)", "var(--char-b)", "var(--char-c)", "var(--char-d)"][index] ?? "var(--char-npc)"; if (index < 0) name.style.color = "var(--paper)"; panel.append(name); }
    panel.append(p);
    if (buttons.length === 1 && buttons[0]![0] === this.ui.next) { panel.classList.add("continue"); panel.tabIndex = 0; panel.setAttribute("role", "button"); panel.setAttribute("aria-label", this.ui.next); panel.addEventListener("click", () => run(buttons[0]![1])); panel.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); if (!event.repeat) run(buttons[0]![1]); } }); const indicator = document.createElement("span"); indicator.className = "indicator"; indicator.textContent = "▼"; indicator.setAttribute("aria-hidden", "true"); panel.append(indicator); }
    this.overlay.append(panel);
    if (!(buttons.length === 1 && buttons[0]![0] === this.ui.next)) { this.overlay.classList.add("has-choices"); const choices = document.createElement("div"); choices.className = "choices"; for (const [label, action] of buttons) choices.append(button(label, action)); this.overlay.append(choices); }
  }
  private title(): void { this.worldApi.focusSpeaker?.(null); this.state.segment = "title"; this.panel(`${this.ui.title.name}\n\n${this.ui.title.subtitle}`, [[this.ui.title.language, () => { this.state.lang = this.state.lang === "ko" ? "en" : "ko"; this.title(); }], [this.ui.title.start, () => void this.open("prologue")]], "title"); }
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
  private showWorld(available: string[]): void { this.worldApi.focusSpeaker?.(null); this.exploring = true; this.targets = available; this.updateHud(); this.token++; this.overlay.replaceChildren(); this.controls.setActive(true, this.state.lang); this.village.setAvailable(available); this.village.setEnabled(true); }
  private answered(segment: string): number { return data.items.filter(item => item.segment === segment && this.state.log.some(entry => entry.id === item.id)).length; }
  private interact(id: string): void {
    if (id.startsWith("examine:")) {
      const lines = translations(this.state.lang).examine[id.slice(8)];
      if (lines?.length) {
        this.panel(lines[Math.floor(Math.random() * lines.length)]!, [[this.ui.next, () => { this.worldApi.focusSpeaker?.(null); this.exploring = true; if (this.goal) this.updateHud(); this.controls.setActive(true, this.state.lang); this.village.setEnabled(true); this.overlay.replaceChildren(); }]]);
        this.overlay.querySelector<HTMLElement>(".continue")?.focus();
      }
      return;
    }
    this.worldApi.focusSpeaker?.(id);
    const segment = this.state.segment;
    if (segment === "hub") { const index = "ABCD".indexOf(id); if (index >= 0 && !this.state.completed.includes(ids[index]!)) { void this.open(`ep_${ids[index]}`); return; } }
    else if (segment.startsWith("ep_")) { const index = ids.indexOf(segment.slice(3)); const stage = episodeStage(this.answered(segment)); if (id === (stage === "quest" ? quests[index] : "ABCD"[index])) { void this.open(segment); return; } }
    else if ((segment.startsWith("interlude_") && id === "lake") || (segment === "festival" && id === "plaza") || (segment === "gate" && id === "gate")) { void this.open(segment); return; }
    const idle = (this.ui as typeof this.ui & { idle?: Record<string, string> }).idle?.[id];
    this.panel(idle ?? (this.state.lang === "ko" ? "지금은 다른 곳을 살펴보자." : "Let's look somewhere else for now."), [[this.ui.next, () => this.world()]], "dialogue", id);
  }
  private async open(segment: string): Promise<void> {
    const continuing = segment === this.state.segment && this.story !== null;
    this.controls.setActive(false, this.state.lang); this.village.setEnabled(false); this.state.segment = segment; this.save(); if (!continuing) { this.story = null; this.lastLine = ""; } const token = ++this.token;
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
    if (item) { const copy = translations(this.state.lang).items[item.id]; const index = ids.indexOf(segment.slice(3)); const speaker = index >= 0 && episodeStage(this.answered(segment)) === "quest" ? quests[index] : item.npc ? this.ui.npc[item.npc as keyof typeof this.ui.npc] : undefined; this.panel(copy?.situation ?? item.situation, Object.entries(item.picks).map(([pick, value]) => [copy?.picks[pick] ?? value.text, () => this.choose(item, pick)]), "dialogue", speaker); return; }
    this.finish();
  }
  private choose(item: Item, pick: string): void {
    const entry = { id: item.id, pick }; const match = item.npc ? npcMatches(this.state, data, entry) : false; this.state.log.push(entry); this.save();
    if (item.npc) { const name = this.ui.npc[item.npc as keyof typeof this.ui.npc]; this.panel(`${name}: ${this.ui.reaction[match ? "empathy" : "thinking"][0]}`, [[this.ui.next, () => this.advance()]]); } else this.advance();
  }
  private finish(): void { const segment = this.state.segment; if (segment.startsWith("ep_") && !this.state.completed.includes(segment.slice(3))) this.state.completed.push(segment.slice(3)); this.state.segment = nextSegment(segment, this.state.completed.length); this.save(); this.world(); }
  private result(): void {
    const result = score(this.state, data); const axes = ["A", "B", "C", "D"] as const; const lines = axes.map((axis, i) => this.ui.result.poles[axis][result.type[i] === "OHVG"[i] ? "plus" : "minus"]);
    this.panel([this.ui.result.title, this.ui.result.modifier[result.modifier], ...lines, this.ui.result.disclaimer].join("\n\n"), [[this.ui.result.restart, () => this.restart()]], "result");
  }
}
