#!/usr/bin/env node
// Runs the game for hands-on playtests: API with fake auth and in-memory storage, plus Vite.
// Usage: node scripts/dev-play.mjs [vitePort] [apiPort]
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { contentVersion } from "./content-version.mjs";
import { demoEnv } from "./e2e-play.mjs";

const root = resolve(fileURLToPath(import.meta.url), "../..");
const vitePort = process.argv[2] || "5173";
const apiPort = process.argv[3] || "8080";
const env = demoEnv();

const ink = spawnSync(process.execPath, ["scripts/compile-ink.mjs"], { cwd: join(root, "client"), env, stdio: "inherit" });
if (ink.status !== 0) process.exit(ink.status ?? 1);

const exe = join(mkdtempSync(join(tmpdir(), "abraxas-play-")), process.platform === "win32" ? "server.exe" : "server");
const build = spawnSync("go", ["build", "-o", exe, "./cmd/api"], { cwd: join(root, "server"), env, stdio: "inherit" });
if (build.status !== 0) process.exit(build.status ?? 1);

const children = [
  spawn(exe, [], {
    cwd: join(root, "server"),
    stdio: "inherit",
    env: { ...env, ABRAXAS_BIND_ADDR: `127.0.0.1:${apiPort}`, ABRAXAS_DEV_FAKE_AUTH: "1", ABRAXAS_DEV_SKIP_APP_CHECK: "1", ABRAXAS_CONTENT_VERSION: contentVersion(root) },
  }),
  spawn(process.execPath, [join(root, "client/node_modules/vite/bin/vite.js"), "--host", "127.0.0.1", "--port", vitePort, "--strictPort"], {
    cwd: join(root, "client"),
    stdio: "inherit",
    env: { ...env, VITE_ABRAXAS_DEV_FAKE_AUTH: "1", ABRAXAS_API_ORIGIN: `http://127.0.0.1:${apiPort}` },
  }),
];

function stop(code) {
  for (const child of children) child.kill();
  process.exit(code);
}
for (const child of children) child.on("exit", code => stop(code ?? 1));
process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
