import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Compiler, Story } from "inkjs/full";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const read = path => readFile(join(root, path), "utf8");
const sequence = (prefix, count) => Array.from({ length: count }, (_, i) => `${prefix}${String(i + 1).padStart(2, "0")}`);
const residents = ["lumi", "moka", "echo", "or"];
const required = {
  prologue: ["demi_follow", "postman_intro", "postman_named", ...sequence("prologue_", 3), "prologue_outro"],
  hub: ["hub_intro", "hub_return"],
  interlude_1: ["interlude_1_intro", ...sequence("interlude_1_", 2), "interlude_1_outro"],
  interlude_2: ["interlude_2_intro", ...sequence("interlude_2_", 2), "interlude_2_outro_a", "interlude_2_outro_b"],
  interlude_3: ["interlude_3_intro", ...sequence("interlude_3_", 2), "interlude_3_outro"],
  festival: ["festival_intro", ...sequence("festival_", 5), "festival_lights", "festival_companion_intro", ...residents.map(n => `festival_companion_${n}`), "festival_outro"],
  gate: ["gate_intro", ...["a", "b", "c", "d"].map(n => `gate_${n}`), "gate_outro"],
  confession: ["demi_reveal", "confession_intro", "confession_send", ...residents.flatMap(n => ["accepted", "waiting"].map(o => `confession_${n}_${o}`))],
  ending: ["ending_shell", "ending_cards", "ending_walk"],
  last_walk: ["walk_intro", ...Object.entries({ lumi: "AC", moka: "BD", echo: "BC", or: "AD" }).flatMap(([n, axes]) => [...axes].flatMap(a => ["deepened", "steady", "wavering", "turned"].map(s => `walk_${n}_${a}_${s}`)))],
  ...Object.fromEntries(["lumi", "echo", "or"].map(n => [`ep_${n}`, sequence(`${n}_choose_`, 6)])),
  ep_moka: ["moka_meet", "moka_reservation", "moka_choose_display", "moka_share", "moka_order", "moka_feedback"],
};
const forbidden = text => /MBTI|\b[OI][HL][VK][GC]\b|(?:축|axis)\s*[:：]?\s*[A-E]\b|\b[A-E]\s*(?:축|axis)|(?:성향|호감도|점수|affinity|score|trait)\s*(?:of\s*)?[:：=+−-]?\s*[+-]?\d|[+-]\d+\s*(?:점|points?)/iu.test(text);
const length = text => [...text].length;
const choices = source => [...source.matchAll(/^\s*\*\s*\[(.*?)\s+#\s*item:(\w+)\s+#\s*pick:([ab])\]\s*$/gm)].map(([, text, id, pick]) => ({ text, id, pick }));
const choiceKnots = Object.fromEntries([
  ...sequence('prologue_', 3).map(id => [id, id]),
  ...[1, 2, 3].flatMap(n => sequence(`interlude_${n}_`, 2).map(id => [id, id])),
  ...sequence('festival_', 5).map(id => [id, id]),
  ...['a', 'b', 'c', 'd'].map(n => [`gate_${n}`, `gate_${n}`]),
  ...['lumi', 'echo', 'or'].flatMap(n => sequence(`${n}_`, 6).map(id => [`${n}_choose_${id.slice(-2)}`, id])),
  ...['moka_meet', 'moka_reservation', 'moka_choose_display', 'moka_share', 'moka_order', 'moka_feedback'].map((k, i) => [k, `moka_0${i + 1}`]),
]);
const signature = source => choices(source).map(({ id, pick }) => `${id}:${pick}`);
assert.deepEqual(signature('* [yes # item:test # pick:a]\n* [no # item:test # pick:b]'), ['test:a', 'test:b']);
assert.notDeepEqual(signature('* [yes # item:test # pick:a]'), ['test:a', 'test:b']);
assert.notDeepEqual(signature('* [yes # item:test # pick:a]\n* [yes # item:test # pick:a]'), ['test:a', 'test:b']);
assert.ok(forbidden('MBTI') && !forbidden('A warm day'));
assert.equal(length('x'.repeat(80)), 80); assert.equal(length('x'.repeat(81)), 81);
assert.equal(length('가'.repeat(44)), 44); assert.equal(length('가'.repeat(45)), 45);

const scoring = JSON.parse(await read('content/scoring/items.json'));
const items = [...scoring.items, ...scoring.tiebreakers];
const english = JSON.parse(await read('content/i18n/en/items.json'));
const failures = [];
for (const lang of ['ko', 'en']) {
  const allChoices = [];
  for (const [file, knots] of Object.entries(required)) {
    let source;
    try { source = await read(`content/ink/${lang}/${file}.ink`); }
    catch (error) { if (error.code !== 'ENOENT') throw error; failures.push(`${lang}/${file}: missing file; knots: ${knots.join(', ')}`); continue; }
    const found = [...source.matchAll(/^===\s*(\w+)\s*===\s*$/gm)].map(m => m[1]);
    for (const knot of knots) if (!found.includes(knot)) failures.push(`${lang}/${file}: missing knot ${knot}`);
    if (new Set(found).size !== found.length) failures.push(`${lang}/${file}: duplicate knots`);
    const parsed = choices(source); allChoices.push(...parsed);
    const tags = [...source.matchAll(/#\s*(item|pick):\s*(\w+)/g)].map(m => `${m[1]}:${m[2]}`);
    if (JSON.stringify(tags) !== JSON.stringify(parsed.flatMap(c => [`item:${c.id}`, `pick:${c.pick}`]))) failures.push(`${lang}/${file}: stray or malformed tags`);
    for (const c of parsed) {
      const item = items.find(i => i.id === c.id);
      const expected = lang === 'ko' ? item?.picks[c.pick]?.text : english[c.id]?.picks[c.pick];
      if (c.text !== expected) failures.push(`${lang}/${file}: ${c.id}:${c.pick} text mismatch`);
      if (length(c.text) > (lang === 'ko' ? 44 : 80)) console.log(`${lang}/${file}: choice ${c.id}:${c.pick} length ${length(c.text)}`);
    }
    for (const line of source.split(/\r?\n/)) {
      if (!line.trim() || /^\s*(?:===|->|\*|-|\/\/|#)/.test(line)) continue;
      const visible = line.replace(/^[^:：]+[:：]\s*/, '').trim();
      if (forbidden(visible)) failures.push(`${lang}/${file}: forbidden text: ${visible}`);
      if (length(visible) > (lang === 'ko' ? 44 : 80)) failures.push(`${lang}/${file}: dialogue length ${length(visible)}: ${visible}`);
    }
    try {
      const compiler = new Compiler(source); const compiled = compiler.Compile().ToJson();
      if (compiler.errors.length) throw new Error(compiler.errors.join('; '));
      for (const knot of found) {
        const story = new Story(compiled); story.ChoosePathString(knot); while (story.canContinue) story.Continue();
        const id = choiceKnots[knot];
        const expected = id ? [`item:${id}`, 'pick:a', `item:${id}`, 'pick:b'] : [];
        if (JSON.stringify(story.currentChoices.flatMap(c => c.tags || [])) !== JSON.stringify(expected)) failures.push(`${lang}/${file}: ${knot} runtime choice tags`);
        if (id && story.currentChoices.length === 2) for (const pick of [0, 1]) {
          const branch = new Story(compiled); branch.ChoosePathString(knot); while (branch.canContinue) branch.Continue(); branch.ChooseChoiceIndex(pick);
          let response = ''; while (branch.canContinue) response += branch.Continue();
          if (response.trim() || branch.currentChoices.length) failures.push(`${lang}/${file}: ${knot} must end after choice ${pick}`);
        }
      }
    } catch (error) { failures.push(`${lang}/${file}: ink: ${error.message}`); }
  }
  for (const item of items) {
    const actual = allChoices.filter(c => c.id === item.id).map(c => c.pick);
    if (JSON.stringify(actual) !== JSON.stringify(['a', 'b'])) failures.push(`${lang}: ${item.id} expected a,b; found ${actual.join(',') || 'none'}`);
  }
  try {
    const dialogue = JSON.parse(await read(`content/i18n/${lang}/dialogue.json`));
    for (const item of items) {
      const reaction = dialogue.reactions?.[item.id];
      if (!reaction || !['player', ...residents].includes(reaction.speaker) || !['empathy', 'thinking'].every(k => typeof reaction[k] === 'string' && reaction[k].trim())) { failures.push(`${lang}: ${item.id} missing reaction`); continue; }
      for (const key of ['empathy', 'thinking']) if (forbidden(reaction[key]) || length(reaction[key]) > (lang === 'ko' ? 44 : 80)) failures.push(`${lang}: ${item.id}.${key} forbidden or too long`);
    }
  } catch (error) { if (error.code !== 'ENOENT') throw error; failures.push(`${lang}: missing dialogue.json`); }
}
if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; }
else console.log('Dialogue contracts verified.');
