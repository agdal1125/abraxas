import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { deflateSync, inflateSync } from 'node:zlib';
import assert from 'node:assert/strict';

// Chrome screenshots are 8-bit RGB/RGBA, non-interlaced PNGs.
function decodePng(png) {
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  let width, height, channels, compressed = [], offset = 8;
  while (offset < png.length) {
    const length = png.readUInt32BE(offset), type = png.toString('ascii', offset + 4, offset + 8), data = png.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); channels = data[9] === 6 ? 4 : data[9] === 2 ? 3 : 0; assert(data[8] === 8 && channels && data[12] === 0, 'Unsupported PNG format'); }
    if (type === 'IDAT') compressed.push(data);
    offset += length + 12;
    if (type === 'IEND') break;
  }
  const raw = inflateSync(Buffer.concat(compressed)), stride = width * channels, pixels = Buffer.alloc(stride * height);
  assert.equal(raw.length, (stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]; assert(filter <= 4, 'Unsupported PNG filter');
    for (let x = 0; x < stride; x++) {
      const i = y * stride + x, a = x >= channels ? pixels[i - channels] : 0, b = y ? pixels[i - stride] : 0, c = y && x >= channels ? pixels[i - stride - channels] : 0;
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      const predictor = filter === 1 ? a : filter === 2 ? b : filter === 3 ? Math.floor((a + b) / 2) : filter === 4 ? (pa <= pb && pa <= pc ? a : pb <= pc ? b : c) : 0;
      pixels[i] = (raw[y * (stride + 1) + x + 1] + predictor) & 255;
    }
  }
  return { width, height, channels, pixels };
}
function average(image, [x, y, w, h]) {
  assert(x >= 0 && y >= 0 && x + w <= image.width && y + h <= image.height);
  const sum = [0, 0, 0];
  for (let row = y; row < y + h; row++) for (let col = x; col < x + w; col++) for (let c = 0; c < 3; c++) sum[c] += image.pixels[(row * image.width + col) * image.channels + c];
  return sum.map(n => Math.round(n / (w * h)));
}

// Exercise all PNG row filters before decoding browser captures.
const chunk = (type, data) => { const result = Buffer.alloc(data.length + 12); result.writeUInt32BE(data.length); result.write(type, 4); data.copy(result, 8); return result; };
const header = Buffer.alloc(13); header.writeUInt32BE(1, 0); header.writeUInt32BE(5, 4); header[8] = 8; header[9] = 2;
const fixture = Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header), chunk('IDAT', deflateSync(Buffer.from([0, 10, 20, 30, 1, 10, 20, 30, 2, 0, 0, 0, 3, 5, 10, 15, 4, 0, 0, 0]))), chunk('IEND', Buffer.alloc(0))]);
assert.deepEqual(average(decodePng(fixture), [0, 0, 1, 5]), [10, 20, 30]);

const port = Number(process.argv[2] || 5173); assert(Number.isInteger(port) && port > 0 && port < 65536);
const profile = await mkdtemp(join(tmpdir(), 'abraxas-color-'));
const edge = spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${resolve(profile)}`, '--no-first-run', '--no-default-browser-check', '--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', 'about:blank'], { stdio: 'ignore' });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms)); let ws;
try {
  let debugPort; for (let i = 0; i < 100 && !debugPort; i++) { try { debugPort = Number((await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); } catch { await delay(100); } }
  assert(debugPort, 'Edge did not start');
  const target = await (await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: 'PUT' })).json();
  ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let id = 0; const pending = new Map();
  ws.onclose = () => { for (const { reject } of pending.values()) reject(new Error('CDP closed')); };
  ws.onmessage = ({ data }) => { const m = JSON.parse(data); if (m.id && pending.has(m.id)) { const { resolve, reject } = pending.get(m.id); pending.delete(m.id); m.error ? reject(new Error(m.error.message)) : resolve(m.result); } };
  const call = (method, params = {}) => new Promise((resolve, reject) => { const n = ++id; pending.set(n, { resolve, reject }); ws.send(JSON.stringify({ id: n, method, params })); });
  const evaluate = async expression => { const r = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text); return r.result.value; };
  await call('Page.enable'); await call('Runtime.enable');
  await call('Emulation.setDeviceMetricsOverride', { width: 800, height: 800, deviceScaleFactor: 1, mobile: false });
  await call('Page.navigate', { url: `http://127.0.0.1:${port}/` });
  let ready = false;
  for (let i = 0; i < 600; i++) { ready = await evaluate(`Boolean(window.__abraxas?.village?.ready && document.querySelector('.game-controls:not([hidden])'))`); if (ready) break; await evaluate(`(() => { const title = document.querySelector('.title-controls button:first-child'); const next = document.querySelector('.continue, .choices button:first-child'); if (title) title.click(); else if (next) next.click(); })()`); await delay(100); }
  assert(ready, 'World did not become playable; use the development server');
  for (const [name, x, z] of [['plaza', 0, 1.5], ['entrance', 6, 10.4]]) {
    await evaluate(`window.__abraxas.village.teleport(${x}, ${z})`); await delay(1200);
    const png = Buffer.from((await call('Page.captureScreenshot', { format: 'png' })).data, 'base64');
    await writeFile(join(tmpdir(), `abraxas-${name}.png`), png);
    const image = decodePng(png);
    const regions = name === 'plaza' ? { grass: [270, 400, 12, 12], path: [600, 300, 12, 12], 'A torso': [570, 185, 8, 8] } : { grass: [600, 300, 12, 12], path: [350, 400, 12, 12] };
    for (const [label, rect] of Object.entries(regions)) console.log(`${name} ${label} ${rect.join(',')} RGB ${average(image, rect).join(',')}`);
    console.log(`${name}: ${join(tmpdir(), `abraxas-${name}.png`)} (${image.width}x${image.height})`);
  }
} finally { ws?.close(); edge.kill(); for (let i = 0; i < 20; i++) { try { await rm(profile, { recursive: true, force: true }); break; } catch { await delay(250); } } }
