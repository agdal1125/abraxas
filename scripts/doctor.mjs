#!/usr/bin/env node
// Checks that the local machine (macOS, Windows or Linux) has the tools this project expects.
// Usage: node scripts/doctor.mjs   (exit code 1 if a required tool is missing or too old)
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const isWin = process.platform === "win32";

function run(cmd, args) {
  // shell: true lets Windows resolve .cmd shims (npm, firebase, gcloud)
  const r = spawnSync(cmd, args, { encoding: "utf8", shell: isWin });
  if (r.error || r.status !== 0) return null;
  return `${r.stdout ?? ""}${r.stderr ?? ""}`.trim();
}

function versionAtLeast(found, min) {
  const a = found.split(".").map(Number);
  const b = min.split(".").map(Number);
  for (let i = 0; i < b.length; i++) {
    if ((a[i] ?? 0) > b[i]) return true;
    if ((a[i] ?? 0) < b[i]) return false;
  }
  return true;
}

const checks = [
  { name: "node", required: true, min: "22.0", get: () => process.versions.node },
  { name: "git", required: true, get: () => run("git", ["--version"])?.match(/(\d+\.\d+(\.\d+)?)/)?.[1] },
  { name: "go", required: true, min: "1.27", get: () => run("go", ["version"])?.match(/go(\d+\.\d+(\.\d+)?)/)?.[1] },
  { name: "agy (Antigravity CLI)", required: true, get: () => run("agy", ["--version"])?.match(/(\d+\.\d+(\.\d+)?)/)?.[1] },
  { name: "firebase", required: false, get: () => run("firebase", ["--version"])?.match(/(\d+\.\d+(\.\d+)?)/)?.[1] },
  { name: "gcloud", required: false, get: () => run("gcloud", ["--version"])?.match(/Google Cloud SDK (\d+\.\d+(\.\d+)?)/)?.[1] },
];

let failed = false;
console.log(`platform: ${process.platform} (${process.arch})\n`);

for (const c of checks) {
  const v = c.get();
  let status;
  if (!v) status = c.required ? "MISSING" : "missing (optional for now)";
  else if (c.min && !versionAtLeast(v, c.min)) status = `TOO OLD (need ${c.min}+)`;
  else status = "ok";
  if (c.required && status !== "ok") failed = true;
  console.log(`${status === "ok" ? "✔" : c.required ? "✘" : "·"} ${c.name.padEnd(24)} ${v ?? "-"}  ${status}`);
}

const skillsLink = path.join(root, ".claude", "skills", "devlog", "SKILL.md");
const linked = fs.existsSync(skillsLink);
console.log(`${linked ? "✔" : "·"} ${"claude skills link".padEnd(24)} ${linked ? "ok" : "run: npm run setup"}`);

const autocrlf = run("git", ["config", "--get", "core.autocrlf"]);
if (autocrlf === "true") {
  console.log("· git core.autocrlf=true: .gitattributes handles line endings, but 'input' or unset is recommended");
}

process.exit(failed ? 1 : 0);
