// Dev-only performance check (see docs/DECISIONS.md, D-010). Not part of the app or the test suite.
// Drives headless Chrome over the DevTools protocol (no dependencies): opens the dev server, loads
// the 500-object / 700-connection generator, and reports frame times for pan, zoom and node drag.
//
//   npm run dev                                   # note the port
//   node scripts/perf-cdp.mjs http://localhost:5180/#sld
//   # production build: also run `npm run build && npx vite preview --port 5190`, then
//   PROD=http://localhost:5190/#sld node scripts/perf-cdp.mjs http://localhost:5180/#sld
//
// CHROME overrides the browser path. Frame times are rAF deltas; ~16.7 ms is 60 fps.
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const URL_ = process.argv[2] ?? 'http://localhost:5180/#sld';
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const prof = mkdtempSync(path.join(tmpdir(), 'conductor-perf-'));
const port = 9333;
const proc = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, '--window-size=1600,1000', '--no-first-run', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let targets;
for (let i = 0; i < 50; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); break; } catch { await sleep(200); } }
const page = targets.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let seq = 0; const pending = new Map();
ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } });
const send = (method, params = {}) => new Promise((r) => { const id = ++seq; pending.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails)); return r.result.result.value; };
const mouse = (type, x, y, extra = {}) => send('Input.dispatchMouseEvent', { type, x, y, ...extra });

await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: URL_ });
await sleep(2500);
await ev(`localStorage.clear()`);
await send('Page.navigate', { url: URL_ });
await sleep(2500);
await ev(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('500/700')).click()`);
await sleep(2500);
if (process.env.PROD) {
  await sleep(1500); // let autosave run
  const dump = await ev(`JSON.stringify(Object.fromEntries(Object.keys(localStorage).map(k => [k, localStorage.getItem(k)])))`);
  await send('Page.navigate', { url: new URL('/favicon.svg', process.env.PROD).href });
  await sleep(1000);
  await ev(`(() => { const d = ${dump}; localStorage.clear(); for (const [k, v] of Object.entries(d)) localStorage.setItem(k, v); return 1; })()`);
  await send('Page.navigate', { url: process.env.PROD });
  await sleep(3000);
}
const counts = await ev(`({ nodes: document.querySelectorAll('.react-flow__node').length, edges: document.querySelectorAll('.react-flow__edge').length })`);
console.log('rendered after fit:', counts);

const startMeter = () => ev(`(() => { window.__f = []; window.__lt = []; let last = performance.now(); window.__run = true;
  const loop = (t) => { window.__f.push(t - last); last = t; if (window.__run) requestAnimationFrame(loop); }; requestAnimationFrame(loop);
  window.__po?.disconnect(); window.__po = new PerformanceObserver((l) => l.getEntries().forEach(e => window.__lt.push(e.duration))); window.__po.observe({ type: 'longtask' }); return 1; })()`);
const stopMeter = async (label) => {
  const r = await ev(`(() => { window.__run = false; const f = window.__f.slice(2).sort((a,b)=>a-b); const lt = window.__lt;
    const pct = (p) => f[Math.min(f.length-1, Math.floor(f.length*p))];
    return { frames: f.length, avgMs: +(f.reduce((a,b)=>a+b,0)/f.length).toFixed(1), p50: +pct(.5).toFixed(1), p95: +pct(.95).toFixed(1), max: +f[f.length-1].toFixed(1), over50ms: f.filter(x=>x>50).length, longTasks: lt.length, longestTask: lt.length ? Math.round(Math.max(...lt)) : 0 }; })()`);
  console.log(label.padEnd(28), JSON.stringify(r));
};
const box = await ev(`(() => { const r = document.querySelector('.react-flow__pane').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; })()`);
const cx = box.x + box.w / 2, cy = box.y + box.h / 2;

async function pan(label) {
  await startMeter();
  await mouse('mousePressed', cx, cy, { button: 'middle', buttons: 4, clickCount: 1 });
  for (let i = 0; i < 90; i++) { await mouse('mouseMoved', cx + Math.sin(i / 10) * 200, cy + Math.cos(i / 10) * 120, { button: 'middle', buttons: 4 }); await sleep(16); }
  await mouse('mouseReleased', cx, cy, { button: 'middle', buttons: 0, clickCount: 1 });
  await sleep(200); await stopMeter(label);
}
async function zoom(label) {
  await startMeter();
  for (let i = 0; i < 60; i++) { await mouse('mouseWheel', cx + 100, cy, { deltaX: 0, deltaY: i < 30 ? -60 : 60 }); await sleep(16); }
  await sleep(300); await stopMeter(label);
}
async function drag(label, sel) {
  const p = await ev(`(() => { const e = ${sel.startsWith('q:') ? `document.querySelectorAll('${sel.slice(2)}')[3]` : `[...document.querySelectorAll('.react-flow__node')].filter(e => e.textContent.includes('${sel}'))[0]`}; if (!e) return null; const r = e.querySelector('svg')?.getBoundingClientRect() ?? e.getBoundingClientRect(); return { x: r.left + r.width/2, y: r.top + r.height/2 }; })()`);
  if (!p) { console.log(label, 'node not found'); return; }
  await startMeter();
  await mouse('mouseMoved', p.x, p.y);
  await mouse('mousePressed', p.x, p.y, { button: 'left', buttons: 1, clickCount: 1 });
  for (let i = 1; i <= 90; i++) { await mouse('mouseMoved', p.x + Math.sin(i / 12) * 150, p.y + i, { button: 'left', buttons: 1 }); await sleep(16); }
  await mouse('mouseReleased', p.x + Math.sin(90 / 12) * 150, p.y + 90, { button: 'left', buttons: 0, clickCount: 1 });
  await sleep(400); await stopMeter(label);
}

await sleep(500);
await pan('pan (fit, all visible)');
await zoom('zoom in/out (fit)');
await drag('drag one device (fit)', 'q:.react-flow__node-equipment');
await drag('drag a bus (fit)', 'q:.react-flow__node-bus');
// Zoomed in to a working scale
await ev(`document.querySelector('[title^="Zoom in"]').click()`); await sleep(300);
await ev(`document.querySelector('[title^="Zoom in"]').click()`); await sleep(300);
await ev(`document.querySelector('[title^="Zoom in"]').click()`); await sleep(500);
console.log('rendered zoomed:', await ev(`({ nodes: document.querySelectorAll('.react-flow__node').length, edges: document.querySelectorAll('.react-flow__edge').length })`));
await pan('pan (zoomed in)');
const tag = await ev(`[...document.querySelectorAll('.react-flow__node')].map(e=>e.textContent).find(t=>/CB-\\d+-\\d+/.test(t))?.match(/CB-\\d+-\\d+/)[0]`);
await drag('drag one breaker (zoomed)', tag);
// Commit cost: one undo step on the big document
const t = await ev(`(async () => { const t0 = performance.now(); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true })); window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true })); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); return Math.round(performance.now() - t0); })()`);
console.log('undo + render (ms)', t);
ws.close(); proc.kill();
process.exit(0);
