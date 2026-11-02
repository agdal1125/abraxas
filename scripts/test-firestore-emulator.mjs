import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { demoEnv, javaEnv } from "./e2e-play.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const xdg = join(root, ".staging", "xdg"), cache = join(root, ".staging", "gocache");
mkdirSync(xdg, { recursive: true });
mkdirSync(cache, { recursive: true });
const result = spawnSync(process.execPath, [join(root, "node_modules/firebase-tools/lib/bin/firebase.js"), "emulators:exec", "--project", "demo-abraxas", "--only", "firestore", "--config", join(root, "firebase.json"), "go test ./internal/store/... -run Emulator -count=1"], {
  cwd: join(root, "server"), stdio: "inherit", env: { ...demoEnv(), ...javaEnv(), XDG_CONFIG_HOME: xdg, GOCACHE: cache, GOFLAGS: "-mod=mod", GOPROXY: "off", GOOGLE_CLOUD_PROJECT: "demo-abraxas" }
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
