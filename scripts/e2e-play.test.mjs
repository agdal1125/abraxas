import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as harness from "./e2e-play.mjs";
import { demoEnv, e2eSucceeded, outputDirectory, responseClassifier, consoleClassifier, stderrClassifier, canInteract, parseArgs, choiceIndex, boardPair, finalErrors } from "./e2e-play.mjs";

test("board viewport measurements reject clipped boards, overflow, small buttons and unreachable close", () => {
  const measured = { viewport: { width: 740, height: 360 }, fontSize: 15, board: { left: 10, top: 10, right: 730, bottom: 350 }, horizontalOverflow: 0, buttonHeights: [48, 52], closeVisible: true };
  assert.deepEqual(harness.viewportFailures(measured, 740, 360, 15), []);
  assert.ok(harness.viewportFailures({ ...measured, board: { ...measured.board, right: 741 } }, 740, 360, 15).length);
  assert.ok(harness.viewportFailures({ ...measured, horizontalOverflow: 2 }, 740, 360, 15).length);
  assert.ok(harness.viewportFailures({ ...measured, buttonHeights: [47] }, 740, 360, 15).length);
  assert.ok(harness.viewportFailures({ ...measured, closeVisible: false }, 740, 360, 15).length);
  assert.ok(harness.viewportFailures(measured, 844, 390, 15).length);
  assert.ok(harness.viewportFailures(measured, 740, 360, 18).length);
});

test("only b-manual uses touch for world pointer interactions", () => {
  assert.equal(harness.pointerInput("a-auto"), "mouse");
  assert.equal(harness.pointerInput("b-manual"), "touch");
  assert.equal(harness.pointerInput("resume"), "mouse");
});

test("preflight loads repository quests and both languages with the game's choice fallback", () => {
  assert.equal(typeof harness.loadHarnessContent, "function");
  const scoring = JSON.parse(readFileSync(new URL("../content/scoring/items.json", import.meta.url), "utf8"));
  const english = JSON.parse(readFileSync(new URL("../content/i18n/en/items.json", import.meta.url), "utf8"));
  for (const lang of ["ko", "en"]) {
    const { quests, itemText } = harness.loadHarnessContent(lang);
    for (const id of ["lumi", "moka", "echo", "or"]) assert.ok(Object.keys(quests[id].slots).length > 0);
    for (const item of [...scoring.items, ...scoring.tiebreakers]) for (const pick of ["a", "b"]) {
      assert.equal(itemText[item.id].picks[pick], (lang === "en" ? english[item.id]?.picks[pick] : undefined) ?? item.picks[pick].text);
    }
  }
});

test("arguments accept only the three fixed scenarios", () => {
  assert.equal(parseArgs([]).scenario, "a-auto");
  assert.equal(parseArgs(["--emulators", "en", "evidence", "b-manual"]).scenario, "b-manual");
  assert.equal(parseArgs(["ko", "evidence", "resume", "--emulators"]).emulators, true);
  for (const args of [["fr"], ["ko", "out", "other"], ["ko", "out", "resume", "extra"], ["--unknown"]]) assert.throws(() => parseArgs(args));
});

test("choice and manual board selection follow scenario and saved placements", () => {
  assert.equal(choiceIndex("a-auto"), 0);
  assert.equal(choiceIndex("b-manual"), 1);
  assert.equal(choiceIndex("resume"), 0);
  assert.deepEqual(boardPair({ a: "round", b: "square", c: "round" }, { x: "square", y: "round" }, { x: "b" }), [0, 1]);
  assert.equal(boardPair({ a: "round" }, { x: "square" }, {}), null);
});

test("final snapshot requires all answers and completed residents", () => {
  const snapshot = { segment: "result", answers: Array.from({ length: 42 }, (_, i) => ({ id: String(i), pick: "a" })), completedEpisodes: ["lumi", "moka", "echo", "or"], ...Object.fromEntries(["lumi", "moka", "echo", "or"].map(n => [n, { phase: "completed" }])) };
  assert.deepEqual(finalErrors(snapshot), []);
  assert.ok(finalErrors({ ...snapshot, answers: snapshot.answers.slice(1) }).length);
  assert.ok(finalErrors({ ...snapshot, completedEpisodes: ["lumi", "moka", "echo", "echo"] }).length);
  assert.ok(finalErrors({ ...snapshot, or: { phase: "report" } }).length);
});

