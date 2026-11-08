import { showIntent, showMoveHint } from "./intro-hints";
import { mapLegend, renderVillageMap } from "./village-map";
import { currentDisplayEnv, installGuideFor, openInstallGuide } from "./install-guide";
import type { Story } from "inkjs";
import { data, translations } from "../content";
import { episodeStage, nextSegment } from "../core/flow";
import { npcMatches, score, type Input } from "../core/scoring";
import { npcChanges, reflection, walkKnot, type Moment } from "../core/reflection";
import type { Village } from "../scenes/village";
import { Controls } from "../input/controls";
import type { VillageInput } from "../input/movement";
import { objectiveKey } from "./hud";
import { mokaView, type BreadId, type SlotId } from "../core/moka-errand";
import { lumiView } from "../core/lumi-errand";
import { echoView } from "../core/echo-errand";
import { orView } from "../core/or-errand";
import { residentBoard, residentCommand, type Resident } from "./residents-errands";
import { contentVersionMatches, type Command, type PlaySnapshot, type EndingNPC, type ConfessionReason } from "../core/play";
import { createPlay, loadCurrentPlay, recoverPending, sendCommand, PlayApiError, ResponseValidationError, type CommandResult } from "../net/plays";
import { clearPending, loadPending } from "../net/pending";
import { confirmedCommand } from "./moka-errand";
import quest from "../../../content/quests/moka-errand.json";
import "./moka-errand.css";
import { openingSequence, validName } from "./opening";

declare const __CONTENT_VERSION__: string;

type Lang = "ko" | "en";
type Save = { lang: Lang; playId: string; log: Input["log"]; completed: string[]; segment: string; festivalCompanion?: EndingNPC; confession?: { npcId: EndingNPC; reason: ConfessionReason; outcome: "accepted" | "waiting" } };
type Item = typeof data.items[number] | typeof data.tiebreakers[number];
const ids = ["lumi", "moka", "echo", "or"];
const quests = ["s1j2", "v1j2", "t1p2", "s2j2"];
const storageKey = "abraxas-prototype";

