import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

export function contentVersion(root) {
  const paths = ["content/scoring/items.json", "content/scoring/npcs.json", "content/scoring/rules.json", "content/quests/moka-errand.json"];
  for (const lang of ["ko", "en"]) for (const [dir, ext] of [["i18n", ".json"], ["ink", ".ink"]]) {
    const prefix = `content/${dir}/${lang}`;
    paths.push(...readdirSync(resolve(root, prefix)).filter(name => name.endsWith(ext)).map(name => `${prefix}/${name}`));
  }
  const digest = createHash("sha256");
  for (const path of paths.sort()) digest.update(`${path}\0${createHash("sha256").update(readFileSync(resolve(root, path))).digest("hex")}\n`);
  return `sha256:${digest.digest("hex")}`;
}