test("demo child environment drops inherited Firebase and credential configuration", () => {
  const env = demoEnv({ PATH: "path", GOOGLE_APPLICATION_CREDENTIALS: "private", GOOGLE_CLOUD_PROJECT: "real", VITE_FIREBASE_APP_CHECK_SITE_KEY: "real", FIREBASE_APPCHECK_DEBUG_TOKEN: "real", ABRAXAS_STORE: "firestore", CLOUDSDK_CONFIG: "private" });
  assert.equal(env.PATH, "path");
  for (const key of ["GOOGLE_APPLICATION_CREDENTIALS", "GOOGLE_CLOUD_PROJECT", "VITE_FIREBASE_APP_CHECK_SITE_KEY", "FIREBASE_APPCHECK_DEBUG_TOKEN", "ABRAXAS_STORE", "CLOUDSDK_CONFIG"]) assert.equal(env[key], undefined);
});

test("E2E requires a result without errors or abnormal responses", () => {
  assert.equal(e2eSucceeded(true, [], 0), true);
  assert.equal(e2eSucceeded(true, ["failure"], 0), false);
  assert.equal(e2eSucceeded(true, [], 1), false);
  assert.equal(e2eSucceeded(false, [], 0), false);
  assert.match(outputDirectory("en"), /[\\/]\.e2e[\\/]en$/);
});

test("only the first current-play lookup can return the expected 404", () => {
  const classify = responseClassifier();
  const url = "http://127.0.0.1:5173/v1/plays/current";
  assert.equal(classify("GET", url, 404), "expected");
  assert.equal(classify("GET", url, 404), "abnormal");
  assert.equal(classify("POST", url, 404), "abnormal");
  assert.equal(classify("GET", `${url}/other`, 404), "abnormal");
  assert.equal(classify("GET", "http://other:5173/v1/plays/current", 404), "abnormal");
  assert.equal(classify("GET", url, 500), "abnormal");
  assert.equal(responseClassifier()("GET", url, 200), "ok");
  const existing = responseClassifier();
  assert.equal(existing("GET", url, 200), "ok");
  assert.equal(existing("GET", url, 404), "abnormal");
  const created = responseClassifier();
  assert.equal(created("POST", "http://127.0.0.1:5173/v1/plays", 201), "ok");
  assert.equal(created("GET", url, 404), "abnormal");
});

test("only the exact missing cinematic can return 404", () => {
  const classify = responseClassifier();
  assert.equal(classify("GET", "http://127.0.0.1:5173/cinematics/prelude-v1.mp4", 404), "expected");
  assert.equal(classify("GET", "http://127.0.0.1:5173/cinematics/other.mp4", 404), "abnormal");
  assert.equal(classify("GET", "http://127.0.0.1:5173/cinematics/prelude-v1.mp4?other=1", 404), "abnormal");
});

test("only the known Three.js software renderer warning is nonfatal", () => {
  const warning = "THREE.WebGLRenderer: KHR_parallel_shader_compile extension not supported.";
  assert.equal(consoleClassifier("warning", warning), "warning");
  assert.equal(consoleClassifier("error", warning), "error");
  assert.equal(consoleClassifier("warning", "THREE.WebGLRenderer: another extension not supported."), "error");
  assert.equal(consoleClassifier("error", "network error"), "error");
  assert.equal(consoleClassifier("log", "ordinary message"), "ignore");
});

test("only the exact known stderr diagnostics become warnings", () => {
  const warning = "[console.warn] THREE.WebGLRenderer: KHR_parallel_shader_compile extension not supported.";
  assert.equal(stderrClassifier("vite", `12:34:56 PM [vite] ${warning}`), "warning");
  assert.equal(stderrClassifier("vite", `오후 11:36:44 [vite] (client) ${warning}`), "warning");
  assert.equal(stderrClassifier("vite", `오후 11:36:44 [vite] (client) ${warning}\nerror`), "error");
  assert.equal(stderrClassifier("vite", `${warning} extra error`), "error");
  assert.equal(stderrClassifier("server", warning), "error");
  const edge = "[123:456:1102/120000.000:ERROR:chrome/browser/task_manager/providers/fallback_task_provider.cc:123] Every renderer should have at least one task provided by a primary task provider.";
  assert.equal(stderrClassifier("browser", edge), "warning");
  assert.equal(stderrClassifier("browser", edge.replace("fallback_task_provider.cc", "other.cc")), "error");
  assert.equal(stderrClassifier("browser", "[123:456:ERROR:extensions/loader.cc:12] missing host extension"), "error");
});

test("world interaction requires active exploration and enabled village input", () => {
  const game = { exploring: true, settingsMenu: { hidden: true } };
  const village = { enabled: true, ready: true, portrait: false, talking: undefined };
  assert.equal(canInteract(game, village), true);
  assert.equal(canInteract({ ...game, exploring: false }, village), false);
  assert.equal(canInteract({ ...game, settingsMenu: { hidden: false } }, village), false);
  for (const change of [{ enabled: false }, { ready: false }, { portrait: true }, { talking: "moka" }]) assert.equal(canInteract(game, { ...village, ...change }), false);
});
