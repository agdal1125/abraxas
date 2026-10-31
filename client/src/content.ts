/// <reference types="vite/client" />
import items from "../../content/scoring/items.json";
import npcs from "../../content/scoring/npcs.json";
import rules from "../../content/scoring/rules.json";
import type { Data } from "./core/scoring";

export const data = { ...items, ...npcs, rules } as unknown as Omit<Data, "items" | "tiebreakers"> & {
  items: (Data["items"][number] & { segment: string; situation: string; picks: Record<string, { text: string; w: Record<string, number> }> })[];
  tiebreakers: (Data["tiebreakers"][number] & { situation: string; picks: Record<string, { text: string; w: Record<string, number> }> })[];
};
const files = import.meta.glob<{ default: unknown }>("../../content/i18n/*/*.json", { eager: true });
export type UI = typeof import("../../content/i18n/ko/ui.json");
export type Translation = Record<string, { situation: string; picks: Record<string, string> }>;
export function translations(lang: string) {
  return { ui: files[`../../content/i18n/${lang}/ui.json`]!.default as UI, items: (files[`../../content/i18n/${lang}/items.json`]?.default ?? {}) as Translation };
}
