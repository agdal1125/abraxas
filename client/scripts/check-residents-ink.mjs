import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Compiler, Story } from "inkjs/full";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (path) => readFile(resolve(root, path), "utf8");
const items = JSON.parse(await read("content/scoring/items.json")).items;
const english = JSON.parse(await read("content/i18n/en/items.json"));
const forbidden = (text) => /MBTI|\b[OI][HL][VK][GC]\b|(?:축|axis)\s*[:：]?\s*[A-E]\b|\b[A-E]\s*(?:축|axis)|(?:성향|호감도|점수|affinity|score|trait)\s*(?:of\s*)?[:：=+−-]?\s*[+-]?\d|[+-]\d+\s*(?:점|points?)/iu.test(text);
assert.ok(forbidden("MBTI") && forbidden("축 A") && forbidden("score of 12"));
assert.ok(!forbidden("circle 1"));
const leaves = (value, prefix = "") => Object.entries(value).flatMap(([key, entry]) => typeof entry === "string" ? [prefix + key] : leaves(entry, `${prefix}${key}.`));

for (const npc of ["lumi", "echo", "or"]) {
  const quest = JSON.parse(await read(`content/quests/${npc}-errand.json`));
  const ids = quest.items;
  let referenceKeys;
  for (const lang of ["ko", "en"]) {
    const source = await read(`content/ink/${lang}/ep_${npc}.ink`);
    const ui = JSON.parse(await read(`content/i18n/${lang}/${npc}-errand.json`));
    const sourceKnots = [...source.matchAll(/^===\s*(\w+)\s*===\s*$/gm)].map((match) => match[1]);
    assert.equal(new Set(sourceKnots).size, sourceKnots.length, `${lang} ${npc}: duplicate knots`);
    for (const phase of Object.keys(quest.phases).filter((phase) => phase !== "locked")) assert.ok(sourceKnots.includes(`${npc}_${phase}`), `${lang} ${npc}: missing ${phase}`);
    const branches = npc === "lumi" ? ["notice_first", "notice_second"] : npc === "or" ? ["find_sand", "review", "finish", "report"] : [];
    for (const phase of branches) for (const pick of ["a", "b"]) assert.ok(sourceKnots.includes(`${npc}_${phase}_${pick}`), `${lang} ${npc}: missing ${phase}_${pick}`);
    const choices = [...source.matchAll(/^\*\s*\[(.*?)\s+#\s*item:(\w+)\s+#\s*pick:([ab])\]\s*$/gm)].map(([, text, id, pick]) => ({ text, id, pick }));
    assert.deepEqual(choices.map(({ id, pick }) => `${id}:${pick}`), ids.flatMap((id) => [`${id}:a`, `${id}:b`]), `${lang} ${npc}: choices`);
    assert.deepEqual([...source.matchAll(/#\s*(item|pick):\s*(\w+)/g)].map((match) => `${match[1]}:${match[2]}`), choices.flatMap(({ id, pick }) => [`item:${id}`, `pick:${pick}`]), `${lang} ${npc}: stray tags`);
    for (const { text, id, pick } of choices) assert.equal(text, lang === "ko" ? items.find((item) => item.id === id).picks[pick].text : english[id].picks[pick], `${lang} ${id}:${pick}`);
    for (const phase of Object.keys(quest.objectiveKeys)) assert.ok(ui.objective[phase], `${lang} ${npc}: objective ${phase}`);
    assert.ok(ui.objective.pick_up_rest);
    for (const id of new Set([...Object.values(quest.phases).flat(), ...Object.keys(quest.objects), ...Object.values(quest.pieces), ...Object.values(quest.slots), `${npc}-rest`])) assert.ok(ui.items[id], `${lang} ${npc}: label ${id}`);
    const uiKeys = leaves(ui).sort();
    if (referenceKeys) assert.deepEqual(uiKeys, referenceKeys, `${npc}: translation keys`);
    referenceKeys = uiKeys;
    const visible = source.replace(/^===.*$/gm, "").replace(/^\s*->.*$/gm, "").replace(/#\s*(?:item|pick):\w+/g, "");
    assert.ok(!forbidden(visible) && !forbidden(JSON.stringify(Object.values(ui))), `${lang} ${npc}: forbidden visible text`);
    const compiler = new Compiler(source);
    const compiled = compiler.Compile().ToJson();
    assert.deepEqual(compiler.errors, [], `${lang} ${npc}: compilation`);
    for (const knot of sourceKnots) {
      const story = new Story(compiled);
      story.ChoosePathString(knot);
      while (story.canContinue) story.Continue();
      const index = ids.findIndex((id) => knot === `${npc}_choose_${id.slice(-2)}`);
      assert.deepEqual(story.currentChoices.flatMap((choice) => choice.tags || []), index < 0 ? [] : [`item:${ids[index]}`, "pick:a", `item:${ids[index]}`, "pick:b"], `${lang} ${knot}: choices`);
      if (index >= 0) for (const pick of [0, 1]) {
        const branch = new Story(compiled);
        branch.ChoosePathString(knot);
        while (branch.canContinue) branch.Continue();
        branch.ChooseChoiceIndex(pick);
        let response = "";
        while (branch.canContinue) response += branch.Continue();
        assert.equal(response.trim(), "", `${lang} ${knot}: response before server reaction`);
        assert.equal(branch.currentChoices.length, 0);
      }
    }
  }
}
console.log("Residents ink: 18 items, choices, phase knots, labels and translations verified.");
