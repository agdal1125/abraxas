import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
function forbidden(text, lang) {
  return /[a-z]\d[a-z]\d/i.test(text) || (lang === "ko"
    ? /(?<![A-Za-z0-9])[ABCD](?![A-Za-z0-9])/.test(text)
    : /(?<![A-Za-z0-9])(?:[BCD](?![A-Za-z0-9])|A(?=\s*[:：,.!?]|['’]s\b|$|\s+(?:asks|offers|lays|welcomes|points|holds|says|walks|tells|arrives|and\b|at\b))|(?:to|with|and)\s+A(?![A-Za-z0-9]))/.test(text));
}
assert.ok(forbidden("A가 왔다", "ko"));
assert.ok(forbidden("B에게 돌아가자", "ko"));
assert.ok(forbidden("A asks for help", "en"));
assert.ok(forbidden("I'm A. Hello!", "en"));
assert.ok(forbidden("A arrives at the plaza", "en"));
assert.ok(forbidden("Return to B", "en"));
assert.ok(forbidden("v1j2: Hello", "en"));
assert.ok(!forbidden("A warm breeze arrives.", "en"));

function strings(value) {
  if (typeof value === "string") return [value];
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}
for (const lang of ["ko", "en"]) {
  for (const file of await readdir(join(root, "content/i18n", lang))) {
    if (!file.endsWith(".json")) continue;
    const values = strings(JSON.parse(await readFile(join(root, "content/i18n", lang, file), "utf8")));
    for (const text of values) assert.ok(!forbidden(text, lang), `${lang}/${file}: ${text}`);
  }
  for (const file of await readdir(join(root, "content/ink", lang))) {
    if (!file.endsWith(".ink")) continue;
    const source = await readFile(join(root, "content/ink", lang, file), "utf8");
    const visible = source.replace(/^\s*(?:===.*|->.*)$/gm, "").replace(/#\s*(?:item|pick):[\w]+/g, "");
    for (const line of visible.split(/\r?\n/)) assert.ok(!forbidden(line.trim(), lang), `${lang}/${file}: ${line}`);
  }
}
const scoring = JSON.parse(await readFile(join(root, "content/scoring/items.json"), "utf8"));
for (const item of [...scoring.items, ...scoring.tiebreakers]) {
  for (const text of [item.situation, ...Object.values(item.picks).map((pick) => pick.text)]) {
    assert.ok(!forbidden(text, "ko"), `${item.id}: ${text}`);
  }
}
console.log("Visible names: i18n, ink and scoring text verified.");
