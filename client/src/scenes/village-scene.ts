import Phaser from "phaser";
import { Story } from "inkjs";
import { data, translations } from "../content";
import { nextSegment } from "../core/flow";
import { npcMatches, score, type Input } from "../core/scoring";

type Lang = "ko" | "en";
type Save = { lang: Lang; playId: string; log: Input["log"]; completed: string[]; segment: string };
type Item = (typeof data.items[number] | typeof data.tiebreakers[number]);
const storageKey = "abraxas-prototype";

export class VillageScene extends Phaser.Scene {
  private state!: Save;
  private story: Story | null = null;
  private resumed = false;
  constructor() { super({ key: "VillageScene" }); }

  create(): void {
    let saved: Save | null = null;
    try { saved = JSON.parse(localStorage.getItem(storageKey) || "null") as Save | null; } catch { /* Storage can be unavailable. */ }
    if (saved?.playId && Array.isArray(saved.log) && Array.isArray(saved.completed)) {
      this.state = saved;
      this.resumed = true;
      void this.open(saved.segment);
    } else {
      this.state = { lang: "ko", playId: this.newId(), log: [], completed: [], segment: "title" };
      this.title();
    }
  }
  private newId(): string { return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`; }
  private save(): void { try { localStorage.setItem(storageKey, JSON.stringify(this.state)); } catch { /* Continue in memory if storage is unavailable. */ } }
  private get ui() { return translations(this.state.lang).ui; }

  private background(name: string, npc?: string): void {
    this.children.removeAll(true);
    this.cameras.main.setBackgroundColor("#fff6e9");
    if (this.textures.exists(`bg_${name}`)) this.add.image(360, 640, `bg_${name}`).setDisplaySize(720, 1280);
    else {
      this.add.rectangle(360, 640, 720, 1280, name === "gate" ? 0xdad5ef : name === "festival" ? 0xf6d9d2 : 0xe2efd9);
      this.add.circle(360, 400, 240, 0xffffff, 0.35);
    }
    if (npc) {
      if (this.textures.exists(`char_${npc}`)) this.add.image(360, 360, `char_${npc}`).setDisplaySize(400, 400);
      else this.add.circle(360, 360, 150, 0xe8bbc3, 0.85);
    }
  }
  private text(x: number, y: number, text: string, size = 30, width = 620): Phaser.GameObjects.Text {
    return this.add.text(x, y, text, { fontFamily: "sans-serif", fontSize: `${size}px`, color: "#493a38", wordWrap: { width, useAdvancedWrap: true }, lineSpacing: 8 });
  }
  private button(label: string, y: number, action: () => void, npc?: string): number {
    const text = this.text(npc ? 142 : 70, y + 16, label, 28, npc ? 508 : 580);
    const height = Math.max(72, text.height + 32);
    const rect = this.add.rectangle(50, y, 620, height, 0xfff9f2, 0.95).setOrigin(0).setStrokeStyle(2, 0xc5aba0).setInteractive({ useHandCursor: true });
    if (npc) {
      if (this.textures.exists(`char_${npc}`)) this.add.image(100, y + height / 2, `char_${npc}`).setDisplaySize(56, 56);
      else this.add.circle(100, y + height / 2, 25, 0xe8bbc3);
    }
    text.setDepth(1);
    rect.once("pointerdown", action);
    return height + 16;
  }
  private title(): void {
    this.state.segment = "title";
    this.background("village");
    this.text(70, 280, this.ui.title.name, 64);
    this.text(70, 390, this.ui.title.subtitle, 30);
    this.button(this.ui.title.language, 680, () => { this.state.lang = this.state.lang === "ko" ? "en" : "ko"; this.title(); });
    this.button(this.ui.title.start, 790, () => { void this.open(nextSegment("title", 0)); });
  }
  private hub(): void {
    this.state.segment = "hub";
    this.save();
    this.background("village");
    this.text(50, 140, this.ui.hub.prompt, 36);
    let y = 300;
    for (const npc of data.npcs) {
      if (this.state.completed.includes(npc.id)) continue;
      const name = this.ui.npc[npc.id as keyof typeof this.ui.npc];
      y += this.button(name, y, () => { void this.open(`ep_${npc.id}`); }, npc.id);
    }
  }
  private async open(segment: string): Promise<void> {
    this.state.segment = segment;
    this.save();
    this.story = null;
    if (segment === "title") { this.title(); return; }
    if (segment === "hub") { this.hub(); return; }
    if (segment === "result") { this.result(); return; }
    const skipInk = this.resumed;
    this.resumed = false;
    if (segment !== "gate" && !skipInk) {
      try {
        const response = await fetch(`./ink/${this.state.lang}/${segment}.json`);
        if (response.ok) this.story = new Story(await response.text());
      } catch { this.story = null; }
    }
    this.advance();
  }
  private visual(): void {
    const segment = this.state.segment;
    this.background(segment === "festival" ? "festival" : segment === "gate" ? "gate" : "village", segment.startsWith("ep_") ? segment.slice(3) : undefined);
  }
  private dialogue(line: string, next: () => void): void {
    this.visual();
    this.add.rectangle(360, 1120, 680, 300, 0xfff9f2, 0.95).setStrokeStyle(2, 0xc5aba0);
    const match = line.match(/^([^:：\n]+)[:：]\s*(.*)$/s);
    if (match) { this.text(50, 986, match[1]!, 26); this.text(50, 1035, match[2]!, 29); }
    else this.text(50, 1000, line, 29);
    this.add.rectangle(360, 1120, 680, 300, 0xffffff, 0.001).setInteractive().once("pointerdown", next);
  }
  private advance(): void {
    if (this.story) {
      try {
        while (this.story.canContinue) {
          const line = (this.story.Continue() ?? "").trim();
          if (line) { this.dialogue(line, () => this.advance()); return; }
        }
        if (this.story.currentChoices.length) {
          const choices = this.story.currentChoices;
          this.visual();
          let y = 680;
          for (const choice of choices) {
            y += this.button(choice.text, y, () => {
              const tags = choice.tags ?? [];
              const id = tags.find((tag) => tag.startsWith("item:"))?.slice(5).trim();
              const pick = tags.find((tag) => tag.startsWith("pick:"))?.slice(5).trim();
              const item = data.items.find((candidate) => candidate.id === id && candidate.segment === this.state.segment);
              if ((id || pick) && (!item || !pick || !item.picks[pick] || this.state.log.some((entry) => entry.id === id))) { this.story = null; this.advance(); return; }
              try { this.story!.ChooseChoiceIndex(choice.index); } catch { this.story = null; this.advance(); return; }
              if (item && pick) this.choose(item, pick, () => this.advance());
              else this.advance();
            });
          }
          return;
        }
      } catch { /* Fall through to remaining questions. */ }
      this.story = null;
    }
    const items = this.state.segment === "gate" ? data.tiebreakers : data.items.filter((item) => item.segment === this.state.segment);
    const item = items.find((candidate) => !this.state.log.some((entry) => entry.id === candidate.id));
    if (item) {
      const copy = translations(this.state.lang).items[item.id];
      this.dialogue(copy?.situation ?? item.situation, () => {
        this.visual();
        let y = 670;
        for (const [pick, value] of Object.entries(item.picks)) y += this.button(copy?.picks[pick] ?? value.text, y, () => this.choose(item, pick, () => this.advance()));
      });
      return;
    }
    this.finishSegment();
  }
  private choose(item: Item, pick: string, next: () => void): void {
    const entry = { id: item.id, pick };
    const match = item.npc ? npcMatches(this.state, data, entry) : false;
    this.state.log.push(entry);
    this.save();
    if (item.npc) {
      const name = this.ui.npc[item.npc as keyof typeof this.ui.npc];
      const reaction = this.ui.reaction[match ? "empathy" : "thinking"][0]!;
      this.dialogue(`${name}: ${reaction}`, next);
    } else next();
  }
  private finishSegment(): void {
    const segment = this.state.segment;
    if (segment.startsWith("ep_")) this.state.completed.push(segment.slice(3));
    void this.open(nextSegment(segment, this.state.completed.length));
  }
  private result(): void {
    this.background("gate");
    const result = score(this.state, data);
    this.text(50, 120, this.ui.result.title, 38);
    const axes = ["A", "B", "C", "D"] as const;
    const plus = "OHVG";
    const lines = axes.map((axis, index) => this.ui.result.poles[axis][result.type[index] === plus[index] ? "plus" : "minus"]);
    this.text(50, 240, [this.ui.result.modifier[result.modifier], ...lines].join("\n\n"), 29);
    this.text(50, 840, this.ui.result.disclaimer, 24);
    this.button(this.ui.result.restart, 1020, () => {
      this.state = { lang: this.state.lang, playId: this.newId(), log: [], completed: [], segment: "title" };
      try { localStorage.removeItem(storageKey); } catch { /* Storage can be unavailable. */ }
      this.title();
    });
  }
}