async function loadDialogueFonts(content: string): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      document.fonts.load("400 17px 'Pretendard Variable'", content),
      new Promise<void>(resolve => { timer = setTimeout(resolve, 400); }),
    ]);
  } catch { /* Dialogue remains available if fonts cannot load. */ }
  finally { clearTimeout(timer); }
}

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
  private openingActive = false;
  private openingDone: (() => void) | null = null;
  private hubActive = false;
  private lastWorldSegment = "";
  private playerName = "";
  private demiRevealed = false;
  private reloadDialogue: (() => void) | null = null;
  private episodeLimit = 6;
  private largeText = false;
  private controls: Controls;
  private notice = document.createElement("div");
  private noticeTimer = 0;
  private goal = document.createElement("div");
  private direction = document.createElement("div");
  private mapButton = document.createElement("button");
  private settingsButton = document.createElement("button");
  private settingsMenu = document.createElement("div");
  private exploring = false;
  private targets: string[] = [];
  private get worldApi() { return this.village as Village & { focusSpeaker?: (id: string | null) => void; targetScreenPos?: (id: string) => { x: number; y: number; onScreen: boolean } | null; setLumiView: (view: ReturnType<typeof lumiView> | null) => void; setEchoView: (view: ReturnType<typeof echoView> | null) => void; setOrView: (view: ReturnType<typeof orView> | null) => void; resumeLumi: () => Promise<void>; resumeEcho: () => Promise<void>; resumeOr: () => Promise<void> }; }
  constructor(app: HTMLElement, private village: Village) {
    this.controls = new Controls(app, village as Village & VillageInput);
    try { this.largeText = localStorage.getItem("abraxas-large-text") === "true"; } catch { /* Continue in memory if storage is unavailable. */ }
    document.documentElement.style.setProperty("--body-size", this.largeText ? "20px" : "17px");
    this.overlay.className = "overlay"; app.append(this.overlay);
    this.notice.className = "world-notice"; this.notice.setAttribute("role", "status"); app.append(this.notice);
    this.goal.className = "hud-goal"; this.goal.hidden = true; this.direction.className = "hud-direction"; this.direction.hidden = true; this.direction.setAttribute("aria-hidden", "true");
    this.settingsButton.className = "hud-settings-button"; this.settingsButton.textContent = "⚙︎"; this.settingsButton.addEventListener("click", () => this.settings());
    this.mapButton.className = "hud-map-button"; this.mapButton.hidden = true; this.mapButton.addEventListener("click", () => this.openMap());
    this.settingsMenu.className = "hud-menu"; this.settingsMenu.hidden = true; app.append(this.goal, this.direction, this.mapButton, this.settingsButton, this.settingsMenu);
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
  private setTextSize(value: boolean): void { this.largeText = value; document.documentElement.style.setProperty("--body-size", value ? "20px" : "17px"); try { localStorage.setItem("abraxas-large-text", String(value)); } catch { /* Continue in memory if storage is unavailable. */ } }
  private clearViews(): void { this.village.setMokaView(null); this.worldApi.setLumiView(null); this.worldApi.setEchoView(null); this.worldApi.setOrView(null); }
  private restart(): void { this.local = false; this.snapshot = null; this.clearViews(); this.state = { lang: this.state.lang, playId: this.newId(), log: [], completed: [], segment: "title" }; this.title(); }
  private settings(page: "settings" | "confirm" | "credits" | "howTo" = "settings"): void {
    this.controls.setActive(false, this.state.lang); this.village.setEnabled(false); this.overlay.inert = true; this.settingsMenu.hidden = false;
    const card = document.createElement("div"); card.className = "hud-menu-card"; card.setAttribute("role", "dialog"); card.setAttribute("aria-modal", "true"); card.setAttribute("aria-label", page === "credits" ? this.ui.hud.credits : page === "howTo" ? this.ui.hud.howTo : this.ui.hud.settings);
    const heading = document.createElement("h2"); heading.textContent = page === "confirm" ? this.ui.hud.confirm : page === "credits" ? this.ui.hud.credits : page === "howTo" ? this.ui.hud.howTo : this.ui.hud.settings; card.append(heading);
    const add = (label: string, action: () => void) => { const button = document.createElement("button"); button.textContent = label; button.addEventListener("click", action); card.append(button); };
    const close = () => this.closeMenu(this.settingsButton);
    if (page === "confirm") { add(this.ui.hud.restart, () => { close(); this.restart(); }); add(this.ui.hud.cancel, () => this.settings()); }
    else if (page === "howTo") {
      const steps = document.createElement("ol"), copy = this.ui.howTo;
      for (const text of [copy.move, copy.examine, copy.dog, this.ui.intent.prompt, ...copy.choose.split("\n")]) { const step = document.createElement("li"); step.textContent = text; steps.append(step); }
      card.append(steps); add(this.ui.hud.back, () => this.settings());
    }
    else if (page === "credits") {
      const music = document.createElement("p"); music.textContent = this.ui.hud.creditsMusic; card.append(music);
      const license = document.createElement("a"); license.href = "http://creativecommons.org/licenses/by/3.0/"; license.target = "_blank"; license.rel = "noopener noreferrer"; license.textContent = "CC BY 3.0"; card.append(license);
      const sounds = document.createElement("p"); sounds.textContent = this.ui.hud.creditsSounds; card.append(sounds);
      const list = document.createElement("a"); list.href = "cinematics/prelude-v3-credits.txt"; list.target = "_blank"; list.rel = "noopener noreferrer"; list.textContent = this.ui.hud.creditsList; card.append(list);
      add(this.ui.hud.back, () => this.settings());
    }
    else {
      add(`${this.ui.hud.language}: ${this.state.lang === "ko" ? "한국어" : "English"}`, () => { this.state.lang = this.state.lang === "ko" ? "en" : "ko"; this.save(); this.updateHud(); this.reloadDialogue?.(); this.settings(); });
      add(`${this.ui.hud.largeText}: ${this.largeText ? this.ui.hud.on : this.ui.hud.off}`, () => { this.setTextSize(!this.largeText); this.settings(); });
      add(this.ui.hud.howTo, () => this.settings("howTo")); add(this.ui.hud.credits, () => this.settings("credits")); add(this.ui.hud.restart, () => this.settings("confirm")); add(this.ui.hud.close, close);
    }
    this.settingsMenu.replaceChildren(card); card.querySelector("button")?.focus();
  }
  private closeMenu(focus: HTMLElement): void {
    this.settingsMenu.hidden = true; this.settingsMenu.onclick = null; this.overlay.inert = false;
    if (this.exploring) { this.controls.setActive(true, this.state.lang); this.village.setEnabled(true); }
    focus.focus();
  }
  private openMap(): void {
    this.controls.setActive(false, this.state.lang); this.village.setEnabled(false); this.overlay.inert = true; this.settingsMenu.hidden = false;
    const copy = this.ui.map, close = () => this.closeMenu(this.mapButton);
    const card = document.createElement("div"); card.className = "hud-menu-card map-card"; card.setAttribute("role", "dialog"); card.setAttribute("aria-modal", "true"); card.setAttribute("aria-label", copy.title);
    const side = document.createElement("div"); side.className = "map-side";
    const heading = document.createElement("h2"); heading.textContent = copy.title;
    const goal = document.createElement("p"); goal.textContent = this.goal.firstChild?.textContent ?? "";
    const done = document.createElement("button"); done.textContent = this.ui.hud.close; done.addEventListener("click", close);
    side.append(heading, goal, mapLegend(copy.here, copy.target), done);
    card.append(renderVillageMap(this.village.mapMarkers(this.targets), copy.title, copy.zones), side);
    this.settingsMenu.replaceChildren(card);
    this.settingsMenu.onclick = event => { if (event.target === this.settingsMenu) close(); };
    done.focus();
  }
  private updateHud(): void {
    this.settingsButton.hidden = this.state.segment === "title" || this.state.segment === "result";
    this.settingsButton.setAttribute("aria-label", this.ui.hud.settings);
    this.mapButton.hidden = !this.exploring; this.mapButton.textContent = this.ui.map.open;
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
  private panel(text: string, buttons: [string, () => void, string?][], kind: "dialogue" | "title" | "result" = "dialogue", speaker?: string): void {
    this.exploring = false; this.updateHud(); this.token++; const token = this.token; this.controls.setActive(false, this.state.lang); this.village.setEnabled(false); this.overlay.replaceChildren(); if (this.overlay.dataset) delete this.overlay.dataset.scene; this.overlay.className = `overlay ${kind}`;
    const panel = document.createElement("div"); panel.className = "panel";
    const run = (action: () => void) => { if (token === this.token) { this.token++; action(); } };
    const button = (label: string, action: () => void, itemId?: string) => { const element = document.createElement("button"); element.textContent = label; if (itemId) element.dataset.itemId = itemId; else element.dataset.action = label === this.ui.next ? "next" : "select"; element.addEventListener("click", () => run(action)); return element; };
    if (kind === "title") {
      const [name, subtitle] = text.split("\n\n"); const heading = document.createElement("h1"); heading.textContent = name ?? ""; const p = document.createElement("p"); p.textContent = subtitle ?? ""; panel.append(heading, p);
      const controls = document.createElement("div"); controls.className = "title-controls"; for (const [label, action] of [...buttons].reverse()) { const element = button(label, action); if (label === this.ui.title.start) { element.classList.add("is-primary"); controls.prepend(element); } else controls.append(element); } const size = document.createElement("button"); size.textContent = this.largeText ? "가+" : "가"; size.setAttribute("aria-label", this.state.lang === "ko" ? "글자 크기 변경" : "Change text size"); size.setAttribute("aria-pressed", String(this.largeText)); size.addEventListener("click", () => { this.largeText = !this.largeText; document.documentElement.style.setProperty("--body-size", this.largeText ? "20px" : "17px"); try { localStorage.setItem("abraxas-large-text", String(this.largeText)); } catch { /* Continue in memory if storage is unavailable. */ } size.textContent = this.largeText ? "가+" : "가"; size.setAttribute("aria-pressed", String(this.largeText)); }); controls.append(size); const guide = installGuideFor(currentDisplayEnv()); if (guide) { const copy = this.ui.installGuide, open = document.createElement("button"); open.textContent = copy.button; open.addEventListener("click", () => openInstallGuide(this.overlay, { title: copy.button, steps: copy[guide], close: copy.close })); controls.append(open); } this.overlay.append(panel, controls); return;
    }
    if (kind === "result") {
      const [title, modifier, ...rest] = text.split("\n\n"); const intro = document.createElement("div"); intro.className = "result-intro"; const details = document.createElement("div"); details.className = "result-details"; const heading = document.createElement("h2"); heading.textContent = title ?? ""; const badge = document.createElement("span"); badge.className = "modifier"; badge.textContent = modifier ?? ""; const list = document.createElement("ul"); for (const line of rest.slice(0, 4)) { const item = document.createElement("li"); item.textContent = line; list.append(item); } const disclaimer = document.createElement("p"); disclaimer.className = "disclaimer"; disclaimer.textContent = rest[4] ?? ""; const actions = document.createElement("div"); actions.className = "result-actions"; if (typeof navigator.share === "function") actions.append(button(this.ui.hud.share, () => { void navigator.share({ text: [title, modifier, ...rest.slice(0, 4)].join("\n") }).catch(() => {}); this.result(); })); for (const [label, action] of buttons) actions.append(button(label, action)); intro.append(heading, badge); details.append(list, disclaimer, actions); panel.append(intro, details); this.overlay.append(panel); return;
    }
    const match = text.match(/^([^:\n]+):\s*([\s\S]*)$/); const p = document.createElement("p"); p.textContent = match ? match[2]! : text;
    const rawSpeaker = match?.[1]?.trim() ?? speaker;
    const speakerName = rawSpeaker === "주인공" || rawSpeaker === "You" ? this.playerName || this.ui.names.player : rawSpeaker === "데미" || rawSpeaker === "Demi" ? this.demiRevealed ? this.ui.names.demi : this.ui.names.dogUnknown : rawSpeaker;
    const residentNames = Object.values(this.ui.npc), questNames = Object.values(this.ui.questNpc);
    const residentIndex = speakerName ? Math.max(residentNames.indexOf(speakerName), "ABCD".split("").indexOf(speakerName)) : -1;
    const questIndex = speakerName ? Math.max(questNames.indexOf(speakerName), quests.indexOf(speakerName)) : -1;
    if (residentIndex >= 0 || questIndex >= 0) this.worldApi.focusSpeaker?.(residentIndex >= 0 ? "ABCD"[residentIndex]! : quests[questIndex]!);
    if (speakerName && (match || residentIndex >= 0 || questIndex >= 0)) { const name = document.createElement("span"); name.className = "speaker"; name.textContent = residentNames[residentIndex] ?? questNames[questIndex] ?? speakerName; name.style.backgroundColor = ["var(--char-a)", "var(--char-b)", "var(--char-c)", "var(--char-d)"][residentIndex] ?? "var(--char-npc)"; if (residentIndex < 0) name.style.color = "var(--paper)"; panel.append(name); }
    else panel.classList.add("narration");
    panel.append(p);
    if (buttons.length === 1 && buttons[0]![0] === this.ui.next) { panel.classList.add("continue"); panel.dataset.action = "next"; panel.tabIndex = 0; panel.setAttribute("role", "button"); panel.setAttribute("aria-label", this.ui.next); panel.addEventListener("click", () => run(buttons[0]![1])); panel.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); if (!event.repeat) run(buttons[0]![1]); } }); const indicator = document.createElement("span"); indicator.className = "indicator"; indicator.textContent = "▼"; indicator.setAttribute("aria-hidden", "true"); panel.append(indicator); }
    this.overlay.append(panel);
    if (buttons.length > 0 && !(buttons.length === 1 && buttons[0]![0] === this.ui.next)) { this.overlay.classList.add("has-choices"); const choices = document.createElement("div"); choices.className = "choices"; for (const [label, action, itemId] of buttons) choices.append(button(label, action, itemId)); this.overlay.append(choices); }
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
      let snapshot: PlaySnapshot; let created = false;
      try { snapshot = await loadCurrentPlay(); } catch (error) {
        if (!(error instanceof PlayApiError) || error.status !== 404) throw error;
        snapshot = await createPlay(key); created = true;
      }
      this.local = false;
      if (!this.applySnapshot(snapshot)) return;
      const recovered = await recoverPending();
      if (recovered) { if (!recovered.pendingCleared) throw new Error("pending_unavailable"); if (!this.applySnapshot(recovered.snapshot)) return; snapshot = recovered.snapshot; }
      this.resumed = !created || snapshot.answers.length > 0;
      this.lastWorldSegment = "";
      this.loadDisplay();
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
    buttons.push([this.ui.localExperience, () => { this.local = true; this.snapshot = null; this.clearViews(); this.state = { lang: this.state.lang, playId: this.newId(), log: [], completed: [], segment: "prologue" }; this.resumed = false; this.lastWorldSegment = ""; this.playerName = ""; this.demiRevealed = false; this.save(); this.panel(this.ui.localExperience, [[this.ui.next, () => this.world()]]); }]);
    if (this.localSave && this.localSave.segment !== "title") buttons.push([this.ui.continueLocal, () => { this.local = true; this.snapshot = null; this.clearViews(); this.state = structuredClone(this.localSave!); this.resumed = true; this.loadDisplay(); this.panel(this.ui.localExperience, [[this.ui.next, () => this.world()]]); }]);
    this.panel(`${this.ui.title.name}\n\n${this.ui.title.subtitle}`, buttons, "title");
  }
  private world(): void {
    const segment = this.state.segment;
    if (segment !== "hub") this.lastWorldSegment = segment;
    if (segment === "result" || segment === "confession") { void this.ending(); return; }
    if (segment === "prologue") { if (!this.openingActive) void this.opening(); return; }
    if (segment === "ep_moka" && this.snapshot) { this.village.setMokaView(mokaView(this.snapshot)); this.showWorld(mokaView(this.snapshot).activeTargetIds); return; }
    if (this.snapshot && this.resident()) { this.showWorld(this.residentView(this.resident()!).activeTargetIds); return; }
    if (segment.startsWith("ep_")) {
      const index = ids.indexOf(segment.slice(3)); const stage = episodeStage(this.answered(segment));
      if (stage === "done") { this.village.setDemiMode("follow"); this.finish(); return; }
      this.showWorld([stage === "quest" ? quests[index]! : "ABCD"[index]!]); return;
    }
    if (segment.startsWith("interlude_")) { this.showWorld(["lake"]); return; }
    if (segment === "festival") { this.showWorld(["plaza"]); return; }
    if (segment === "gate") { this.showWorld(["gate"]); return; }
    this.state.segment = "hub"; this.save();
    if (this.lastWorldSegment !== "hub" && !this.hubActive) { this.lastWorldSegment = "hub"; this.hubActive = true; this.village.setStoryScene("hub"); void this.hub(); return; }
    this.showWorld(ids.flatMap((id, index) => this.state.completed.includes(id) ? [] : ["ABCD"[index]!]));
  }
  private displayKey(): string { return `abraxas-display-${this.state.playId}`; }
  private display(): { introSeen?: boolean; hubSeen?: boolean; name?: string; demiRevealed?: boolean } { try { return JSON.parse(localStorage.getItem(this.displayKey()) || "{}"); } catch { return {}; } }
  private saveDisplay(value: { introSeen?: boolean; hubSeen?: boolean; name?: string; demiRevealed?: boolean }): void { try { localStorage.setItem(this.displayKey(), JSON.stringify({ ...this.display(), ...value })); } catch { /* Display state can be replayed. */ } }
  private loadDisplay(): void { this.playerName = this.display().name ?? ""; this.demiRevealed = this.display().demiRevealed ?? false; }
  private async narrative(file: string, knot: string, choice = false): Promise<void> {
    const token = ++this.token;
    try {
      const response = await fetch(`./ink/${this.state.lang}/${file}.json`);
      if (!response.ok) throw new Error("ink_unavailable");
      const { Story } = await import("inkjs");
      const content = await response.text(); await loadDialogueFonts(content);
      const story = new Story(content); story.ChoosePathString(knot);
      if (token !== this.token) return;
      if (choice) { this.story = story; this.lastLine = ""; await new Promise<void>(resolve => { this.openingDone = () => { this.reloadDialogue = null; resolve(); }; this.reloadDialogue = () => { void this.narrative(file, knot, true).then(resolve); }; this.advance(); }); return; }
      await new Promise<void>(resolve => {
        this.reloadDialogue = () => { void this.narrative(file, knot).then(resolve); };
        const next = () => { while (story.canContinue) { const line = (story.Continue() ?? "").trim(); if (line) { if (knot === "demi_reveal" && (line.includes("‘데미’") || line.includes('"Demi."'))) { this.demiRevealed = true; this.saveDisplay({ demiRevealed: true }); } this.panel(line, [[this.ui.next, next]]); return; } } this.reloadDialogue = null; resolve(); };
        next();
      });
    } catch {
      if (token === this.token) await new Promise<void>(resolve => { const status = translations(this.state.lang).moka.status; this.panel(status.contentUnavailable, [[status.tryAgain, () => { void this.narrative(file, knot, choice).then(resolve); }]]); });
    }
  }
  private nameInput(): Promise<void> {
    this.panel(this.ui.nameInput.prompt, []);
    const panel = this.overlay.querySelector(".panel")!;
    const form = document.createElement("form"), label = document.createElement("label"), input = document.createElement("input"), error = document.createElement("p"), confirm = document.createElement("button"), skip = document.createElement("button");
    label.textContent = this.ui.nameInput.label; input.name = "name"; input.autocomplete = "off"; label.append(input); error.setAttribute("role", "alert"); confirm.type = "submit"; confirm.textContent = this.ui.nameInput.confirm; confirm.dataset.action = "name-confirm"; skip.type = "button"; skip.textContent = this.ui.nameInput.skip; skip.dataset.action = "name-skip"; form.append(label, error, confirm, skip); panel.append(form); input.focus();
    return new Promise(resolve => {
      const finish = (value: string) => { const name = validName(value); if (name === null) { error.textContent = this.ui.nameInput.error; return; } this.playerName = name; this.saveDisplay({ name }); resolve(); };
      form.addEventListener("submit", event => { event.preventDefault(); finish(input.value); }); skip.addEventListener("click", () => finish(""));
    });
  }
  private async opening(): Promise<void> {
    this.openingActive = true; this.loadDisplay();
    if (this.resumed && this.display().name === undefined) await this.nameInput();
    await openingSequence({
      intent: async () => { if (this.display().introSeen) return; this.panel("", []); await showIntent(this.overlay, this.ui.intent); },
      howToChoose: () => new Promise<void>(resolve => this.panel(this.ui.howTo.choose, [[this.ui.next, resolve]])),
      prelude: async () => { if (!this.display().introSeen) { this.panel("", []); const { playPrelude } = await import("./cinematic"); const playback = playPrelude(this.overlay, this.state.lang, this.ui.cinematic); this.overlay.querySelectorAll(".cinematic button").forEach((button, index) => { (button as HTMLButtonElement).dataset.action = ["play", "mute", "skip"][index]!; }); await playback; this.saveDisplay({ introSeen: true }); } },
      scene: scene => this.village.setStoryScene(scene), mode: mode => this.village.setDemiMode(mode),
      knot: knot => this.narrative("prologue", knot), name: () => this.nameInput(),
      questions: async () => {
        for (const item of data.items.filter(item => item.segment === "prologue")) {
          while (!this.state.log.some(answer => answer.id === item.id)) {
            await this.narrative("prologue", item.id, true);
            if (!this.state.log.some(answer => answer.id === item.id)) await new Promise<void>(resolve => { const status = translations(this.state.lang).moka.status; this.panel(status.contentUnavailable, [[status.tryAgain, resolve]]); });
          }
        }
      },
    }, !this.resumed && this.state.log.length === 0);
    this.openingActive = false; this.resumed = false; this.finish();
  }
  private async hub(): Promise<void> {
    const seen = this.display().hubSeen;
    await this.narrative("hub", seen ? "hub_return" : "hub_intro");
    this.saveDisplay({ hubSeen: true }); this.hubActive = false; this.world();
  }
  private async question(file: string, knot: string, id: string): Promise<void> {
    while (!this.state.log.some(answer => answer.id === id)) {
      await this.narrative(file, knot, true);
      if (!this.state.log.some(answer => answer.id === id)) await new Promise<void>(resolve => { const status = translations(this.state.lang).moka.status; this.panel(status.contentUnavailable, [[status.tryAgain, resolve]]); });
    }
  }
  private companion(): Promise<NonNullable<Save["festivalCompanion"]>> {
    return new Promise(resolve => {
      const npcs = ["lumi", "moka", "echo", "or"] as const;
      this.panel("", npcs.map(npc => [this.ui.festival.companion[npc], () => {
        if (this.snapshot) void this.command({ kind: "festival_companion", npcId: npc }, () => resolve(npc));
        else {
          const next = { ...this.state, festivalCompanion: npc };
          try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { const status = translations(this.state.lang).moka.status; this.panel(status.retry, [[status.reconnect, () => { void this.companion().then(resolve); }]]); return; }
          this.state = next; this.localSave = next; resolve(npc);
        }
      }, `companion-${npc}`]));
      this.overlay.querySelectorAll<HTMLElement>("[data-item-id^='companion-']").forEach(button => { button.dataset.action = button.dataset.itemId; delete button.dataset.itemId; });
    });
  }
  private async lateScene(): Promise<void> {
    const segment = this.state.segment;
    this.village.setStoryScene(segment.startsWith("interlude_") ? "interlude" : segment === "festival" ? "festival" : "gate");
    this.village.setDemiMode(segment === "gate" ? "gate" : "sit");
    await this.narrative(segment, `${segment}_intro`);
    const items = segment === "gate" ? data.tiebreakers : data.items.filter(item => item.segment === segment);
    for (const item of items) {
      if (segment === "festival" && item.id === "festival_05") await this.narrative(segment, "festival_lights");
      await this.question(segment, item.id, item.id);
    }
    if (segment === "festival") {
      await this.narrative(segment, "festival_companion_intro");
      const npc = this.snapshot?.festivalCompanion ?? this.state.festivalCompanion ?? await this.companion();
      await this.narrative(segment, `festival_companion_${npc}`);
    }
    const lastPick = this.state.log.find(answer => answer.id === "interlude_2_02")?.pick;
    await this.narrative(segment, segment === "interlude_2" ? `${segment}_outro_${lastPick}` : `${segment}_outro`);
    this.village.setDemiMode("follow"); this.finish();
  }
  private showWorld(available: string[]): void { this.reloadDialogue = null; this.village.setDemiMode("follow"); this.worldApi.focusSpeaker?.(null); this.exploring = true; this.targets = available; this.updateHud(); this.token++; this.overlay.replaceChildren(); showMoveHint(this.overlay, [this.ui.howTo.move, this.ui.howTo.examine]); this.controls.setActive(true, this.state.lang); this.village.setAvailable(available); this.village.setEnabled(true); }
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
    else if ((segment.startsWith("interlude_") && id === "lake") || (segment === "festival" && id === "plaza") || (segment === "gate" && id === "gate")) { void this.lateScene(); return; }
    const idle = (this.ui as typeof this.ui & { idle?: Record<string, string> }).idle?.[id];
    this.panel(idle ?? (this.state.lang === "ko" ? "지금은 다른 곳을 살펴보자." : "Let's look somewhere else for now."), [[this.ui.next, () => this.world()]], "dialogue", id);
  }
  private async open(segment: string): Promise<void> {
    if (segment.startsWith("ep_") && !this.snapshot) {
      this.state.segment = segment; this.save(); this.village.setDemiMode("sit");
      const answered = this.answered(segment), limit = answered < 3 ? 3 : answered < 5 ? 5 : 6;
      const npc = segment.slice(3), mokaKnots = ["moka_meet", "moka_reservation", "moka_choose_display", "moka_share", "moka_order", "moka_feedback"];
      const items = data.items.filter(item => item.segment === segment);
      for (let i = answered; i < limit; i++) await this.question(segment, npc === "moka" ? mokaKnots[i]! : `${npc}_choose_0${i + 1}`, items[i]!.id);
      this.world(); return;
    }
    const continuing = segment === this.state.segment && this.story !== null;
    this.controls.setActive(false, this.state.lang); this.village.setEnabled(false); this.state.segment = segment; this.save(); if (!continuing) { this.story = null; this.lastLine = ""; } const token = ++this.token;
    const answered = this.answered(segment); this.episodeLimit = answered < 3 ? 3 : answered < 5 ? 5 : 6;
    if (!continuing && !this.resumed && segment === "prologue") {
      try { const response = await fetch(`./ink/${this.state.lang}/${segment}.json`); if (!response.ok) throw new Error("ink_unavailable"); const { Story } = await import("inkjs"); const content = await response.text(); await loadDialogueFonts(content); if (token !== this.token) return; this.story = new Story(content); } catch { if (token === this.token) this.panel(translations(this.state.lang).moka.status.contentUnavailable, [[translations(this.state.lang).moka.status.tryAgain, () => void this.open(segment)]]); return; }
    }
    if (token !== this.token) return; this.resumed = false; this.advance();
  }
  private async openMoka(): Promise<void> {
    if (!this.snapshot) return;
    const knots: Partial<Record<PlaySnapshot["moka"]["phase"], string>> = { choose_route: "moka_meet", reservation: "moka_reservation", choose_display: "moka_choose_display", share: "moka_share", order: "moka_order", feedback: "moka_feedback" };
    const knot = knots[this.snapshot.moka.phase];
    if (!knot) { this.world(); return; }
    this.village.setDemiMode("sit"); const token = ++this.token;
    try {
      const response = await fetch(`./ink/${this.state.lang}/ep_moka.json`);
      if (!response.ok) throw new Error("ink_unavailable");
      const { Story } = await import("inkjs");
      const content = await response.text(); await loadDialogueFonts(content);
      const story = new Story(content); story.ChoosePathString(knot);
      if (token !== this.token) return;
      this.reloadDialogue = () => { void this.openMoka(); };
      this.story = story; this.lastLine = ""; this.advance();
    } catch { if (token === this.token) this.panel(translations(this.state.lang).moka.status.contentUnavailable, [[translations(this.state.lang).moka.status.tryAgain, () => void this.openMoka()]]); }
  }
  private async mokaNarrative(knot: string, after: () => void, finalLabel?: string): Promise<void> {
    const token = ++this.token;
    try {
      const response = await fetch(`./ink/${this.state.lang}/ep_moka.json`);
      if (!response.ok) throw new Error("ink_unavailable");
      const { Story } = await import("inkjs");
      const content = await response.text(); await loadDialogueFonts(content);
      const story = new Story(content);
      if (token !== this.token) return;
      if (!story.KnotContainerWithName(knot)) { after(); return; }
      story.ChoosePathString(knot);
      this.reloadDialogue = () => { void this.mokaNarrative(knot, after, finalLabel); };
      this.playLines(story, after, finalLabel);
    } catch { if (token === this.token) this.panel(translations(this.state.lang).moka.status.contentUnavailable, [[translations(this.state.lang).moka.status.tryAgain, () => void this.mokaNarrative(knot, after, finalLabel)]]); }
  }
  // Shows each line with a Next tap; finalLabel replaces Next on the last line so a closing line can carry its own action.
  private playLines(story: Story, after: () => void, finalLabel?: string): void {
    const done = () => { this.reloadDialogue = null; after(); };
    const next = () => {
      while (story.canContinue) {
        const line = (story.Continue() ?? "").trim();
        if (!line) continue;
        const closing = finalLabel && !story.canContinue;
        this.panel(line, [closing ? [finalLabel, done] : [this.ui.next, next]]);
        return;
      }
      done();
    };
    next();
  }
  private resident(): Resident | null { const id = this.state.segment.slice(3); return this.state.segment.startsWith("ep_") && (id === "lumi" || id === "echo" || id === "or") ? id : null; }
  private residentView(npc: Resident) { return npc === "lumi" ? lumiView(this.snapshot!) : npc === "echo" ? echoView(this.snapshot!) : orView(this.snapshot!); }
  private async residentNarrative(npc: Resident, knot: string, after: () => void, choice = false, finalLabel?: string): Promise<void> {
    if (choice) this.village.setDemiMode("sit");
    const token = ++this.token;
    try {
      const response = await fetch(`./ink/${this.state.lang}/ep_${npc}.json`);
      if (!response.ok) throw new Error("ink_unavailable");
      const { Story } = await import("inkjs");
      const content = await response.text(); await loadDialogueFonts(content);
      const story = new Story(content);
      if (token !== this.token) return;
      if (!choice && !story.KnotContainerWithName(knot)) { after(); return; }
      story.ChoosePathString(knot);
      this.reloadDialogue = () => { void this.residentNarrative(npc, knot, after, choice, finalLabel); };
      if (choice) { this.story = story; this.lastLine = ""; this.advance(); return; }
      this.playLines(story, after, finalLabel);
    } catch { if (token === this.token) { const status = translations(this.state.lang).residents[npc].status; this.panel(status.contentUnavailable, [[status.tryAgain, () => void this.residentNarrative(npc, knot, after, choice, finalLabel)]]); } }
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
    const branch = (npc === "lumi" && (phase === "notice_first" || phase === "notice_second")) || (npc === "or" && ["find_sand", "review", "finish"].includes(phase));
    const finished = (result: CommandResult) => {
      const done = () => { if (command.kind !== "complete") { this.world(); return; } const hearts = result.snapshot.episodeEnd?.hearts ?? 0; void this.residentNarrative(npc, `${npc}_completed`, () => this.panel(`${"♥".repeat(hearts)}${"♡".repeat(5 - hearts)}`, [[this.ui.next, () => this.world()]])); };
      if (branch && pick) void this.residentNarrative(npc, `${npc}_${phase}_${pick}`, done); else done();
    };
    const send = () => void this.command(command, finished);
    if (command.kind === "complete") void this.residentNarrative(npc, npc === "or" ? `or_report_${pick}` : `${npc}_report`, send, false, this.ui.finishErrand);
    else if (branch) send(); else void this.residentNarrative(npc, `${npc}_${phase}`, send);
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
    if (phase === "report") { void this.mokaNarrative("moka_report", () => void this.command({ kind: "complete", targetId: "B" }, result => { const hearts = result.snapshot.episodeEnd?.hearts ?? 0; void this.mokaNarrative("moka_completed", () => this.panel(`${"♥".repeat(hearts)}${"♡".repeat(5 - hearts)}`, [[this.ui.next, () => this.world()]])); }), this.ui.finishErrand); return; }
    let command: Command;
    if (phase === "pick_up") command = { kind: "pickup", targetId: id };
    else if (phase === "deliver") command = { kind: id === "moka-rest" ? (this.snapshot.moka.basket === "player" ? "set_down" : "pickup") : "deliver", targetId: id };
    else if (phase === "return") command = { kind: "talk", targetId: id };
    else command = { kind: "act", targetId: id };
    void this.command(command, () => { if (command.kind === "deliver") void this.mokaNarrative("moka_delivered", () => this.world()); else this.world(); });
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
    if (!this.openingDone && !this.snapshot && segment.startsWith("ep_") && segment !== "ep_moka" && this.episodeLimit < 6 && this.answered(segment) >= this.episodeLimit) { this.world(); return; }
    if (this.story) {
      try {
        while (this.story.canContinue) { const line = (this.story.Continue() ?? "").trim(); if (line) { this.lastLine = line; this.panel(line, [[this.ui.next, () => this.advance()]]); return; } }
        if (this.story.currentChoices.length) { const choices = this.story.currentChoices; this.panel(this.lastLine, choices.map(choice => [choice.text, () => { const id = choice.tags?.find(tag => tag.startsWith("item:"))?.slice(5).trim(); const pick = choice.tags?.find(tag => tag.startsWith("pick:"))?.slice(5).trim(); const item = (segment === "gate" ? data.tiebreakers : data.items.filter(candidate => candidate.segment === segment)).find(candidate => candidate.id === id); if ((id || pick) && (!item || !pick || !item.picks[pick] || this.state.log.some(entry => entry.id === id))) { this.story = null; this.advance(); return; } const proceed = () => { try { this.story?.ChooseChoiceIndex(choice.index); } catch { this.story = null; } }; if (item && pick) this.choose(item, pick, proceed); else { proceed(); this.advance(); } }, choice.tags?.find(tag => tag.startsWith("item:"))?.slice(5).trim()])); return; }
      } catch { /* Continue with remaining questions. */ }
      this.story = null;
    }
    if (this.openingDone) { const done = this.openingDone; this.openingDone = null; done(); return; }
    if (segment.startsWith("ep_") && this.snapshot) { this.world(); return; }
    const items = segment === "gate" ? data.tiebreakers : data.items.filter(item => item.segment === segment);
    const item = items.find(candidate => !this.state.log.some(entry => entry.id === candidate.id));
    if (item) { const copy = translations(this.state.lang).items[item.id]; const index = ids.indexOf(segment.slice(3)); const speaker = index >= 0 && episodeStage(this.answered(segment)) === "quest" ? quests[index] : item.npc ? this.ui.npc[item.npc as keyof typeof this.ui.npc] : undefined; this.panel(copy?.situation ?? item.situation, Object.entries(item.picks).map(([pick, value]) => [copy?.picks[pick] ?? value.text, () => this.choose(item, pick), item.id]), "dialogue", speaker); return; }
    this.finish();
  }
  private choose(item: Item, pick: string, proceed = () => {}): void {
    const showReaction = (kind: "empathy" | "thinking") => {
      this.reloadDialogue = () => showReaction(kind);
      const reaction = translations(this.state.lang).dialogue.reactions[item.id]!;
      const name = reaction.speaker === "player" ? this.ui.names.player : this.ui.npc[reaction.speaker as keyof typeof this.ui.npc];
      this.panel(`${name}: ${reaction[kind]}`, [[this.ui.next, () => { this.reloadDialogue = null; this.state.segment.startsWith("ep_") && this.snapshot ? this.world() : this.advance(); }]]);
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
  private selectEnding<T extends string>(prompt: string, values: readonly T[], label: (value: T) => string, action: string): Promise<T> {
    return new Promise(resolve => {
      this.panel(prompt, values.map(value => [label(value), () => resolve(value), `${action}-${value}`]));
      this.overlay.querySelectorAll<HTMLElement>(`[data-item-id^='${action}-']`).forEach(button => { button.dataset.action = button.dataset.itemId; delete button.dataset.itemId; });
    });
  }
  private confirmedInput(): Input {
    return this.snapshot ? { playId: this.snapshot.playId, log: this.snapshot.answers } : { playId: this.state.playId, log: this.state.log };
  }
  private async lastWalk(): Promise<void> {
    const changes = npcChanges(this.confirmedInput(), data);
    await this.narrative("last_walk", "walk_intro");
    for (const id of ids) await this.narrative("last_walk", walkKnot(id, changes[id]!));
  }
  private async ending(): Promise<void> {
    this.village.setStoryScene("confession"); this.village.setDemiMode("sit");
    if (!this.demiRevealed) await this.narrative("confession", "demi_reveal");
    let confession = this.snapshot?.confession ?? this.state.confession;
    if (!confession) {
      await this.lastWalk();
      await this.narrative("confession", "confession_intro");
      const npcId = await this.selectEnding(this.ui.confession.targetPrompt, ["lumi", "moka", "echo", "or"] as const, npc => this.ui.npc[npc], "confess-target");
      const reason = await this.selectEnding(this.ui.confession.reasonPrompt, ["similar", "drawn", "both", "unsure"] as const, value => this.ui.confession.reason[value], "confess-reason");
      await this.narrative("confession", "confession_send");
      if (this.snapshot) {
        confession = await new Promise(resolve => { void this.command({ kind: "confess", npcId, reason }, result => resolve(result.snapshot.confession!)); });
      } else {
        const local = score({ ...this.state, completedErrands: this.state.completed }, data);
        const affinity = local.npcs[npcId]!.affinity + (this.state.festivalCompanion === npcId ? data.rules.festivalAffinityGain : 0);
        confession = { npcId, reason, outcome: affinity >= data.rules.confessionThreshold ? "accepted" : "waiting" };
        this.state.confession = confession; this.state.segment = "result"; this.save();
      }
    }
    if (!confession) return;
    await this.narrative("confession", `confession_${confession.npcId}_${confession.outcome}`);
    this.panel("", []); const egg = document.createElement("div"); egg.className = "ending-egg"; egg.setAttribute("aria-hidden", "true"); egg.append(document.createElement("span"), document.createElement("span")); this.overlay.append(egg);
    await new Promise<void>(resolve => window.setTimeout(resolve, matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 900));
    await this.narrative("ending", "ending_shell");
    await this.narrative("ending", "ending_cards");
    this.result(0);
  }
  private result(card = 0): void {
    const confession = this.snapshot?.confession ?? this.state.confession;
    if (!confession) return;
    const local = this.snapshot ? null : score({ ...this.state, completedErrands: this.state.completed }, data);
    const result = this.snapshot?.result ?? (local && { type: local.type, modifier: local.modifier, npcTypes: Object.fromEntries(ids.map(id => [id, (["A", "B", "C", "D"] as const).map((axis, i) => ["OI", "HL", "VK", "GC"][i]![local.npcs[id]!.s[axis] >= 0 ? 0 : 1]).join("")])) as Record<EndingNPC, string> });
    if (!result) return;
    const axes = ["A", "B", "C", "D"] as const;
    const reflected = reflection(this.confirmedInput(), result.type, data);
    const lines = axes.map((axis, i) => this.ui.result.poles[axis][result.type[i] === "OHVG"[i] ? "plus" : "minus"]);
    const other = axes.map((axis, i) => this.ui.result.poles[axis][result.npcTypes[confession.npcId][i] === "OHVG"[i] ? "plus" : "minus"]);
    const shared = other.filter((_, i) => result.type[i] === result.npcTypes[confession.npcId][i]);
    const different = other.filter((_, i) => result.type[i] !== result.npcTypes[confession.npcId][i]);
    const tasks = this.state.lang === "ko" ? ["루미와 축제 준비", "모카와 빵 나누기", "에코와 책 정리", "오르와 종 고치기"] : ["Preparing the festival with Lumi", "Sharing bread with Moka", "Organizing books with Echo", "Repairing the bell with Or"];
    const values = `${this.ui.result.values}: ${reflected.topValues.map(value => this.ui.result.valueNames[value as keyof typeof this.ui.result.valueNames]).join(" · ")}`;
    const start = data.npcs.find(npc => npc.id === confession.npcId)!.start;
    const changes = reflected.npcChanges[confession.npcId]!.map(({ axis, shift }) => { const poles = this.ui.result.poles[axis], from = start[axis] >= 0 ? poles.plus : poles.minus, to = start[axis] >= 0 ? poles.minus : poles.plus; return this.ui.result.change[shift].replace("{from}", from).replace("{to}", to); });
    const copy = card === 0 ? [this.ui.result.title, ...(this.snapshot ? [this.ui.result.first] : []), this.ui.result.modifier[result.modifier as keyof typeof this.ui.result.modifier], ...lines, values, this.ui.result.disclaimer] : card === 1 ? [this.ui.npc[confession.npcId], ...changes, ...(shared.length ? [this.state.lang === "ko" ? "닮은 점" : "In common", ...shared] : []), ...(different.length ? [this.state.lang === "ko" ? "다른 점" : "Differences", ...different] : []), this.ui.result.reflection[confession.reason]] : [this.ui.result.cards.village, ...tasks, this.ui.festival.companion[(this.snapshot?.festivalCompanion ?? this.state.festivalCompanion)!]];
    const buttons: [string, () => void, string?][] = [];
    if (card < 2) buttons.push([this.ui.next, () => this.result(card + 1), "result-next"]);
    if (card === 0) buttons.push([this.ui.result.moments.open, () => this.moments(reflected.moments, lines), "result-moments"]);
    else buttons.push([this.ui.result.continueEnding, () => void this.finalWalk(), "result-continue"]);
    if (typeof navigator.share === "function") buttons.push([this.ui.hud.share, () => { void navigator.share({ text: copy.join("\n") }).catch(() => {}); this.result(card); }, "result-share"]);
    buttons.push([this.ui.result.restart, () => this.restart(), "result-restart"]);
    this.panel([this.ui.result.cards[(["self", "other", "village"] as const)[card]!], ...copy].join("\n"), buttons);
    this.markResultPanel();
  }
  private moments(moments: Moment[], lines: string[]): void {
    const copy = moments.map(({ itemId, pick, boundary }, index) => { const text = translations(this.state.lang).items[itemId]?.picks[pick] ?? [...data.items, ...data.tiebreakers].find(item => item.id === itemId)!.picks[pick]!.text; return [lines[index], `‘${text}’`, ...(boundary ? [this.ui.result.moments.boundary] : [])].join("\n"); });
    this.panel([this.ui.result.moments.title, ...copy].join("\n\n"), [[this.ui.result.moments.back, () => this.result(0), "result-moments-back"]]);
    this.markResultPanel();
  }
  private markResultPanel(): void {
    if (this.overlay.dataset) this.overlay.dataset.scene = "result-card";
    this.overlay.querySelectorAll<HTMLElement>("[data-item-id^='result-']").forEach(button => { button.dataset.action = button.dataset.itemId; delete button.dataset.itemId; });
  }
  private async finalWalk(): Promise<void> {
    this.village.setStoryScene("ending"); this.village.setDemiMode("ending");
    await this.narrative("ending", "ending_walk");
    this.panel(this.ui.result.disclaimer, [[this.ui.result.restart, () => this.restart()]]); this.overlay.dataset.scene = "ending-done";
  }
}
