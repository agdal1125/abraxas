import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const java = process.platform === "win32" ? "C:/Program Files/Eclipse Adoptium/jdk-21.0.13.9-hotspot" : process.env.JAVA_HOME;
const xdg = join(root, ".staging", "xdg"), cache = join(root, ".staging", "gocache");
mkdirSync(xdg, { recursive: true });
mkdirSync(cache, { recursive: true });
const result = spawnSync(process.execPath, [join(root, "node_modules/firebase-tools/lib/bin/firebase.js"), "emulators:exec", "--project", "demo-abraxas", "--only", "firestore", "--config", join(root, "firebase.json"), "go test ./internal/store/... -run Emulator -count=1"], {
  cwd: join(root, "server"), stdio: "inherit", env: { ...process.env, XDG_CONFIG_HOME: xdg, GOCACHE: cache, GOFLAGS: "-mod=mod", GOPROXY: "off", JAVA_HOME: java, PATH: java ? `${join(java, "bin")}${process.platform === "win32" ? ";" : ":"}${process.env.PATH}` : process.env.PATH }
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
