import type { Story } from "inkjs";
import { data, translations } from "../content";
import { episodeStage, nextSegment } from "../core/flow";
import { npcMatches, score, type Input } from "../core/scoring";
import type { Village } from "../scenes/village";
import { Controls } from "../input/controls";
import type { VillageInput } from "../input/movement";
import { objectiveKey } from "./hud";
import { mokaView, type BreadId, type SlotId } from "../core/moka-errand";
import { lumiView } from "../core/lumi-errand";
import { echoView } from "../core/echo-errand";
import { orView } from "../core/or-errand";
import { residentBoard, residentCommand, type Resident } from "./residents-errands";
import { contentVersionMatches, type Command, type PlaySnapshot } from "../core/play";
import { createPlay, loadCurrentPlay, recoverPending, sendCommand, PlayApiError, ResponseValidationError, type CommandResult } from "../net/plays";
import { clearPending, loadPending } from "../net/pending";
import { confirmedCommand } from "./moka-errand";
import quest from "../../../content/quests/moka-errand.json";
import "./moka-errand.css";

declare const __CONTENT_VERSION__: string;

type Lang = "ko" | "en";
type Save = { lang: Lang; playId: string; log: Input["log"]; completed: string[]; segment: string };
type Item = typeof data.items[number] | typeof data.tiebreakers[number];
const ids = ["lumi", "moka", "echo", "or"];
const quests = ["s1j2", "v1j2", "t1p2", "s2j2"];
const storageKey = "abraxas-prototype";

