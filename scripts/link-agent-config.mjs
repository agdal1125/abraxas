#!/usr/bin/env node
// Links the shared agent skills so Claude Code sees the same skills as Antigravity.
// Source of truth: .agents/skills  ->  .claude/skills
// Works on macOS, Linux and Windows (directory junction on Windows, no admin rights needed).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(root, ".agents", "skills");
const linkDir = path.join(root, ".claude");
const link = path.join(linkDir, "skills");

fs.mkdirSync(linkDir, { recursive: true });

let existing = null;
try {
  existing = fs.lstatSync(link);
} catch {
  // nothing there yet
}

if (existing) {
  if (!existing.isSymbolicLink()) {
    console.error(".claude/skills exists and is not a link; move it aside first.");
    process.exit(1);
  }
  fs.unlinkSync(link);
}

if (process.platform === "win32") {
  fs.symlinkSync(target, link, "junction");
} else {
  fs.symlinkSync(path.relative(linkDir, target), link, "dir");
}

const ok = fs.existsSync(path.join(link, "devlog", "SKILL.md"));
console.log(ok ? "linked .claude/skills -> .agents/skills" : "link created but skills not visible");
process.exit(ok ? 0 : 1);
