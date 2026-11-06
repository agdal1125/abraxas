import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { createServer } from "node:net";
import { createInterface } from "node:readline";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { contentVersion } from "./content-version.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const outputDirectory = lang => join(root, ".e2e", lang);
export const e2eSucceeded = (reached, errors, abnormal) => reached && errors.length === 0 && abnormal === 0;
export function loadHarnessContent(lang) {
  const quests = Object.fromEntries(["lumi", "moka", "echo", "or"].map(id => [id, JSON.parse(readFileSync(join(root, "content", "quests", `${id}-errand.json`), "utf8"))]));
  const scoring = JSON.parse(readFileSync(join(root, "content", "scoring", "items.json"), "utf8"));
  const path = join(root, "content", "i18n", lang, "items.json");
  const translations = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : {};
  const itemText = Object.fromEntries([...scoring.items, ...scoring.tiebreakers].map(item => [item.id, { picks: Object.fromEntries(Object.entries(item.picks).map(([pick, value]) => [pick, translations[item.id]?.picks[pick] ?? value.text])) }]));
  return { quests, itemText };
}
export function parseArgs(argv) {
  const emulators = argv.includes("--emulators"), args = argv.filter(arg => arg !== "--emulators");
  const [lang = "ko", directory, scenario = "a-auto"] = args;
  if (args.length > 3 || argv.filter(arg => arg === "--emulators").length > 1 || args.some(arg => arg.startsWith("--")) || !["ko", "en"].includes(lang) || !["a-auto", "b-manual", "resume"].includes(scenario)) throw new Error("Usage: node scripts/e2e-play.mjs [--emulators] [ko|en] [output-directory] [a-auto|b-manual|resume]");
  return { emulators, lang, output: resolve(directory ?? outputDirectory(lang)), scenario };
}
export const choiceIndex = scenario => scenario === "b-manual" ? 1 : 0;
export const pointerInput = scenario => scenario === "b-manual" ? "touch" : "mouse";
export function viewportFailures(measured, width, height, font) {
  const failures = [], { viewport, fontSize, board, horizontalOverflow, buttonHeights, closeVisible } = measured;
  if (Math.abs(viewport.width - width) > 1 || Math.abs(viewport.height - height) > 1) failures.push("viewport size");
  if (Math.abs(fontSize - font) > .05) failures.push("font size");
  if (board.left < -0.5 || board.top < -0.5 || board.right > viewport.width + 0.5 || board.bottom > viewport.height + 0.5 || board.right <= board.left || board.bottom <= board.top) failures.push("board outside viewport");
  if (horizontalOverflow > 1) failures.push("horizontal overflow");
  if (!buttonHeights.length || buttonHeights.some(height => height < 47.95)) failures.push("button height below 48px");
  if (!closeVisible) failures.push("close button unreachable");
  return failures;
}
export function boardPair(pieces, slots, placements) {
  const slot = Object.keys(slots).find(id => !placements[id]);
  const piece = Object.keys(pieces).find(id => slot && pieces[id] === slots[slot] && !Object.values(placements).includes(id));
  return slot && piece ? [Object.keys(pieces).indexOf(piece), Object.keys(slots).indexOf(slot)] : null;
}
export function finalErrors(snapshot) {
  const errors = [], residents = ["lumi", "moka", "echo", "or"];
  if (snapshot?.segment !== "result") errors.push("Final segment is not result");
  if (!Array.isArray(snapshot?.answers) || snapshot.answers.length !== 42 || new Set(snapshot.answers.map(a => a.id)).size !== 42) errors.push("Final snapshot must contain 42 distinct answers");
  if (!Array.isArray(snapshot?.completedEpisodes) || snapshot.completedEpisodes.length !== 4 || residents.some(id => !snapshot.completedEpisodes.includes(id))) errors.push("Final snapshot must contain four completed residents");
  for (const id of residents) if (snapshot?.[id]?.phase !== "completed") errors.push(`${id} phase is not completed`);
  return errors;
}
function safeUrl(value) {
  try {
    const url = new URL(value);
    if (url.origin === "http://127.0.0.1:5173" && url.pathname.startsWith("/v1/plays")) return url.origin + url.pathname.replace(/^\/v1\/plays\/[^/]+(?=\/|$)/, match => match === "/v1/plays/current" ? match : "/v1/plays/{play}");
    return url.origin;
  } catch { return "invalid-url"; }
}
export function responseClassifier() {
  let checked = false;
  return (method, url, status) => {
    const current = method === "GET" && url === "http://127.0.0.1:5173/v1/plays/current";
    const expected = status === 404 && ((current && !checked) || (method === "GET" && url === "http://127.0.0.1:5173/cinematics/prelude-v2.mp4"));
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
const { emulators, lang, output, scenario } = parseArgs(process.argv.slice(2));
const { quests, itemText } = loadHarnessContent(lang);
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
const residents = ["lumi", "echo", "or"], allResidents = ["lumi", "moka", "echo", "or"];
const recovery = Object.fromEntries(residents.map(id => [id, { choice: false, rest: false, puzzle: false, report: false }]));
const pointerEvidence = Object.fromEntries(allResidents.map(id => [id, 0]));
const touchEvidence = Object.fromEntries(allResidents.map(id => [id, 0]));
const interactionEvidence = { direct: 0, pointer: 0, touch: 0, mouse: 0, walked: 0 };
const captures = new Set();
const viewportEvidence = { language: lang, count: 0, results: [], keyboard: {} };
const pointerMismatches = [];
let lastSnapshot = null;
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
  let id = 0, createdPlays = 0; const pending = new Map(), requests = new Map();
  const classifyResponse = responseClassifier();
  socket.addEventListener("message", event => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); }
    if (message.method === "Runtime.exceptionThrown") { const d = message.params.exceptionDetails; errors.push(`${d.exception?.description ?? d.exception?.value ?? d.text} @ ${d.url ?? ""}:${d.lineNumber ?? ""}:${d.columnNumber ?? ""}`.slice(0, 400)); }
    if (message.method === "Runtime.consoleAPICalled") {
      const value = message.params.args.map(arg => arg.value ?? arg.description ?? "").join(" ");
      const classification = consoleClassifier(message.params.type, value);
      if (classification === "warning") warnings.push(value);
      if (classification === "error") errors.push(value);
    }
    if (message.method === "Network.requestWillBeSent") { requests.set(message.params.requestId, { method: message.params.request.method, url: message.params.request.url }); if (message.params.request.method === "POST" && message.params.request.url === "http://127.0.0.1:5173/v1/plays") createdPlays++; }
    if (message.method === "Network.loadingFailed" && !message.params.canceled) {
      const request = requests.get(message.params.requestId);
      errors.push(`Network failure: ${request?.method ?? "UNKNOWN"} ${request ? safeUrl(request.url) : "UNKNOWN"} ${message.params.errorText}`);
    }
    if (message.method === "Network.responseReceived") {
      const { url, status } = message.params.response, method = requests.get(message.params.requestId)?.method ?? "UNKNOWN";
      const classification = classifyResponse(method, url, status);
      if (classification === "expected") warnings.push(`${method} ${safeUrl(url)}: ${status} (no current play)`);
      if (classification === "abnormal") { abnormal++; abnormalStatuses[status] = (abnormalStatuses[status] || 0) + 1; abnormalDetails.push({ method, url: safeUrl(url), status }); }
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
  const frames = () => evaluate("new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))");
  await send("Runtime.enable"); await send("Network.enable"); await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 844, height: 390, deviceScaleFactor: 1, mobile: true });
  if (pointerInput(scenario) === "touch") await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
  await send("Page.navigate", { url: "http://127.0.0.1:5173/" });
  async function startPage() {
    for (let i = 0; i < 150 && !await evaluate("!!window.__abraxas?.game"); i++) await sleep(200);
    if (!await evaluate("!!window.__abraxas?.game")) throw new Error("Game did not load");
    if (lang === "en") await evaluate("[...document.querySelectorAll('.overlay button')].find(b => b.textContent.trim() === 'English')?.click()");
    if (await evaluate("window.__abraxas.game.state.lang") !== lang) throw new Error(`Could not select language: ${lang}`);
    const clicked = await evaluate("(() => { const b = [...document.querySelectorAll('.overlay button')].find(b => /^(시작하기|Start)$/.test(b.textContent.trim())); if (!b) return false; b.click(); return true; })()");
    if (!clicked) throw new Error("Start button not found");
    for (let i = 0; i < 150 && !await evaluate("!!window.__abraxas?.game.snapshot && !localStorage.getItem('abraxas:pending-command')"); i++) await sleep(200);
    if (!await evaluate("!!window.__abraxas?.game.snapshot && !localStorage.getItem('abraxas:pending-command')")) throw new Error("Current play did not load");
    await evaluate("(() => { const v = window.__abraxas.village, original = v.onInteract; window.__e2eArrivals = []; v.onInteract = id => { window.__e2eArrivals.push(id); original(id); }; })()");
  }
  await startPage();
  let pendingWalk = null;
  async function checkBoardViewport(npc) {
    await evaluate("(() => { const board = document.querySelector('.resident-board, .moka-board'), style = document.documentElement.style; window.__e2eBoardRestore = { board, focus: document.activeElement, font: style.getPropertyValue('--body-size'), priority: style.getPropertyPriority('--body-size'), scrollTop: board.scrollTop }; })()");
    try {
      await evaluate("document.querySelector(':is(.resident-board, .moka-board) button:not(:disabled)')?.focus({ preventScroll: true })");
      await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 });
      await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 });
      const keyboard = await evaluate("(() => { const board = document.querySelector('.resident-board, .moka-board'), first = board?.querySelector('button:not(:disabled)'); return board?.contains(document.activeElement) && document.activeElement !== first && document.activeElement?.matches('button:not(:disabled)'); })()");
      viewportEvidence.keyboard[npc] = !!keyboard;
      if (!keyboard) errors.push(`Board keyboard Tab failed: ${npc}`);
      for (const [width, height] of [[844, 390], [740, 360], [960, 540], [1280, 720]]) for (const font of [17, 20]) {
        await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: true });
        await evaluate(`document.documentElement.style.setProperty('--body-size', '${font}px')`);
        await frames();
        await evaluate(`(async () => { const board = document.querySelector('.resident-board, .moka-board'); await Promise.allSettled(board.getAnimations({ subtree: true }).filter(a => a.playState === 'running' && Number.isFinite(a.effect?.getComputedTiming().endTime)).map(a => a.finished)); })()`);
        await evaluate("(() => { const board = document.querySelector('.resident-board, .moka-board'); board.scrollTop = board.scrollHeight; })()");
        await frames();
        const measured = await evaluate(`(() => { const board = document.querySelector('.resident-board, .moka-board'), rect = board.getBoundingClientRect(), close = board.querySelector(':scope > button:last-child'), end = close.getBoundingClientRect(), vv = window.visualViewport; const x = (end.left + end.right) / 2, y = (end.top + end.bottom) / 2, hit = document.elementFromPoint(x, y); return { viewport: { width: vv.width, height: vv.height }, fontSize: parseFloat(getComputedStyle(document.body).fontSize), board: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }, horizontalOverflow: Math.max(board.scrollWidth - board.clientWidth, document.documentElement.scrollWidth - document.documentElement.clientWidth), buttonHeights: [...board.querySelectorAll('button')].map(b => b.getBoundingClientRect().height), closeVisible: !close.disabled && end.top >= rect.top + board.clientTop - .5 && end.bottom <= rect.top + board.clientTop + board.clientHeight + .5 && end.left >= 0 && end.right <= vv.width && end.top >= 0 && end.bottom <= vv.height && (hit === close || close.contains(hit)) }; })()`);
        const failures = viewportFailures(measured, width, height, font);
        viewportEvidence.results.push({ npc, width, height, font, fontSize: measured.fontSize, board: measured.board, minButtonHeight: Math.min(...measured.buttonHeights), horizontalOverflow: measured.horizontalOverflow, closeVisible: measured.closeVisible, failures });
        viewportEvidence.count++;
        await shot(`viewport-${npc}-${width}x${height}-${font}`);
        if (failures.length) errors.push(`Board viewport ${npc} ${width}x${height} ${font}px: ${failures.join(', ')}`);
      }
    } finally {
      await send("Emulation.setDeviceMetricsOverride", { width: 844, height: 390, deviceScaleFactor: 1, mobile: true });
      await evaluate("(() => { const saved = window.__e2eBoardRestore, style = document.documentElement.style; if (saved.font) style.setProperty('--body-size', saved.font, saved.priority); else style.removeProperty('--body-size'); })()");
      await frames();
      await evaluate("(() => { const saved = window.__e2eBoardRestore; saved.focus?.focus?.({ preventScroll: true }); saved.board.scrollTop = saved.scrollTop; delete window.__e2eBoardRestore; })()");
    }
  }
  async function reloadAt(npc, checkpoint, before) {
    await shot(`resume-${npc}-${checkpoint}`);
    const createsBefore = createdPlays;
    const loaded = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { socket.removeEventListener("message", listener); reject(new Error("Reload timed out")); }, 30000);
      function listener(event) { if (JSON.parse(event.data).method === "Page.loadEventFired") { clearTimeout(timeout); socket.removeEventListener("message", listener); resolve(); } }
      socket.addEventListener("message", listener);
    });
    await send("Page.reload");
    await loaded;
    await startPage();
    if (createdPlays !== createsBefore) throw new Error(`New play created during resume: ${npc}/${checkpoint}`);
    for (let i = 0; i < 150 && !await evaluate("window.__abraxas.game.exploring"); i++) await sleep(200);
    if (!await evaluate("window.__abraxas.game.exploring && !document.querySelector('.overlay .panel')")) throw new Error(`Resume did not return to exploration: ${npc}/${checkpoint}`);
    const after = await evaluate("window.__abraxas.game.snapshot");
    if (after.playId !== before.playId || after.revision !== before.revision || JSON.stringify(after.answers) !== JSON.stringify(before.answers) || JSON.stringify(after[npc]) !== JSON.stringify(before[npc]) || JSON.stringify(after.completedEpisodes) !== JSON.stringify(before.completedEpisodes)) throw new Error(`Resume state mismatch: ${npc}/${checkpoint}`);
    if (await evaluate("localStorage.getItem('abraxas:pending-command') !== null")) throw new Error(`Pending command remains after resume: ${npc}/${checkpoint}`);
    recovery[npc][checkpoint] = true;
    pendingWalk = null;
  }
  let stuck = 0;
  while (steps++ < 6000) {
    const info = await evaluate(`(() => { const { game, village: v } = window.__abraxas, snapshot = game.snapshot, npc = snapshot?.segment?.slice(3); const view = npc === 'moka' ? v.mokaView : ['lumi', 'echo', 'or'].includes(npc) ? game.residentView(npc) : null; return { snapshot, view, exploring: game.exploring, walking: !!v.auto, arrivals: window.__e2eArrivals.splice(0), pending: !!localStorage.getItem('abraxas:pending-command') }; })()`);
    const snapshot = info.snapshot, segment = snapshot?.segment ?? "unknown", npc = segment.startsWith("ep_") ? segment.slice(3) : null, key = segment + (info.view ? `:${info.view.phase}` : "");
    lastSnapshot = snapshot;
    if (pendingWalk && info.walking) pendingWalk.walked = true;
    if (pendingWalk && info.arrivals.includes(pendingWalk.id)) { if (pendingWalk.pointer && pendingWalk.npc) { pointerEvidence[pendingWalk.npc]++; if (pendingWalk.input === "touch") touchEvidence[pendingWalk.npc]++; } interactionEvidence[pendingWalk.pointer ? "pointer" : "direct"]++; if (pendingWalk.pointer) interactionEvidence[pendingWalk.input]++; if (pendingWalk.walked) interactionEvidence.walked++; pendingWalk = null; }
    if (pendingWalk && !info.walking && !info.arrivals.includes(pendingWalk.id)) { errors.push(`Interaction did not arrive: ${pendingWalk.id}`); break; }
    if (segments.at(-1) !== key) { segments.push(key); await shot(`${String(segments.length).padStart(2, "0")}-${key.replace(/[^a-z0-9_]/gi, "-")}`); }
    if (scenario === "resume" && snapshot && !info.pending) {
      let checkpoint;
      for (const id of residents) {
        if (!recovery[id].report && snapshot[id].phase === "completed") checkpoint = [id, "report"];
        else if (id === npc && !recovery[id].choice && snapshot.answers.some(a => a.id.startsWith(`${id}_`))) checkpoint = [id, "choice"];
        else if (id === npc && !recovery[id].rest && Object.values(snapshot[id].objects).includes(`${id}-rest`)) checkpoint = [id, "rest"];
        else if (id === npc && !recovery[id].puzzle && Object.keys(snapshot[id].placements).length > 0 && ["arrange", "gears"].includes(snapshot[id].phase)) checkpoint = [id, "puzzle"];
        if (checkpoint) break;
      }
      if (checkpoint) { await reloadAt(...checkpoint, snapshot); stuck = 0; continue; }
    }
    if (await evaluate(`Boolean(document.querySelector('[data-scene="ending-done"]'))`)) { errors.push(...finalErrors(snapshot)); if (scenario === "resume") for (const id of residents) for (const [checkpoint, done] of Object.entries(recovery[id])) if (!done) errors.push(`Missing resume verification: ${id}/${checkpoint}`); for (const id of allResidents) { if (!pointerEvidence[id]) errors.push(`Missing pointer interaction: ${id}`); for (const kind of ["board", "choice", "report"]) if (!captures.has(`${kind}-${id}`)) errors.push(`Missing UI capture: ${kind}-${id}`); } if (snapshot.answers.some(a => a.pick !== (choiceIndex(scenario) ? "b" : "a"))) errors.push("Unexpected scenario choice"); for (const id of residents) if (snapshot.answers.filter(a => a.id.startsWith(`${id}_`)).length !== 6) errors.push(`Unexpected answer count: ${id}`); await shot("99-ending-done"); reached = true; break; }
    if (info.walking || info.pending) { if (++stuck > 240) throw new Error(`Walking or command timed out at ${key}`); await sleep(250); continue; }
    const board = await evaluate("(() => { const board = document.querySelector('.resident-board, .moka-board'); return board ? { type: board.classList.contains('moka-board') ? 'moka' : 'resident' } : null; })()");
    let action;
    if (board) {
      const boardNpc = board.type === "moka" ? "moka" : npc;
      if (!captures.has(`board-${boardNpc}`)) { await shot(`board-${boardNpc}`); captures.add(`board-${boardNpc}`); }
      if (scenario === "resume" && !Object.hasOwn(viewportEvidence.keyboard, boardNpc)) await checkBoardViewport(boardNpc);
      const manual = scenario === "b-manual" || (scenario === "resume" && residents.includes(boardNpc) && !recovery[boardNpc].puzzle);
      if (manual) {
        const quest = quests[boardNpc], pair = boardPair(quest.pieces ?? quest.bread, quest.slots, snapshot[boardNpc].placements);
        if (!pair) throw new Error(`No valid board pair: ${boardNpc}`);
        action = await evaluate(`(() => { const b = document.querySelector(${JSON.stringify(board.type === "moka" ? ".moka-board" : ".resident-board")}), grids = b?.querySelectorAll(${JSON.stringify(board.type === "moka" ? ".moka-grid" : ".resident-grid")}); const p = grids?.[0]?.querySelectorAll('button')[${pair[0]}], s = grids?.[1]?.querySelectorAll('button')[${pair[1]}]; if (!p || !s || p.disabled || s.disabled) return 'waiting'; p.click(); s.click(); return 'acted'; })()`);
      } else action = await evaluate("(() => { const b = [...document.querySelectorAll('.resident-board > button, .moka-board > button')].find(x => /자동|automat/i.test(x.textContent)); if (!b || b.disabled) return 'waiting'; b.click(); return 'acted'; })()");
    } else {
      if (allResidents.includes(npc) && (!captures.has(`choice-${npc}`) || !captures.has(`report-${npc}`))) {
        const visibleUI = await evaluate(`(() => { const { game } = window.__abraxas, overlay = document.querySelector('.overlay'); if (game.exploring || !game.settingsMenu.hidden || overlay.inert) return {}; const buttons = [...overlay.querySelectorAll('.choices button')].filter(b => !b.disabled && b.getClientRects().length && getComputedStyle(b).visibility === 'visible'); const texts = buttons.map(b => b.textContent.trim()); const items = ${JSON.stringify(itemText)}; const story = game.story?.currentChoices; const choice = texts.length === 2 && (Object.values(items).some(item => texts[0] === item.picks?.a && texts[1] === item.picks?.b) || (story?.length === 2 && story.every((c, i) => c.text.trim() === texts[i] && c.tags?.some(tag => tag.startsWith('item:'))))); return { choice, report: ${JSON.stringify(info.view?.phase)} === 'report' && texts.length === 1 && texts[0] === game.ui.finishErrand }; })()`);
        for (const kind of ["choice", "report"]) if (visibleUI[kind] && !captures.has(`${kind}-${npc}`)) { await shot(`${kind}-${npc}`); captures.add(`${kind}-${npc}`); }
      }
      action = await evaluate(`(() => { const { game, village: v } = window.__abraxas, overlay = document.querySelector('.overlay'); if (!game.settingsMenu.hidden || overlay.inert) return 'waiting'; if (!game.exploring) { const visible = b => !b.disabled && !b.closest('[inert], [hidden]') && b.getClientRects().length && getComputedStyle(b).visibility === 'visible'; const input = [...overlay.querySelectorAll('input')].find(visible); if (input && !input.value) { input.value = 'Abraxas'; input.dispatchEvent(new Event('input', { bubbles: true })); } const buttons = [...overlay.querySelectorAll('.choices button, button[data-action]')].filter(visible); if (buttons.length) { if (/^(다시 연결|Reconnect)$/.test(buttons[0].textContent.trim())) return 'retry'; const measured = buttons.filter(b => b.dataset.itemId); const selected = measured.length ? measured[${choiceIndex(scenario)}] : buttons[0]; if (!selected) return 'waiting'; selected.click(); return 'acted'; } const p = overlay.querySelector('.panel.continue'); if (p && visible(p)) { p.click(); return 'acted'; } return 'waiting'; } if (!(${canInteract.toString()})(game, v) || v.auto) return 'waiting'; return 'world'; })()`);
      if (action === "world") {
        const forceRest = scenario === "resume" && residents.includes(npc) && !recovery[npc].rest && Object.values(snapshot[npc].objects).includes("player");
        const targetInfo = await evaluate(`(() => { const { village: v } = window.__abraxas, ids = ${JSON.stringify(info.view?.activeTargetIds ?? null)}; const list = (ids ?? [...v.available]).filter(id => v.target(id)); const id = ${forceRest ? JSON.stringify(`${npc}-rest`) : "list.find(id => !id.endsWith('-rest')) ?? list[0]"}; if (!id || !list.includes(id)) return null; const pos = v.targetScreenPos(id); return { id, pos, hit: pos?.onScreen ? v.hitTargetAt(pos.x, pos.y) : null }; })()`);
        if (!targetInfo) action = "waiting";
        else {
          const pointerNpc = allResidents.includes(npc) ? npc : segment === "hub" ? ({ A: "lumi", B: "moka", C: "echo", D: "or" })[targetInfo.id] : null;
          const wantsPointer = pointerNpc && !pointerEvidence[pointerNpc] && targetInfo.pos?.onScreen;
          if (wantsPointer && targetInfo.hit !== targetInfo.id) { const mismatch = `${targetInfo.id} -> ${targetInfo.hit ?? "none"}`; if (!pointerMismatches.includes(mismatch)) pointerMismatches.push(mismatch); }
          const usePointer = wantsPointer && targetInfo.hit === targetInfo.id;
          pendingWalk = { id: targetInfo.id, pointer: !!usePointer, npc: pointerNpc, input: pointerInput(scenario) };
          if (usePointer && pendingWalk.input === "touch") { await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: targetInfo.pos.x, y: targetInfo.pos.y }] }); await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); }
          else if (usePointer) { await send("Input.dispatchMouseEvent", { type: "mousePressed", x: targetInfo.pos.x, y: targetInfo.pos.y, button: "left", clickCount: 1 }); await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: targetInfo.pos.x, y: targetInfo.pos.y, button: "left", clickCount: 1 }); }
          else await evaluate(`window.__abraxas.village.interactTarget(${JSON.stringify(targetInfo.id)})`);
          action = "acted";
        }
      }
    }
    if (action === "retry") throw new Error(`Reconnect required at ${key}`);
    if (action === "waiting") { if (++stuck > 120) { await shot("zz-stuck"); errors.push(`No action available at ${key}`); break; } }
    else stuck = 0;
    await sleep(250);
  }
  if (!reached && steps > 6000) errors.push("Step limit reached");
} catch (error) { errors.push(error instanceof Error ? error.message : String(error)); }
finally {
  stopping = true;
  socket?.close();
  stopChildren();
  await sleep(500);
  try { rmSync(temp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch (error) { errors.push(`Temporary cleanup: ${error.message}`); }
  if (!reached && browserLog) errors.push(`Browser stderr: ${browserLog}`);
  const summary = { language: lang, scenario, reached, answersCount: lastSnapshot?.answers?.length ?? null, completed: lastSnapshot?.completedEpisodes ?? [], phases: Object.fromEntries(allResidents.map(id => [id, lastSnapshot?.[id]?.phase ?? null])), recovery, reportResponseLossInjected: false, pointerEvidence, touchEvidence, interactionEvidence, viewportEvidence, pointerMismatches, steps, segments, errors, warnings, abnormalResponses: abnormal, abnormalStatuses, abnormalDetails, captures: output };
  const serialize = () => JSON.stringify(summary, (_key, value) => typeof value === "string" ? value.replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[redacted]").replace(/\bdev-[A-Za-z0-9_-]+\b/g, "[redacted]").replace(/(bearer\s+)[^\s]+/ig, "$1[redacted]") : value, 2);
  try { mkdirSync(output, { recursive: true }); writeFileSync(join(output, "run-summary.json"), serialize()); } catch (error) { errors.push(`Summary write: ${error.message}`); }
  console.log(serialize());
}
process.exit(e2eSucceeded(reached, errors, abnormal) ? 0 : 1);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
