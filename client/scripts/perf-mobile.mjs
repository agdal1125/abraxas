import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';

const port = Number(process.argv[2] || 5173);
assert(Number.isInteger(port) && port > 0 && port < 65536, 'Invalid port');
const profile = await mkdtemp(join(tmpdir(), 'abraxas-edge-'));
const edge = spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', [
  '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${resolve(profile)}`,
  '--no-first-run', '--no-default-browser-check', '--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', 'about:blank'
], { stdio: ['ignore', 'ignore', 'pipe'] });
edge.stderr.on('data', data => process.stderr.write(data));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let ws;
try {
  let debugPort;
  for (let i = 0; i < 100 && !debugPort; i++) {
    try { debugPort = Number((await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); } catch { await delay(100); }
  }
  assert(debugPort, 'Edge did not start');
  const target = await (await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: 'PUT' })).json();
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let id = 0, bytes = 0;
  const pending = new Map();
  ws.onclose = event => { for (const { reject } of pending.values()) reject(new Error(`CDP closed: ${event.code} ${event.reason}`)); pending.clear(); };
  ws.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.method === 'Network.loadingFinished') bytes += message.params.encodedDataLength;
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id); pending.delete(message.id);
      message.error ? reject(new Error(message.error.message)) : resolve(message.result);
    }
  };
  const call = (method, params = {}) => new Promise((resolve, reject) => { const n = ++id; pending.set(n, { resolve, reject }); ws.send(JSON.stringify({ id: n, method, params })); });
  const evaluate = async expression => {
    const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };
  await call('Page.enable'); await call('Runtime.enable'); await call('Network.enable'); await call('Performance.enable');
  await call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await call('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
  await call('Emulation.setCPUThrottlingRate', { rate: 4 });
  await call('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8, connectionType: 'cellular3g' });
  const start = performance.now();
  await call('Page.navigate', { url: `http://localhost:${port}/` });
  let ready = false;
  for (let i = 0; i < 1200; i++) {
    ready = await evaluate(`Boolean(window.__abraxas?.village?.ready && document.querySelector('.game-controls:not([hidden])'))`);
    if (ready) break;
    await evaluate(`(() => { const title = document.querySelector('.title-controls button:first-child'); const next = document.querySelector('.continue, .choices button:first-child'); if (title) title.click(); else if (next) next.click(); })()`);
    await delay(100);
  }
  assert(ready, 'World did not become playable');
  const playableMs = performance.now() - start, transfer = bytes;
  const paint = await evaluate(`performance.getEntriesByType('paint').find(e => e.name === 'first-contentful-paint')?.startTime ?? null`);
  const before = await evaluate(`({x: window.__abraxas.village.player.position.x, z: window.__abraxas.village.player.position.z})`);
  const pad = await evaluate(`(() => { const r = document.querySelector('.move-pad').getBoundingClientRect(); return {x:r.x+r.width/2, y:r.y+r.height/2}; })()`);
  await call('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pad.x + 30, y: pad.y }] });
  const frames = await evaluate(`new Promise(resolve => { let n=0, start; function frame(t) { start ??= t; n++; if(t-start >= 10000) resolve({n, elapsed:t-start}); else requestAnimationFrame(frame); } requestAnimationFrame(frame); })`);
  await call('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const after = await evaluate(`({x: window.__abraxas.village.player.position.x, z: window.__abraxas.village.player.position.z})`);
  assert(Math.hypot(after.x - before.x, after.z - before.z) > 0.01, 'Touch input did not move player');
  const metrics = (await call('Performance.getMetrics')).metrics;
  const heap = metrics.find(metric => metric.name === 'JSHeapUsedSize').value;
  const table = `| 항목 | 측정값 |\n| --- | ---: |\n| 첫 콘텐츠 표시 (FCP) | ${paint === null ? '측정 불가' : (paint / 1000).toFixed(2) + '초'} |\n| 시작부터 마을 조작 가능까지 | ${(playableMs / 1000).toFixed(2)}초 |\n| 조작 가능까지 전송량 | ${(transfer / 1024 / 1024).toFixed(2)} MiB (${Math.round(transfer).toLocaleString('en-US')} bytes) |\n| 이동 중 평균 FPS (10초) | ${(frames.n * 1000 / frames.elapsed).toFixed(1)} |\n| 이동 후 JS 힙 사용량 | ${(heap / 1024 / 1024).toFixed(2)} MiB |`;
  const report = `# 모바일 에뮬레이션 성능 측정 — 2026-11-01\n\n실제 폰 측정이 아닌 이 컴퓨터의 Edge 헤드리스 CDP 에뮬레이션 결과다. 개발 서버와 빈 브라우저 프로필을 사용했다. 390×844, DPR 2, 터치, CPU 4배 감속, Fast 3G 수준(지연 150ms, 다운로드 1.6Mbps, 업로드 750Kbps)으로 측정했다. 렌더러는 모바일에서 자체적으로 픽셀 비율을 1.5로 제한한다. GPU 프로세스가 실행 환경에서 종료되어 SwiftShader 소프트웨어 렌더링을 사용했으므로 FPS는 실제 모바일 GPU 성능을 나타내지 않는다.\n\n첫 화면은 브라우저 FCP다. 조작 가능 시간은 타이틀부터 프롤로그를 자동 클릭하고 마을 자산 로드 및 이동 UI 준비까지의 시간으로, 자동 클릭 간격과 이야기 길이를 포함한다. 전송량은 그 시점까지 완료된 요청의 CDP encodedDataLength 합계다. FPS는 터치 이동 입력을 유지한 10초의 requestAnimationFrame 횟수이며 실제 위치 변화도 확인했다. 힙은 이동 직후 CDP JSHeapUsedSize다. 개발 서버의 모듈 전송량은 배포 빌드와 다르다.\n\n${table}\n\n실행: \`npm --prefix client run dev\` 후 \`node client/scripts/perf-mobile.mjs 5173\`.\n`;
  await writeFile('docs/reviews/perf-mobile-2026-11-01.md', report, 'utf8');
  console.log(table);
} finally {
  ws?.close(); edge.kill();
  for (let i = 0; i < 20; i++) { try { await rm(profile, { recursive: true, force: true }); break; } catch { await delay(250); } }
}
