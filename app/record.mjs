// One uninterrupted end-to-end run, Beat 0 → 13, through the production app, with real pointer events on the figure and
// the margin and a virtual clock (deterministic). A small ring shows where the hand is. Writes frames; encode with ffmpeg.
// Usage: node app/record.mjs <framesDir> [fps=15] [route: story | surface (= full) | b0 | b3 | b6 | b7 | b10 | b12 | agency | cold]
//   surface: a fresh study session through the canonical path, one physical action per beat; b0…b12: one instrument each;
//   agency: touch, change, inspect, trace back; cold: the implicit pass's cold start. (The material pass's route drove controls
//   that later passes replaced; its frames remain in design/material/.)
import fs from 'node:fs'; import path from 'node:path'; import { execSync } from 'node:child_process'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
const here = path.dirname(new URL(import.meta.url).pathname);
const [outdir, fpsArg, route = 'full'] = process.argv.slice(2), fps = +(fpsArg || 15);   // story: the reader's-pace story recording (chapters.json)
fs.mkdirSync(outdir, { recursive: true });
const browser = await chromium.launch(), ctx = await browser.newContext({ viewport: { width: 1440, height: 880 }, deviceScaleFactor: 1 }), page = await ctx.newPage();
await ctx.addInitScript(() => { window.__lyaVirtualClock = true; });   // the virtual clock from the first frame
const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto('file://' + path.join(here, 'dist/lya.html') + ({ surface: '#cold=1', full: '#cold=1', cold: '#cold=1', b6: '#beat=6' }[route] || '#beat=0'));   // a new context is a fresh session; surface/cold: a study session (#cold=1)
await page.waitForTimeout(1800);
await page.evaluate(() => { const c = document.createElement('div'); c.id = '__cur'; c.style.cssText = 'position:fixed;left:-50px;top:-50px;width:16px;height:16px;margin:-8px 0 0 -8px;border:1px solid #59616C;border-radius:50%;pointer-events:none;z-index:999;background:rgba(89,97,108,.08)'; document.body.appendChild(c); });
let T = 0, n = 0, cx = 700, cy = 440;
const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
async function tick(k = 1) { for (let i = 0; i < k; i++) { T += 1 / fps; await page.evaluate(t => window.__lyaClock(t), T); await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))); await page.screenshot({ path: path.join(outdir, `f${String(n++).padStart(5, '0')}.png`) }); } }
const wait = s => tick(Math.max(1, Math.round(s * fps)));
async function at(x, y) { cx = x; cy = y; await page.mouse.move(x, y); await page.evaluate(([x, y]) => { const c = document.getElementById('__cur'); c.style.left = x + 'px'; c.style.top = y + 'px'; }, [x, y]); }
async function glide(x1, y1, s, { down = false } = {}) { const x0 = cx, y0 = cy, k = Math.max(1, Math.round(s * fps)); if (down) await page.mouse.down(); for (let i = 1; i <= k; i++) { const f = ease(i / k); await at(x0 + (x1 - x0) * f, y0 + (y1 - y0) * f); await tick(1); } if (down) await page.mouse.up(); }
const cv = (x, y) => [340 + x, 70 + y];                               // figure coordinates → page (stage at scale 1)
async function boxOf(sel) { const el = await page.$(sel); if (!el) throw new Error('no ' + sel); return el.boundingBox(); }
async function clickSel(sel, s = 0.6) { const b = await boxOf(sel); await glide(b.x + b.width / 2, b.y + b.height / 2, s); await page.mouse.down(); await page.mouse.up(); await tick(2); }
async function ruler(key, f0, f1, s) { const b = await boxOf(`[data-fk="r:${key}"]`); await glide(b.x + b.width * f0, b.y + 12, 0.5); await glide(b.x + b.width * f1, b.y + 12, s, { down: true }); }
async function choice(key, v) { await clickSel(`[data-fk="c:${key}:${v}"]`); }
async function next() { await clickSel('#next', 0.5); await wait(0.3); }
async function beat(k) { await clickSel(`#topnav .bn[data-k="${k}"]`, 0.6); await wait(0.3); }

