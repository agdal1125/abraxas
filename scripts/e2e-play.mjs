import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { createServer } from "node:net";
import { createInterface } from "node:readline";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { contentVersion } from "./content-version.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const outputDirectory = lang => join(root, ".e2e", lang);
export const e2eSucceeded = (reached, errors, abnormal) => reached && errors.length === 0 && abnormal === 0;
export function responseClassifier() {
  let checked = false;
  return (method, url, status) => {
    const current = method === "GET" && url === "http://127.0.0.1:5173/v1/plays/current";
    const expected = current && !checked && status === 404;
    if (current || (method === "POST" && url === "http://127.0.0.1:5173/v1/plays")) checked = true;
    return expected ? "expected" : status >= 400 ? "abnormal" : "ok";
  };
}
export function consoleClassifier(type, message) {
  if (type === "warning" && message === "THREE.WebGLRenderer: KHR_parallel_shader_compile extension not supported.") return "warning";
  return type === "warning" || type === "error" || type === "assert" ? "error" : "ignore";
}
export function stderrClassifier(source, line) {
  const clean = line.replace(/\x1b\[[0-9;]*m/g, "");
  if (source === "vite" && /^(?:(?:(?:오전|오후) )?\d{1,2}:\d{2}:\d{2}(?: [AP]M)? \[vite\] (?:\(client\) )?)?\[console\.warn\] THREE\.WebGLRenderer: KHR_parallel_shader_compile extension not supported\.$/.test(clean)) return "warning";
  if (source === "browser") {
    if (/^\[[^\]]*:ERROR:[^\]]*[\\/]fallback_task_provider\.cc(?::\d+|\(\d+\))\] Every renderer should have at least one task provided by a primary task provider(?:\..*)?$/.test(clean)) return "warning";
    return /\b(?:ERROR|FATAL):/.test(clean) ? "error" : "warning";
  }
  return "error";
}
export function canInteract(game, village) {
  return game.exploring && game.settingsMenu.hidden && village.enabled && village.ready && !village.portrait && !village.talking;
}
export function demoEnv(source = process.env) {
  return Object.fromEntries(Object.entries(source).filter(([key]) => !/^(GOOGLE_|GCLOUD_|GCP_|CLOUDSDK_|FIREBASE_|FIRESTORE_|VITE_|ABRAXAS_)/i.test(key)));
}
export function javaEnv(source = process.env) {
  const java = source.JAVA_HOME || (process.platform === "win32" && existsSync("C:/Program Files/Eclipse Adoptium/jdk-21.0.13.9-hotspot") ? "C:/Program Files/Eclipse Adoptium/jdk-21.0.13.9-hotspot" : undefined);
  return { ...(java ? { JAVA_HOME: java } : {}), PATH: java ? `${join(java, "bin")}${process.platform === "win32" ? ";" : ":"}${source.PATH}` : source.PATH };
}
async function main() {
const emulators = process.argv.includes("--emulators");
const args = process.argv.slice(2).filter(arg => arg !== "--emulators");
const lang = args[0] ?? "ko", output = resolve(args[1] ?? outputDirectory(lang));
if (!["ko", "en"].includes(lang)) throw new Error("Usage: node scripts/e2e-play.mjs ko|en output-directory");
const candidates = process.platform === "win32" ? [
  join(process.env["PROGRAMFILES(X86)"] ?? "C:/Program Files (x86)", "Microsoft/Edge/Application/msedge.exe"),
  join(process.env.PROGRAMFILES ?? "C:/Program Files", "Google/Chrome/Application/chrome.exe"),
  join(process.env.LOCALAPPDATA ?? "", "Google/Chrome/Application/chrome.exe")
] : process.platform === "darwin" ? ["/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"] : ["/usr/bin/microsoft-edge", "/usr/bin/google-chrome", "/usr/bin/chromium"];
const browser = process.env.ABRAXAS_BROWSER || candidates.find(existsSync);
if (!browser || !existsSync(browser)) throw new Error("Browser not found; set ABRAXAS_BROWSER to the Edge or Chrome executable");
const temp = mkdtempSync(join(tmpdir(), "abraxas-e2e-"));
const children = [], errors = [], warnings = [], segments = [], abnormalDetails = [];
let abnormal = 0, socket, steps = 0, reached = false, stopping = false, browserLog = "";
const abnormalStatuses = {};
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const start = (command, args, options = {}) => {
  const child = spawn(command, args, { ...options, detached: process.platform !== "win32", windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  child.output = "";
  child.stdout.on("data", data => { child.output = (child.output + String(data)).slice(-4000); });
  child.on("error", error => errors.push(`${command}: ${error.message}`));
  child.on("exit", (code, signal) => { if (!stopping) errors.push(`${command} exited unexpectedly: ${code ?? signal}`); });
  if (options.reportStderr) createInterface({ input: child.stderr }).on("line", line => {
    if (!line.trim()) return;
    const output = `${options.stderrSource ?? "Process"} stderr: ${line.slice(0, 500)}`;
    (stderrClassifier(options.stderrSource, line) === "warning" ? warnings : errors).push(output);
  });
  children.push(child); return child;
};
function stopChildren() {
  for (const child of [...children].reverse()) {
    if (child.exitCode === null && child.pid) {
      if (process.platform === "win32") { spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], { windowsHide: true, stdio: "ignore" }); child.kill("SIGTERM"); }
      else { try { process.kill(-child.pid, "SIGTERM"); } catch { child.kill("SIGTERM"); } }
    }
  }
}
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => {
  stopping = true; socket?.close(); stopChildren();
  try { rmSync(temp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch (error) { console.error(`Temporary cleanup: ${error.message}`); }
  process.exit(1);
});
async function ready(url, child, marker) {
  for (let i = 0; i < 150; i++) {
    if (child.exitCode !== null) throw new Error(`Process exited before ready: ${child.exitCode}`);
    if (!marker || child.output.includes(marker)) {
      try { const response = await fetch(url); if (response.ok) return response; } catch {}
    }
    await sleep(200);
  }
  throw new Error(`Timed out waiting for ${url}`);
}
async function requireFreePort(port) {
  const probe = createServer();
  await new Promise((resolve, reject) => { probe.once("error", reject); probe.listen(port, "127.0.0.1", resolve); });
  await new Promise(resolve => probe.close(resolve));
}
try {
  if ([".env", ".env.local", ".env.development", ".env.development.local"].some(name => existsSync(join(root, "client", name)))) throw new Error("Vite environment files must be absent for demo E2E");
  const env = { ...demoEnv(), XDG_CONFIG_HOME: join(root, ".staging", "xdg") };
  mkdirSync(output, { recursive: true });
  await requireFreePort(8080); await requireFreePort(5173);
  if (emulators) {
    await requireFreePort(9099); await requireFreePort(8081);
    const firebase = start(process.execPath, [join(root, "node_modules/firebase-tools/lib/bin/firebase.js"), "emulators:start", "--only", "auth,firestore", "--project", "demo-abraxas"], { cwd: root, env: { ...env, ...javaEnv(env) }, reportStderr: true });
    await ready("http://127.0.0.1:9099/emulator/v1/projects/demo-abraxas/config", firebase);
    await ready("http://127.0.0.1:8081/", firebase);
  }
  const ink = spawnSync(process.execPath, ["scripts/compile-ink.mjs"], { cwd: join(root, "client"), encoding: "utf8", env });
  if (ink.status !== 0) throw new Error(`Ink compilation failed: ${ink.stderr || ink.stdout}`);
  const exe = join(temp, process.platform === "win32" ? "server.exe" : "server");
  const build = spawnSync("go", ["build", "-o", exe, "./cmd/api"], { cwd: join(root, "server"), encoding: "utf8", env: { ...env, GOCACHE: process.env.GOCACHE || join(temp, "go-cache"), GOPROXY: "off" } });
  if (build.status !== 0) throw new Error(`Go build failed: ${build.stderr || build.error?.message}`);
  const server = start(exe, [], { cwd: join(root, "server"), env: { ...env, ABRAXAS_BIND_ADDR: "127.0.0.1:8080", ABRAXAS_DEV_FAKE_AUTH: emulators ? "0" : "1", ABRAXAS_DEV_SKIP_APP_CHECK: "1", ABRAXAS_CONTENT_VERSION: contentVersion(root), ...(emulators ? { ABRAXAS_STORE: "firestore", GOOGLE_CLOUD_PROJECT: "demo-abraxas", FIRESTORE_EMULATOR_HOST: "127.0.0.1:8081", FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099" } : {}) }, reportStderr: true });
  await ready("http://127.0.0.1:8080/healthz", server);
  const vite = start(process.execPath, [join(root, "client/node_modules/vite/bin/vite.js"), "--host", "127.0.0.1", "--port", "5173", "--strictPort"], { cwd: join(root, "client"), env: { ...env, VITE_ABRAXAS_DEV_FAKE_AUTH: emulators ? "0" : "1", ...(emulators ? { VITE_FIREBASE_API_KEY: "demo-api-key", VITE_FIREBASE_AUTH_DOMAIN: "demo-abraxas.firebaseapp.com", VITE_FIREBASE_PROJECT_ID: "demo-abraxas", VITE_FIREBASE_APP_ID: "demo-app", VITE_FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099" } : {}) }, reportStderr: true, stderrSource: "vite" });
  await ready("http://127.0.0.1:5173/", vite, "ready in");
  if (server.exitCode !== null || errors.length) throw new Error("Demo processes failed before browser startup");
  const debugPort = 9400 + Math.floor(Math.random() * 500);
  const chrome = start(browser, ["--headless=new", `--remote-debugging-port=${debugPort}`, "--disable-extensions", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", ...(process.env.ABRAXAS_BROWSER_NO_SANDBOX === "1" ? ["--no-sandbox", "--disable-gpu-sandbox"] : []), `--user-data-dir=${join(temp, "browser")}`, "about:blank"], { env });
  chrome.stderr.on("data", data => { browserLog = (browserLog + String(data)).slice(-4000); });
  createInterface({ input: chrome.stderr }).on("line", line => {
    if (line.trim()) (stderrClassifier("browser", line) === "error" ? errors : warnings).push(`Browser stderr: ${line}`);
  });
  const pages = await (await ready(`http://127.0.0.1:${debugPort}/json`, chrome)).json();
  const page = pages.find(item => item.type === "page");
  if (!page) throw new Error("Browser debugging page not found");
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  socket.addEventListener("close", () => { if (!stopping) errors.push("Browser debugging connection closed"); });
  let id = 0; const pending = new Map(), requests = new Map();
  const classifyResponse = responseClassifier();
  socket.addEventListener("message", event => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); }
    if (message.method === "Runtime.exceptionThrown") errors.push((message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text).slice(0, 300));
    if (message.method === "Runtime.consoleAPICalled") {
      const value = message.params.args.map(arg => arg.value ?? arg.description ?? "").join(" ");
      const classification = consoleClassifier(message.params.type, value);
      if (classification === "warning") warnings.push(value);
      if (classification === "error") errors.push(value);
    }
    if (message.method === "Network.requestWillBeSent") requests.set(message.params.requestId, { method: message.params.request.method, url: message.params.request.url });
    if (message.method === "Network.loadingFailed" && !message.params.canceled) {
      const request = requests.get(message.params.requestId);
      errors.push(`Network failure: ${request?.method ?? "UNKNOWN"} ${request?.url ?? "UNKNOWN"} ${message.params.errorText}`);
    }
    if (message.method === "Network.responseReceived") {
      const { url, status } = message.params.response, method = requests.get(message.params.requestId)?.method ?? "UNKNOWN";
      const classification = classifyResponse(method, url, status);
      if (classification === "expected") warnings.push(`${method} ${url}: ${status} (no current play)`);
      if (classification === "abnormal") { abnormal++; abnormalStatuses[status] = (abnormalStatuses[status] || 0) + 1; abnormalDetails.push({ method, url, status }); }
    }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const key = ++id, timeout = setTimeout(() => { pending.delete(key); reject(new Error(`CDP timeout: ${method}`)); }, 15000);
    pending.set(key, value => { clearTimeout(timeout); if (value.error) reject(new Error(value.error.message)); else resolve(value.result); });
    socket.send(JSON.stringify({ id: key, method, params }));
  });
  const evaluate = async expression => {
    const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };
  const shot = async name => writeFileSync(join(output, `${name}.png`), Buffer.from((await send("Page.captureScreenshot", { format: "png" })).data, "base64"));
  await send("Runtime.enable"); await send("Network.enable"); await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 844, height: 390, deviceScaleFactor: 1, mobile: true });
  await send("Page.navigate", { url: "http://127.0.0.1:5173/" });
  for (let i = 0; i < 150 && !await evaluate("!!window.__abraxas?.game"); i++) await sleep(200);
  if (!await evaluate("!!window.__abraxas?.game")) throw new Error("Game did not load");
  if (lang === "en") { await evaluate("[...document.querySelectorAll('.overlay button')].find(b => b.textContent.trim() === 'English')?.click()"); await sleep(300); }
  if (await evaluate("window.__abraxas.game.state.lang") !== lang) throw new Error(`Could not select language: ${lang}`);
  await evaluate("[...document.querySelectorAll('.overlay button')].find(b => /시작|Start/.test(b.textContent))?.click()");
  await sleep(800);
  let stuck = 0;
  while (steps++ < 2500) {
    const state = await evaluate("({ ...window.__abraxas.game.state, moka: window.__abraxas.game.snapshot?.moka?.phase })");
    const segment = state.segment ?? "unknown", key = segment + (state.moka && segment === "ep_moka" ? `:${state.moka}` : "");
    if (segments.at(-1) !== key) { segments.push(key); await shot(`${String(segments.length).padStart(2, "0")}-${key.replace(/[^a-z0-9_]/gi, "-")}`); }
    if (segment === "result") { await sleep(800); await shot("99-result"); reached = true; break; }
    const action = await evaluate(`(() => { const overlay = document.querySelector('.overlay'); if (!overlay.inert) { const auto = [...document.querySelectorAll('.moka-board button')].find(x => /자동|automat/i.test(x.textContent)); if (auto && !auto.disabled) { auto.click(); return 'acted'; } const b = [...overlay.querySelectorAll('button')].find(x => !x.disabled); if (b) { if (/^(다시 연결|Reconnect)$/.test(b.textContent.trim())) return 'retry'; b.click(); return 'acted'; } const p = overlay.querySelector('.panel'); if (p && overlay.querySelector('.indicator')) { p.click(); return 'acted'; } } const { game, village: v } = window.__abraxas; if (!(${canInteract.toString()})(game, v)) return 'waiting'; const m = (v.mokaView?.activeTargetIds ?? []).filter(id => v.target(id)); const available = m.length ? m : [...v.actors].filter(([id, a]) => a.marker.visible && v.available.has(id)).map(([id]) => id); if (!available.length) return 'waiting'; v.onInteract(available[0]); return 'acted'; })()`);
    if (action === "retry") throw new Error(`Reconnect required at ${key}`);
    if (action === "waiting") { if (++stuck > 120) { await shot("zz-stuck"); errors.push(`No action available at ${key}`); break; } }
    else stuck = 0;
    await sleep(250);
  }
  if (!reached && steps > 2500) errors.push("Step limit reached");
} catch (error) { errors.push(error instanceof Error ? error.message : String(error)); }
finally {
  stopping = true;
  socket?.close();
  stopChildren();
  await sleep(500);
  try { rmSync(temp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch (error) { errors.push(`Temporary cleanup: ${error.message}`); }
  if (!reached && browserLog) errors.push(`Browser stderr: ${browserLog}`);
  console.log(JSON.stringify({ language: lang, reached, steps, segments, errors, warnings, abnormalResponses: abnormal, abnormalStatuses, abnormalDetails, captures: output }, null, 2));
}
process.exit(e2eSucceeded(reached, errors, abnormal) ? 0 : 1);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
