import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Compiler, Story } from "inkjs/full";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (path) => readFile(resolve(root, path), "utf8");
const items = JSON.parse(await read("content/scoring/items.json")).items;
const english = JSON.parse(await read("content/i18n/en/items.json"));
const ids = Array.from({ length: 6 }, (_, i) => `moka_0${i + 1}`);
const knots = ["moka_meet", "moka_pick_up", "moka_deliver", "moka_delivered", "moka_reservation", "moka_reservation_action", "moka_choose_display", "moka_arrange", "moka_share", "moka_share_action", "moka_order", "moka_order_action", "moka_return", "moka_feedback", "moka_report", "moka_completed"];
const choiceKnots = ["moka_meet", "moka_reservation", "moka_choose_display", "moka_share", "moka_order", "moka_feedback"];

function forbidden(text) {
  return /MBTI|\b[OI][HL][VK][GC]\b|(?:축|axis)\s*[:：]?\s*[A-E]\b|\b[A-E]\s*(?:축|axis)|(?:성향|호감도|점수|affinity|score|trait)\s*(?:of\s*)?[:：=+−-]?\s*[+-]?\d|[+-]\d+\s*(?:점|points?)/iu.test(text);
}

assert.ok(forbidden("MBTI"));
assert.ok(forbidden("축 A"));
assert.ok(forbidden("호감도 12"));
assert.ok(forbidden("score of 12"));
assert.ok(forbidden("OHVG"));
assert.ok(!forbidden("B: 1단 진열과 v1j2"));

function keys(value, prefix = "") {
  return Object.entries(value).flatMap(([key, entry]) => typeof entry === "string" ? [prefix + key] : keys(entry, `${prefix}${key}.`));
}

let referenceTags;
let referenceKeys;
for (const lang of ["ko", "en"]) {
  const source = await read(`content/ink/${lang}/ep_moka.ink`);
  const ui = JSON.parse(await read(`content/i18n/${lang}/moka-errand.json`));
  const sourceKnots = [...source.matchAll(/^===\s*(\w+)\s*===\s*$/gm)].map((match) => match[1]);
  assert.deepEqual(sourceKnots, knots, `${lang}: knot order`);
  const choiceLines = source.split(/\r?\n/).filter((line) => /^\s*\*/.test(line));
  const tags = choiceLines.map((line) => {
    const match = line.match(/^\s*\*\s*\[(.*?)\s+#\s*item:(moka_\d+)\s+#\s*pick:([ab])\]\s*$/);
    assert.ok(match, `${lang}: malformed choice: ${line}`);
    return { text: match[1], id: match[2], pick: match[3] };
  });
  assert.deepEqual(tags.map(({ id, pick }) => `${id}:${pick}`), ids.flatMap((id) => [`${id}:a`, `${id}:b`]), `${lang}: item order or count`);
  assert.deepEqual([...source.matchAll(/#\s*(item|pick):\s*([\w]+)/g)].map((match) => `${match[1]}:${match[2]}`), tags.flatMap(({ id, pick }) => [`item:${id}`, `pick:${pick}`]), `${lang}: stray item or pick tag`);
  for (const { text, id, pick } of tags) {
    const item = items.find((entry) => entry.id === id);
    assert.equal(text, lang === "ko" ? item.picks[pick].text : english[id].picks[pick], `${lang}: ${id}:${pick} text`);
  }
  const signature = tags.map(({ id, pick }) => `${id}:${pick}`);
  if (referenceTags) assert.deepEqual(signature, referenceTags, "language tags differ");
  referenceTags = signature;
  const uiKeys = keys(ui).sort();
  if (referenceKeys) assert.deepEqual(uiKeys, referenceKeys, "language UI keys differ");
  referenceKeys = uiKeys;

  const visible = source.replace(/^===.*$/gm, "").replace(/^\s*->.*$/gm, "").replace(/#\s*(?:item|pick):[\w]+/g, "");
  assert.ok(!forbidden(visible), `${lang}: forbidden visible ink text`);
  assert.ok(!forbidden(JSON.stringify(Object.values(ui))), `${lang}: forbidden visible UI text`);

  const compiler = new Compiler(source);
  const compiled = compiler.Compile().ToJson();
  assert.deepEqual(compiler.errors, [], `${lang}: ink compilation`);
  for (const knot of knots) {
    const story = new Story(compiled);
    story.ChoosePathString(knot);
    while (story.canContinue) story.Continue();
    const index = choiceKnots.indexOf(knot);
    const expected = index < 0 ? [] : [`item:${ids[index]}`, "pick:a", `item:${ids[index]}`, "pick:b"];
    assert.deepEqual(story.currentChoices.flatMap((choice) => choice.tags || []), expected, `${lang}: ${knot} runtime choices`);
    if (index >= 0) for (const choice of [0, 1]) {
      const branch = new Story(compiled);
      branch.ChoosePathString(knot);
      while (branch.canContinue) branch.Continue();
      branch.ChooseChoiceIndex(choice);
      let response = "";
      while (branch.canContinue) response += branch.Continue();
      assert.equal(response.trim(), "", `${lang}: ${knot} must end without judging a response`);
      assert.equal(branch.currentChoices.length, 0, `${lang}: ${knot} must end after the choice`);
    }
  }
}
console.log("Moka ink: 6 items, both picks, knot contracts, translations and visible text verified.");
