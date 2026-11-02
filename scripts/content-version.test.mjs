import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { contentVersion } from "./content-version.mjs";

const files = [
  "content/scoring/items.json", "content/scoring/npcs.json", "content/scoring/rules.json",
  ...["moka", "lumi", "echo", "or"].map(npc => `content/quests/${npc}-errand.json`),
  ...["ko", "en"].flatMap(lang => [`content/i18n/${lang}/text.json`, `content/ink/${lang}/story.ink`]),
];

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "abraxas-version-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const path of files) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), `fixture ${path}\n`);
  }
  return root;
}

for (const npc of ["lumi", "echo", "or"]) {
  test(`${npc} contract changes the version and is required`, t => {
    const root = fixture(t);
    const path = join(root, `content/quests/${npc}-errand.json`);
    const original = contentVersion(root);
    writeFileSync(path, "changed\n");
    assert.notEqual(contentVersion(root), original);
    unlinkSync(path);
    assert.throws(() => contentVersion(root), { code: "ENOENT" });
  });
}

test("existing inputs and raw line endings affect a reproducible version", t => {
  const root = fixture(t);
  const original = contentVersion(root);
  assert.match(original, /^sha256:[0-9a-f]{64}$/);
  assert.equal(contentVersion(root), original);
  for (const path of files) {
    const fullPath = join(root, path);
    writeFileSync(fullPath, `fixture ${path}\r\n`);
    assert.notEqual(contentVersion(root), original, path);
    writeFileSync(fullPath, `fixture ${path}\n`);
  }
  assert.equal(contentVersion(root), original);
  writeFileSync(join(root, "content/i18n/ko/ignored.txt"), "ignored");
  assert.equal(contentVersion(root), original);
});