export class Game {
  private state: Save;
  private snapshot: PlaySnapshot | null = null;
  private local = false;
  private localSave: Save | null = null;
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
  private get worldApi() { return this.village as Village & { focusSpeaker?: (id: string | null) => void; targetScreenPos?: (id: string) => { x: number; y: number; onScreen: boolean } | null; setLumiView: (view: ReturnType<typeof lumiView> | null) => void; setEchoView: (view: ReturnType<typeof echoView> | null) => void; setOrView: (view: ReturnType<typeof orView> | null) => void; resumeLumi: () => Promise<void>; resumeEcho: () => Promise<void>; resumeOr: () => Promise<void> }; }
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
    this.localSave = saved?.playId && Array.isArray(saved.log) && Array.isArray(saved.completed) ? saved : null;
    this.state = { lang: this.localSave?.lang ?? "ko", playId: this.newId(), log: [], completed: [], segment: "title" };
    village.onInteract = id => this.interact(id);
    village.onPathBlocked = () => { this.notice.textContent = this.ui.pathBlocked; window.clearTimeout(this.noticeTimer); this.noticeTimer = window.setTimeout(() => { this.notice.textContent = ""; }, 2400); };
    this.title();
    requestAnimationFrame(this.updateDirection);
  }
  private newId(): string { return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`; }
  private save(): void { if (this.local) try { localStorage.setItem(storageKey, JSON.stringify(this.state)); this.localSave = this.state; } catch { /* Continue in memory if storage is unavailable. */ } }
  private get ui() { return translations(this.state.lang).ui; }
  private setTextSize(value: boolean): void { this.largeText = value; document.documentElement.style.setProperty("--body-size", value ? "18px" : "15px"); try { localStorage.setItem("abraxas-large-text", String(value)); } catch { /* Continue in memory if storage is unavailable. */ } }
  private clearViews(): void { this.village.setMokaView(null); this.worldApi.setLumiView(null); this.worldApi.setEchoView(null); this.worldApi.setOrView(null); }
  private restart(): void { this.local = false; this.snapshot = null; this.clearViews(); this.state = { lang: this.state.lang, playId: this.newId(), log: [], completed: [], segment: "title" }; this.title(); }
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
    if (this.exploring && this.snapshot?.segment === "ep_moka") {
      const view = mokaView(this.snapshot), copy = translations(this.state.lang).moka;
      const key = view.objectiveKey.split(".").at(-1) as keyof typeof copy.objective;
      this.goal.textContent = copy.objective[key];
      const carrying = document.createElement("span"); carrying.className = "moka-carry"; carrying.textContent = `${this.ui.carrying}: ${copy.items[view.basket === "player" ? "basket" : "empty"]}`; this.goal.append(carrying);
    } else if (this.exploring && this.snapshot && this.resident()) {
      const npc = this.resident()!, view = this.residentView(npc), copy = translations(this.state.lang).residents[npc];
      this.goal.textContent = copy.objective[view.objectiveKey.split(".").at(-1)!] ?? "";
      const carrying = document.createElement("span"); carrying.className = "moka-carry"; carrying.textContent = `${this.ui.carrying}: ${copy.items[view.carriedObjectId ?? "empty"] ?? ""}`; this.goal.append(carrying);
    } else if (this.exploring) this.goal.textContent = this.ui.hud.goal[objectiveKey(this.state.segment, episodeStage(this.answered(this.state.segment)))];
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
    const speakerName = match?.[1]?.trim() ?? speaker;
    const residentNames = Object.values(this.ui.npc), questNames = Object.values(this.ui.questNpc);
    const residentIndex = speakerName ? Math.max(residentNames.indexOf(speakerName), "ABCD".split("").indexOf(speakerName)) : -1;
    const questIndex = speakerName ? Math.max(questNames.indexOf(speakerName), quests.indexOf(speakerName)) : -1;
    if (residentIndex >= 0 || questIndex >= 0) this.worldApi.focusSpeaker?.(residentIndex >= 0 ? "ABCD"[residentIndex]! : quests[questIndex]!);
    if (speakerName && (match || residentIndex >= 0 || questIndex >= 0)) { const name = document.createElement("span"); name.className = "speaker"; name.textContent = residentNames[residentIndex] ?? questNames[questIndex] ?? speakerName; name.style.backgroundColor = ["var(--char-a)", "var(--char-b)", "var(--char-c)", "var(--char-d)"][residentIndex] ?? "var(--char-npc)"; if (residentIndex < 0) name.style.color = "var(--paper)"; panel.append(name); }
    panel.append(p);
    if (buttons.length === 1 && buttons[0]![0] === this.ui.next) { panel.classList.add("continue"); panel.tabIndex = 0; panel.setAttribute("role", "button"); panel.setAttribute("aria-label", this.ui.next); panel.addEventListener("click", () => run(buttons[0]![1])); panel.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); if (!event.repeat) run(buttons[0]![1]); } }); const indicator = document.createElement("span"); indicator.className = "indicator"; indicator.textContent = "▼"; indicator.setAttribute("aria-hidden", "true"); panel.append(indicator); }
    this.overlay.append(panel);
    if (!(buttons.length === 1 && buttons[0]![0] === this.ui.next)) { this.overlay.classList.add("has-choices"); const choices = document.createElement("div"); choices.className = "choices"; for (const [label, action] of buttons) choices.append(button(label, action)); this.overlay.append(choices); }
  }
  private applySnapshot(snapshot: PlaySnapshot): boolean {
    if (!contentVersionMatches(snapshot, __CONTENT_VERSION__)) { this.panel(translations(this.state.lang).moka.status.version, []); return false; }
    this.snapshot = snapshot;
    this.state = { ...this.state, playId: snapshot.playId, log: snapshot.answers, completed: snapshot.completedEpisodes, segment: snapshot.segment };
    this.village.setMokaView(mokaView(snapshot));
    this.worldApi.setLumiView(lumiView(snapshot)); this.worldApi.setEchoView(echoView(snapshot)); this.worldApi.setOrView(orView(snapshot));
    return true;
  }
  private async startServer(key = crypto.randomUUID()): Promise<void> {
    this.panel(translations(this.state.lang).moka.status.saving, []);
    try {
      let snapshot: PlaySnapshot;
      try { snapshot = await loadCurrentPlay(); } catch (error) {
        if (!(error instanceof PlayApiError) || error.status !== 404) throw error;
        snapshot = await createPlay(key);
      }
      this.local = false;
      if (!this.applySnapshot(snapshot)) return;
      const recovered = await recoverPending();
      if (recovered) { if (!recovered.pendingCleared) throw new Error("pending_unavailable"); if (!this.applySnapshot(recovered.snapshot)) return; snapshot = recovered.snapshot; }
      this.resumed = snapshot.answers.length > 0;
      if (snapshot.segment === "ep_moka") await this.village.resumeMoka();
      else if (snapshot.segment === "ep_lumi") await this.worldApi.resumeLumi();
      else if (snapshot.segment === "ep_echo") await this.worldApi.resumeEcho();
      else if (snapshot.segment === "ep_or") await this.worldApi.resumeOr();
      this.world();
    } catch (error) { if (error instanceof ResponseValidationError) this.panel(translations(this.state.lang).moka.status.invalidResponse, []); else this.panel(translations(this.state.lang).moka.status.retry, [[translations(this.state.lang).moka.status.reconnect, () => void this.startServer(key)]]); }
  }
  private async command(command: Command, after: (result: CommandResult) => void, retry = false): Promise<void> {
    if (!this.snapshot) return;
    this.panel(translations(this.state.lang).moka.status.saving, []);
    const apply = (result: CommandResult) => {
      if (!result.pendingCleared) { this.panel(translations(this.state.lang).moka.status.retry, [[translations(this.state.lang).moka.status.reconnect, () => void this.command(command, after, true)]]); return; }
      if (this.applySnapshot(result.snapshot)) after(result);
    };
    try {
      if (retry) { const record = loadPending(); if (record) apply(await sendCommand(record.playId, record.pending)); else await confirmedCommand(this.snapshot, command, sendCommand, apply); }
      else await confirmedCommand(this.snapshot, command, sendCommand, apply);
    } catch (error) {
      if (error instanceof ResponseValidationError) { this.panel(translations(this.state.lang).moka.status.invalidResponse, []); return; }
      if (error instanceof PlayApiError && error.status === 409 && error.snapshot) {
        try { const record = loadPending(); if (record) clearPending(record.playId, record.pending.key); } catch { this.panel(translations(this.state.lang).moka.status.retry, [[translations(this.state.lang).moka.status.reconnect, () => void this.command(command, after, true)]]); return; }
        if (this.applySnapshot(error.snapshot)) this.panel(translations(this.state.lang).moka.status.otherTab, [[this.ui.next, () => this.world()]]);
        return;
      }
      this.panel(translations(this.state.lang).moka.status.retry, [[translations(this.state.lang).moka.status.reconnect, () => void this.command(command, after, true)]]);
    }
  }
  private title(): void {
    this.worldApi.focusSpeaker?.(null); this.state.segment = "title";
    const buttons: [string, () => void][] = [[this.ui.title.language, () => { this.state.lang = this.state.lang === "ko" ? "en" : "ko"; this.title(); }], [this.ui.title.start, () => void this.startServer()]];
    if (this.localSave && this.localSave.segment !== "title") buttons.push([this.ui.continueLocal, () => { this.local = true; this.snapshot = null; this.clearViews(); this.state = structuredClone(this.localSave!); this.resumed = true; this.panel(this.ui.localExperience, [[this.ui.next, () => this.world()]]); }]);
    this.panel(`${this.ui.title.name}\n\n${this.ui.title.subtitle}`, buttons, "title");
  }
  private world(): void {
    const segment = this.state.segment;
    if (segment === "result") { this.result(); return; }
    if (segment === "prologue") { void this.open(segment); return; }
    if (segment === "ep_moka" && this.snapshot) { this.village.setMokaView(mokaView(this.snapshot)); this.showWorld(mokaView(this.snapshot).activeTargetIds); return; }
    if (this.snapshot && this.resident()) { this.showWorld(this.residentView(this.resident()!).activeTargetIds); return; }
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
    if (this.snapshot?.segment === "ep_moka") { this.interactMoka(id); return; }
    if (this.snapshot && this.resident()) { this.interactResident(this.resident()!, id); return; }
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
    if (segment === "hub") { const index = "ABCD".indexOf(id); if (index >= 0 && !this.state.completed.includes(ids[index]!)) { const npcId = ids[index]!; if (this.snapshot) void this.command({ kind: "open_episode", npcId }, () => { if (npcId === "moka") void this.openMoka(); else this.world(); }); else void this.open(`ep_${npcId}`); return; } }
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
      try { const response = await fetch(`./ink/${this.state.lang}/${segment}.json`); if (!response.ok) throw new Error("ink_unavailable"); const { Story } = await import("inkjs"); const content = await response.text(); if (token !== this.token) return; this.story = new Story(content); } catch { if (token === this.token) this.panel(translations(this.state.lang).moka.status.contentUnavailable, [[translations(this.state.lang).moka.status.tryAgain, () => void this.open(segment)]]); return; }
    }
    if (token !== this.token) return; this.resumed = false; this.advance();
  }
  private async openMoka(): Promise<void> {
    if (!this.snapshot) return;
    const knots: Partial<Record<PlaySnapshot["moka"]["phase"], string>> = { choose_route: "moka_meet", reservation: "moka_reservation", choose_display: "moka_choose_display", share: "moka_share", order: "moka_order", feedback: "moka_feedback" };
    const knot = knots[this.snapshot.moka.phase];
    if (!knot) { this.world(); return; }
    const token = ++this.token;
    try {
      const response = await fetch(`./ink/${this.state.lang}/ep_moka.json`);
      if (!response.ok) throw new Error("ink_unavailable");
      const { Story } = await import("inkjs");
      const story = new Story(await response.text()); story.ChoosePathString(knot);
      if (token !== this.token) return;
      this.story = story; this.lastLine = ""; this.advance();
    } catch { if (token === this.token) this.panel(translations(this.state.lang).moka.status.contentUnavailable, [[translations(this.state.lang).moka.status.tryAgain, () => void this.openMoka()]]); }
  }
  private async mokaNarrative(knot: string, after: () => void): Promise<void> {
    const token = ++this.token;
    try {
      const response = await fetch(`./ink/${this.state.lang}/ep_moka.json`);
      if (!response.ok) throw new Error("ink_unavailable");
      const { Story } = await import("inkjs");
      const story = new Story(await response.text()); story.ChoosePathString(knot);
      if (token !== this.token) return;
      const next = () => { while (story.canContinue) { const line = (story.Continue() ?? "").trim(); if (line) { this.panel(line, [[this.ui.next, next]]); return; } } after(); };
      next();
    } catch { if (token === this.token) this.panel(translations(this.state.lang).moka.status.contentUnavailable, [[translations(this.state.lang).moka.status.tryAgain, () => void this.mokaNarrative(knot, after)]]); }
  }
  private resident(): Resident | null { const id = this.state.segment.slice(3); return this.state.segment.startsWith("ep_") && (id === "lumi" || id === "echo" || id === "or") ? id : null; }
  private residentView(npc: Resident) { return npc === "lumi" ? lumiView(this.snapshot!) : npc === "echo" ? echoView(this.snapshot!) : orView(this.snapshot!); }
  private async residentNarrative(npc: Resident, knot: string, after: () => void, choice = false): Promise<void> {
    const token = ++this.token;
    try {
      const response = await fetch(`./ink/${this.state.lang}/ep_${npc}.json`);
      if (!response.ok) throw new Error("ink_unavailable");
      const { Story } = await import("inkjs");
      const story = new Story(await response.text()); story.ChoosePathString(knot);
      if (token !== this.token) return;
      if (choice) { this.story = story; this.lastLine = ""; this.advance(); return; }
      const next = () => { while (story.canContinue) { const line = (story.Continue() ?? "").trim(); if (line) { this.panel(line, [[this.ui.next, next]]); return; } } after(); };
      next();
    } catch { if (token === this.token) { const status = translations(this.state.lang).residents[npc].status; this.panel(status.contentUnavailable, [[status.tryAgain, () => void this.residentNarrative(npc, knot, after, choice)]]); } }
  }
  private interactResident(npc: Resident, id: string): void {
    if (!this.snapshot || !this.residentView(npc).activeTargetIds.includes(id)) { this.world(); return; }
    const snapshot = this.snapshot, phase = snapshot[npc].phase;
    if (phase.startsWith("choose_")) { void this.residentNarrative(npc, `${npc}_${phase}`, () => this.world(), true); return; }
    if (phase === "arrange" || phase === "gears") { void this.residentNarrative(npc, `${npc}_${phase}`, () => this.residentsBoard(npc)); return; }
    if (phase === "lantern_link") {
      void this.residentNarrative(npc, `${npc}_${phase}`, () => { const copy = translations(this.state.lang).residents[npc], send = () => void this.command({ kind: "act", targetId: id }, () => this.world()); this.panel(copy.objective.lantern_link ?? "", [[copy.items[id] ?? "", send], [copy.puzzle.hint, () => this.panel(copy.puzzle.linkHint, [[copy.items[id] ?? "", send], [copy.puzzle.linkAuto, send], [copy.puzzle.close, () => this.world()]])], [copy.puzzle.linkAuto, send], [copy.puzzle.close, () => this.world()]]); }); return;
    }
    const command = residentCommand(snapshot, npc, id);
    if (!command) { this.world(); return; }
    if (id === `${npc}-rest`) { void this.command(command, () => this.world()); return; }
    const choiceId = npc === "lumi" ? "lumi_03" : phase === "find_sand" ? "or_02" : phase === "review" ? "or_04" : "or_06";
    const pick = snapshot.answers.find(answer => answer.id === choiceId)?.pick;
    const branch = (npc === "lumi" && (phase === "notice_first" || phase === "notice_second")) || (npc === "or" && ["find_sand", "review", "finish", "report"].includes(phase));
    const finished = (result: CommandResult) => {
      const done = () => { if (command.kind !== "complete") { this.world(); return; } const hearts = result.snapshot.episodeEnd?.hearts ?? 0; void this.residentNarrative(npc, `${npc}_completed`, () => this.panel(`${"♥".repeat(hearts)}${"♡".repeat(5 - hearts)}`, [[this.ui.next, () => this.world()]])); };
      if (branch && pick) void this.residentNarrative(npc, `${npc}_${phase}_${pick}`, done); else done();
    };
    const send = () => { if (command.kind === "complete") this.panel(this.ui.finishErrand, [[this.ui.finishErrand, () => void this.command(command, finished)]]); else void this.command(command, finished); };
    if (branch) send(); else void this.residentNarrative(npc, `${npc}_${phase}`, send);
  }
  private residentsBoard(npc: Resident): void {
    if (!this.snapshot) return;
    this.exploring = false; this.updateHud(); this.token++; this.controls.setActive(false, this.state.lang); this.village.setEnabled(false); this.overlay.replaceChildren(); this.overlay.className = "overlay dialogue";
    const phase = this.snapshot[npc].phase;
    const board = residentBoard(npc, this.snapshot[npc].placements, translations(this.state.lang).residents[npc], command => void this.command(command, () => this.snapshot?.[npc].phase === phase ? this.residentsBoard(npc) : this.world()), () => this.world(), this.state.lang);
    this.overlay.append(board); board.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
  }
  private interactMoka(id: string): void {
    if (!this.snapshot || !mokaView(this.snapshot).activeTargetIds.includes(id)) { this.world(); return; }
    const phase = this.snapshot.moka.phase;
    if (["choose_route", "reservation", "choose_display", "share", "order", "feedback"].includes(phase)) { void this.openMoka(); return; }
    if (phase === "arrange") { void this.mokaNarrative("moka_arrange", () => this.board()); return; }
    if (phase === "report") { void this.mokaNarrative("moka_report", () => this.panel(this.ui.finishErrand, [[this.ui.finishErrand, () => void this.command({ kind: "complete", targetId: "B" }, result => { const hearts = result.snapshot.episodeEnd?.hearts ?? 0; void this.mokaNarrative("moka_completed", () => this.panel(`${"♥".repeat(hearts)}${"♡".repeat(5 - hearts)}`, [[this.ui.next, () => this.world()]])); })]])); return; }
    let command: Command;
    if (phase === "pick_up") command = { kind: "pickup", targetId: id };
    else if (phase === "deliver") command = { kind: id === "moka-rest" ? (this.snapshot.moka.basket === "player" ? "set_down" : "pickup") : "deliver", targetId: id };
    else if (phase === "return") command = { kind: "talk", targetId: id };
    else command = { kind: "act", targetId: id };
    const knots: Partial<Record<PlaySnapshot["moka"]["phase"], string>> = { pick_up: "moka_pick_up", deliver: "moka_deliver", reservation_action: "moka_reservation_action", share_action: "moka_share_action", order_action: "moka_order_action", return: "moka_return" };
    const send = () => void this.command(command, () => { if (command.kind === "deliver") void this.mokaNarrative("moka_delivered", () => this.world()); else this.world(); });
    const knot = knots[phase]; if (knot) void this.mokaNarrative(knot, send); else send();
  }
  private board(): void {
    if (!this.snapshot || this.snapshot.moka.phase !== "arrange") { this.world(); return; }
    this.exploring = false; this.updateHud(); this.token++; this.controls.setActive(false, this.state.lang); this.village.setEnabled(false); this.overlay.replaceChildren(); this.overlay.className = "overlay dialogue";
    const copy = translations(this.state.lang).moka, placements = this.snapshot.moka.placements;
    const board = document.createElement("div"); board.className = "panel moka-board"; board.setAttribute("role", "dialog"); board.setAttribute("aria-label", copy.objective.arrange);
    const message = document.createElement("p"); message.textContent = copy.objective.arrange; board.append(message);
    let selected: BreadId | null = null;
    const breads = document.createElement("div"), slots = document.createElement("div"); breads.className = "moka-grid"; slots.className = `moka-grid ${mokaView(this.snapshot).display === "high" ? "moka-high" : "moka-low"}`;
    const breadButtons = new Map<BreadId, HTMLButtonElement>();
    for (const id of Object.keys(quest.bread) as BreadId[]) {
      const button = document.createElement("button"); button.textContent = copy.items[quest.bread[id] as "walnut" | "roll" | "flower"]; button.disabled = Object.values(placements).includes(id); button.setAttribute("aria-pressed", "false");
      button.onclick = () => { selected = id; for (const [key, element] of breadButtons) element.setAttribute("aria-pressed", String(key === id)); }; breadButtons.set(id, button); breads.append(button);
    }
    for (const id of Object.keys(quest.slots) as SlotId[]) {
      const button = document.createElement("button"); button.textContent = `${copy.items[quest.slots[id] as "walnut" | "roll" | "flower"]} ${placements[id] ? "✓" : "○"}`; button.disabled = !!placements[id];
      button.onclick = () => { if (!selected) return; if (quest.bread[selected] !== quest.slots[id]) { message.textContent = copy.puzzle.wrong; selected = null; for (const element of breadButtons.values()) element.setAttribute("aria-pressed", "false"); return; } void this.command({ kind: "place", breadId: selected, slotId: id }, () => this.snapshot?.moka.phase === "arrange" ? this.board() : this.world()); }; slots.append(button);
    }
    board.append(breads, slots);
    const hint = document.createElement("button"); hint.textContent = copy.puzzle.hint; hint.onclick = () => { const slot = (Object.keys(quest.slots) as SlotId[]).find(id => !placements[id]); const bread = (Object.keys(quest.bread) as BreadId[]).find(id => slot && quest.bread[id] === quest.slots[slot] && !Object.values(placements).includes(id)); if (slot && bread) { selected = bread; for (const [key, element] of breadButtons) element.setAttribute("aria-pressed", String(key === bread)); message.textContent = `${copy.items[quest.bread[bread] as "walnut" | "roll" | "flower"]} → ${copy.items[quest.slots[slot] as "walnut" | "roll" | "flower"]}`; } };
    const auto = document.createElement("button"); auto.textContent = copy.puzzle.auto; auto.onclick = () => void this.command({ kind: "auto_arrange" }, () => this.world());
    const close = document.createElement("button"); close.textContent = copy.puzzle.close; close.onclick = () => this.world(); board.append(hint, auto, close); this.overlay.append(board); breadButtons.values().next().value?.focus();
  }
  private advance(): void {
    const segment = this.state.segment;
    if (!this.snapshot && segment.startsWith("ep_") && segment !== "ep_moka" && this.episodeLimit < 6 && this.answered(segment) >= this.episodeLimit) { this.world(); return; }
    if (this.story) {
      try {
        while (this.story.canContinue) { const line = (this.story.Continue() ?? "").trim(); if (line) { this.lastLine = line; this.panel(line, [[this.ui.next, () => this.advance()]]); return; } }
        if (this.story.currentChoices.length) { const choices = this.story.currentChoices; this.panel(this.lastLine, choices.map(choice => [choice.text, () => { const id = choice.tags?.find(tag => tag.startsWith("item:"))?.slice(5).trim(); const pick = choice.tags?.find(tag => tag.startsWith("pick:"))?.slice(5).trim(); const item = data.items.find(candidate => candidate.id === id && candidate.segment === segment); if ((id || pick) && (!item || !pick || !item.picks[pick] || this.state.log.some(entry => entry.id === id))) { this.story = null; this.advance(); return; } const proceed = () => { try { this.story?.ChooseChoiceIndex(choice.index); } catch { this.story = null; } }; if (item && pick) this.choose(item, pick, proceed); else { proceed(); this.advance(); } }])); return; }
      } catch { /* Continue with remaining questions. */ }
      this.story = null;
    }
    if (segment.startsWith("ep_") && this.snapshot) { this.world(); return; }
    const items = segment === "gate" ? data.tiebreakers : data.items.filter(item => item.segment === segment);
    const item = items.find(candidate => !this.state.log.some(entry => entry.id === candidate.id));
    if (item) { const copy = translations(this.state.lang).items[item.id]; const index = ids.indexOf(segment.slice(3)); const speaker = index >= 0 && episodeStage(this.answered(segment)) === "quest" ? quests[index] : item.npc ? this.ui.npc[item.npc as keyof typeof this.ui.npc] : undefined; this.panel(copy?.situation ?? item.situation, Object.entries(item.picks).map(([pick, value]) => [copy?.picks[pick] ?? value.text, () => this.choose(item, pick)]), "dialogue", speaker); return; }
    this.finish();
  }
  private choose(item: Item, pick: string, proceed = () => {}): void {
    const showReaction = (kind: "empathy" | "thinking") => {
      const reaction = translations(this.state.lang).dialogue.reactions[item.id]!;
      const name = reaction.speaker === "player" ? this.ui.names.player : this.ui.npc[reaction.speaker as keyof typeof this.ui.npc];
      this.panel(`${name}: ${reaction[kind]}`, [[this.ui.next, () => this.state.segment.startsWith("ep_") && this.snapshot ? this.world() : this.advance()]]);
    };
    if (this.snapshot) {
      if (pick !== "a" && pick !== "b") return;
      void this.command({ kind: "choice", itemId: item.id, pick }, result => { proceed(); showReaction(item.npc ? result.receipt.reaction ?? "thinking" : "thinking"); }); return;
    }
    const entry = { id: item.id, pick }; const match = item.npc ? npcMatches(this.state, data, entry) : false;
    const next = { ...this.state, log: [...this.state.log, entry] };
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { const status = translations(this.state.lang).moka.status; this.panel(status.retry, [[status.reconnect, () => this.choose(item, pick, proceed)]]); return; }
    this.state = next; this.localSave = next; proceed(); showReaction(match ? "empathy" : "thinking");
  }
  private finish(): void { if (this.snapshot) { void this.command({ kind: "finish_segment" }, () => this.world()); return; } const segment = this.state.segment; if (segment.startsWith("ep_") && !this.state.completed.includes(segment.slice(3))) this.state.completed.push(segment.slice(3)); this.state.segment = nextSegment(segment, this.state.completed.length); this.save(); this.world(); }
  private result(): void {
    const result = score({ ...this.state, completedErrands: this.snapshot?.completedEpisodes }, data); const axes = ["A", "B", "C", "D"] as const; const lines = axes.map((axis, i) => this.ui.result.poles[axis][result.type[i] === "OHVG"[i] ? "plus" : "minus"]);
    this.panel([this.ui.result.title, this.ui.result.modifier[result.modifier], ...lines, this.ui.result.disclaimer].join("\n\n"), [[this.ui.result.restart, () => this.restart()]], "result");
  }
}