const wmx = x => 90 + (x + 0.45) / 5.3 * 950;                       // the teaching window's real-space axis (primitives/sightline.js WX)
async function beam(px, s) { const [x, y] = await page.evaluate(p => window.__lyaState()._g3.ray(p), px); await glide(...cv(x, y + 4), s); }   // Beat 0: the hand on the beam
async function holdAt(x, y, s) { await glide(...cv(x, y), 0.6); await page.mouse.down(); await wait(s); await page.mouse.up(); }
async function b6tour(short = false) {   // one parcel: move it, push it, warm it (hold), cool it, set its amount; the line answers each time
  const st = () => page.evaluate(() => { const S = window.__lyaState(); return { x: S.x, v: S.v }; });
  let s0 = await st(); await glide(...cv(wmx(s0.x), 150), 0.8); await glide(...cv(wmx(1.6), 152), short ? 2.2 : 3.2, { down: true }); await wait(short ? 1.2 : 1.8);   // move it
  s0 = await st(); const tip = wmx(s0.x) + s0.v * 0.45; await glide(...cv(tip - 2, 104), 0.7); await glide(...cv(tip - 2 - 145 * 0.45, 104), short ? 1.8 : 2.6, { down: true }); await wait(short ? 1.2 : 1.8);   // push it (v → −58)
  s0 = await st(); await holdAt(wmx(s0.x), 150, short ? 1.8 : 2.4); await wait(short ? 1.2 : 1.8);   // hold: warmer gas
  if (!short) { await glide(...cv(wmx(s0.x), 150), 0.4); await glide(...cv(wmx(s0.x), 205), 1.8, { down: true }); await wait(1.6); }   // hold and drag down: cooler
  await ruler('logN', 0.77, 0.93, short ? 1.4 : 2); await wait(short ? 1.4 : 2);   // the amount: an instrument setting
}
const MARKS = [];   // chapter marks for the story recording: the time each beat begins
const mark = k => MARKS.push({ beat: k, t: +T.toFixed(2) });
const ROUTES = {
  story: async () => {   // the story at a reader's pace: a fresh session, Beat 0 → 13, the surface prose given time to read, the intended gesture in each beat, no microscope
    mark(0); await wait(7); await beam(10.6, 1.4); await wait(1.2); await beam(14, 2.6); await wait(1.4); await beam(4.5, 3.6); await wait(1.4); await glide(...cv(640, 90), 0.8); await glide(...cv(530, 135), 2, { down: true }); await wait(2.4); await next();
    mark(1); await wait(7); await ruler('zoom', 0, 0.34, 1.8); await wait(3); await ruler('zoom', 0.34, 0.67, 1.6); await wait(4); await ruler('zoom', 0.67, 1, 1.4); await wait(4.5); await next();
    mark(2); await wait(8); await glide(...cv(363, 352), 0.8); await glide(...cv(320, 352), 2, { down: true }); await wait(2.2); await glide(...cv(320, 352), 0.2); await glide(...cv(363, 352), 1.6, { down: true }); await wait(2); await choice('mode', 'many'); await wait(4.5); await next();
    mark(3); await wait(10); await holdAt(600, 150, 2.8); await wait(2.4); await glide(...cv(560, 430), 0.7); await glide(...cv(720, 430), 2); await wait(2.4); await next();
    mark(4); await wait(6); for (const st of [2, 3, 4]) { await choice('stage', st); await wait(3.6); } await wait(1); await next();
    mark(5); await wait(7); await glide(...cv(990, 74), 0.8); await glide(...cv(560, 74), 6, { down: true }); await wait(3.4); await choice('stage', 7); await wait(6); await next();
    mark(6); await wait(7); await b6tour(true); await wait(3); await next();
    mark(7); await wait(7); await glide(...cv(780, 110), 0.8); await glide(...cv(830, 110), 2.4, { down: true }); await wait(2.4); await glide(...cv(150, 420), 0.6); await glide(...cv(1000, 420), 4); await wait(2); await next();
    mark(8); await wait(7); for (const nc of [12, 48, 225]) { await choice('nc', nc); await wait(3.2); } await next();
    mark(9); await wait(8); await clickSel('[data-fk="t:wrong"]'); await wait(5); await clickSel('[data-fk="t:wrong"]'); await wait(1); await next();
    mark(10); await wait(7); await glide(...cv(830, 235), 0.8); await glide(...cv(250, 235), 4.4, { down: true }); await wait(3); await next();
    mark(11); await wait(7); await ruler('fwhm', 0, 0.35, 1.8); await wait(1.6); await choice('snr', 20); await wait(4); await next();
    mark(12); await wait(9); await glide(...cv(588, 600), 0.8); await glide(...cv(250, 580), 4.4, { down: true }); await wait(2.6); await glide(...cv(320, 262), 0.8); await wait(3); await next();
    mark(13); await wait(7); await glide(...cv(560, 110), 0.8); await page.mouse.down(); await page.mouse.up(); await wait(2.4); await choice('phase', 'reveal'); await wait(6); await choice('phase', 'break'); await wait(1.6); await clickSel('[data-fk="t:metal"]'); await wait(4.4); await clickSel('[data-fk="t:lyb"]'); await wait(9);
    mark('end'); fs.writeFileSync(path.join(outdir, 'chapters.json'), JSON.stringify(MARKS, null, 1));
  },
  surface: async () => {   // a fresh study session (#cold=1), Beat 0 → 13, the physical action in each beat; nothing pre-positioned
    await wait(2.4); await beam(10.6, 1); await beam(14, 2.4); await beam(4.5, 3.6); await wait(1); await glide(...cv(640, 90), 0.8); await glide(...cv(530, 135), 1.6, { down: true }); await wait(0.8); await next();   // 0
    await wait(1.2); await ruler('zoom', 0, 0.34, 1.6); await wait(1.2); await ruler('zoom', 0.34, 0.67, 1.4); await wait(1.4); await ruler('zoom', 0.67, 1, 1.2); await wait(1.2); await next();   // 1: a magnification
    await wait(2); await glide(...cv(363, 352), 0.8); await glide(...cv(300, 352), 1.6, { down: true }); await wait(0.8); await glide(...cv(300, 352), 0.2); await glide(...cv(400, 352), 1.6, { down: true }); await wait(1); await next();   // 2: push the atom
    await wait(4.2); await holdAt(600, 150, 2.4); await wait(0.8); await glide(...cv(560, 430), 0.7); await glide(...cv(720, 430), 1.8); await wait(0.6); await next();   // 3: hold the gas; the census
    await wait(1.4); for (const st of [2, 3, 4]) { await choice('stage', st); await wait(2); } await next();   // 4: a chain of reasoning
    await wait(2); await glide(...cv(990, 74), 0.8); await glide(...cv(560, 74), 4.5, { down: true }); await wait(1.4); await next();   // 5: drag the light
    await wait(2.4); await b6tour(true); await next();   // 6: one parcel, four degrees of freedom
    await wait(3.2); await glide(...cv(750, 112), 0.8); await glide(...cv(800, 112), 2, { down: true }); await wait(0.8); await glide(...cv(150, 420), 0.6); await glide(...cv(1000, 420), 3.4); await wait(0.6); await next();   // 7: push; velocity space
    await wait(1.2); for (const nc of [12, 48, 225]) { await choice('nc', nc); await wait(1.4); } await next();   // 8
    await wait(4); await clickSel('[data-fk="t:wrong"]'); await wait(2.2); await clickSel('[data-fk="t:wrong"]'); await wait(0.6); await next();   // 9
    await wait(1.6); await glide(...cv(830, 235), 0.8); await glide(...cv(250, 235), 3.6, { down: true }); await wait(1); await next();   // 10: hold the sheet to the light
    await wait(1.4); await ruler('fwhm', 0, 0.35, 1.6); await choice('snr', 20); await wait(2.2); await next();   // 11: instrument settings
    await wait(5.8); await glide(...cv(588, 600), 0.8); await glide(...cv(250, 580), 3.6, { down: true }); await wait(1); await glide(...cv(320, 262), 0.8); await wait(1.4); await next();   // 12: trace a colour
    await wait(1.8); await glide(...cv(560, 110), 0.8); await page.mouse.down(); await page.mouse.up(); await wait(1.2); await choice('phase', 'reveal'); await wait(2.6); await choice('phase', 'break'); await clickSel('[data-fk="t:metal"]'); await clickSel('[data-fk="t:lyb"]'); await wait(2.6);   // 13
    fs.writeFileSync(path.join(outdir, 'session.json'), JSON.stringify(await page.evaluate(() => window.__lyaSession()), null, 1));
  },
  b0: async () => {   // Beat 0 from a fresh session: no standing instruction; a verb appears beside the beam; the hand follows the beam; then the gas turns
    await wait(2.6); await glide(...cv(600, 640), 0.2); await beam(10.6, 1.2); await wait(0.4); await beam(13.5, 2.6); await wait(1); await beam(4.2, 4.2); await wait(1.2); await beam(7.4, 1.8); await wait(1.6);
    await glide(...cv(640, 90), 0.9); await glide(...cv(520, 140), 2.2, { down: true }); await wait(1.2); await beam(9, 1.2); await beam(16, 3); await wait(1.6);
  },
  b6: async () => { await wait(2.6); await b6tour(); await clickSel('[data-fk="b:back to the toy’s parcel"]'); await wait(2); },   // one uninterrupted sequence: move, push, warm, cool, amount, back
  cold: async () => {   // a fresh session, nothing pre-positioned: the visitor waits for each hint, then acts (hold, drag, trace, inspect)
    await wait(2.5); await beam(4, 1.0); await beam(12, 2.0); await wait(0.6);
    await beat(3); await wait(4.6);
    { const b = await boxOf('[data-fk="r:T"]'); await glide(b.x + b.width * 0.4, b.y + 12, 0.8); await page.mouse.down(); await page.mouse.up(); await tick(2); await wait(1.4); }   // a slider habit: the reading points back to the gas
    await holdAt(600, 150, 2.6); await wait(1.6);   // hold: warmer
    await glide(...cv(600, 150), 0.3); await glide(...cv(600, 245), 1.8, { down: true }); await wait(1.2);   // hold and drag down: cooler
    await glide(...cv(560, 430), 0.8); await glide(...cv(720, 430), 2.2); await wait(0.8);   // dwell on the census
    await beat(5); await wait(2.2); await glide(...cv(990, 74), 0.9); await glide(...cv(640, 74), 3.2, { down: true }); await wait(1.2);
    await beat(7); await wait(3.6); await glide(...cv(750, 112), 0.9); await glide(...cv(805, 112), 2.4, { down: true }); await wait(1.2);
    await beat(10); await wait(2.0); await glide(...cv(830, 235), 0.9); await glide(...cv(300, 235), 3.2); await wait(1.2);
    await beat(12); await wait(6.0); await glide(...cv(588, 600), 0.9); await glide(...cv(250, 580), 3.6, { down: true }); await wait(2.4);
    await glide(...cv(320, 262), 0.8); await wait(1.6);
    fs.writeFileSync(path.join(outdir, 'session.json'), JSON.stringify(await page.evaluate(() => window.__lyaSession()), null, 1));
  },
  b3: async () => {   // the temperature as a live system: a brief formation, then the gas in the reader's hands; the census and the line answer back
    await beat(3); await wait(4.2);
    await holdAt(600, 150, 3.2); await wait(0.6); await glide(...cv(600, 150), 0.3); await glide(...cv(600, 260), 3.2, { down: true }); await wait(0.6);
    await glide(...cv(420, 430), 0.8); await glide(...cv(800, 430), 4.5); await wait(0.6);
    await glide(...cv(560, 690), 0.8); await glide(...cv(700, 690), 2.5); await wait(0.8);
    await glide(...cv(600, 40), 0.6); await clickSel('[data-fk="b:replay how this forms (slowly) ▸"]'); await wait(9.6);
  },
  b7: async () => {   // expansion alone → the simulation's velocities grow in → push b's motion through c and back → velocity space → c alone
    await beat(7); await wait(3.0);
    await glide(...cv(745, 112), 0.8); await glide(...cv(790, 112), 2.4, { down: true }); await wait(0.8);
    await glide(...cv(825, 112), 0.6); await glide(...cv(700, 112), 3.2, { down: true }); await wait(0.8);
    await glide(...cv(150, 420), 0.8); await glide(...cv(1000, 420), 5); await wait(0.6); await glide(...cv(600, 600), 0.5);
    await clickSel('[data-fk="b:expansion alone"]'); await wait(1.2);
    await glide(...cv(857, 112), 0.6); await glide(...cv(790, 112), 2.5, { down: true }); await wait(1.2);
    await clickSel('[data-fk="b:the toy’s velocities"]'); await wait(2.6);
  },
  b10: async () => {   // hold different parts of the sheet to the light; read the flux, and back
    await beat(10); await wait(1);
    await glide(...cv(830, 230), 0.8); await glide(...cv(200, 230), 5, { down: true }); await wait(0.8);
    await glide(...cv(300, 620), 0.8); await glide(...cv(900, 600), 5); await wait(1);
  },
  b12: async () => {   // the one-time causal trace, then a continuous scan (including messy colours), then the gas asks back
    await beat(12); await wait(5.4);
    await glide(...cv(588, 620), 0.6); await glide(...cv(140, 600), 4, { down: true }); await wait(0.4);
    await glide(...cv(140, 600), 0.2); await glide(...cv(1000, 580), 7, { down: true }); await wait(2.6);
    await glide(...cv(150, 262), 0.8); await glide(...cv(950, 262), 6); await wait(1);
  },
  agency: async () => {   // touch gas and light, change something physical, watch the whole system answer, read the graph, trace it back
    await beat(3); await wait(4.0); await holdAt(600, 150, 2.6); await wait(0.4); await glide(...cv(500, 430), 0.6); await glide(...cv(760, 430), 2.4); await wait(0.4);
    await beat(5); await wait(1.2); await glide(...cv(990, 74), 0.6); await glide(...cv(560, 74), 4, { down: true }); await wait(0.8);
    await beat(7); await wait(3.0); await glide(...cv(745, 112), 0.6); await glide(...cv(795, 112), 2.2, { down: true }); await wait(0.6); await glide(...cv(860, 420), 0.8); await wait(1.2);
    await beat(10); await wait(0.8); await glide(...cv(830, 230), 0.6); await glide(...cv(250, 230), 3.5, { down: true }); await wait(0.6);
    await beat(12); await wait(5.4); await glide(...cv(588, 620), 0.6); await glide(...cv(260, 600), 3.6, { down: true }); await wait(1.4);
    await glide(...cv(300, 262), 0.8); await glide(...cv(620, 262), 2.4); await wait(1.2);
  },
};
ROUTES.full = ROUTES.surface;
if (!ROUTES[route]) throw new Error(`unknown route ${route}: ${Object.keys(ROUTES).join(', ')}`);
await ROUTES[route]();
await browser.close();
console.log(`wrote ${n} frames (${(n / fps).toFixed(1)} s at ${fps} fps); page errors: ${errs.length ? errs.slice(0, 5) : 'none'}`);
