// Performance of direct manipulation: each major drag runs continuously in real time (no virtual clock) while the page
// records its per-frame draw time (window.__lyaPerf — the scene's whole draw, physics recomputation included) and counts
// frames. Desktop Chromium, headless, at device scale 1 and 2. Usage: node app/perf.mjs <out.json>
import fs from 'node:fs'; import path from 'node:path'; import { execSync } from 'node:child_process'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
const here = path.dirname(new URL(import.meta.url).pathname), [out] = process.argv.slice(2);
const browser = await chromium.launch(), results = [];   // the normal 60 Hz frame clock: every frame carries the latest drag update
for (const dpr of [1, 2]) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 880 }, deviceScaleFactor: dpr }), page = await ctx.newPage();
  const fig = async (x, y) => { const b = await page.$eval('#cv', el => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }); return [b.x + x / 1070 * b.w, b.y + y / 780 * b.h]; };
  async function open(hash) { await page.goto('file://' + path.join(here, 'dist/lya.html') + '?' + Math.random() + '#' + hash); await page.waitForFunction(() => typeof window.__lyaPerf === 'function'); await page.evaluate(() => { sessionStorage.setItem('lya.b3.formed', '1'); sessionStorage.setItem('lya.b7.revealed', '1'); sessionStorage.setItem('lya.b12.traced', '1'); }); await page.goto('file://' + path.join(here, 'dist/lya.html') + '?' + Math.random() + '#' + hash); await page.waitForFunction(() => typeof window.__lyaPerf === 'function'); await page.waitForTimeout(800); }
  async function measure(name, drag) {
    await page.evaluate(() => { window.__lyaPerf(true); window.__fr = 0; window.__run = true; const f = () => { window.__fr++; if (window.__run) requestAnimationFrame(f); }; requestAnimationFrame(f); window.__t0 = performance.now(); });
    await drag();
    const r = await page.evaluate(() => { window.__run = false; const dt = (performance.now() - window.__t0) / 1000; return { fps: window.__fr / dt, seconds: dt, ...window.__lyaPerf() }; });
    results.push({ dpr, name, fps: +r.fps.toFixed(1), seconds: +r.seconds.toFixed(2), frames: r.frames, draw_mean_ms: +r.mean_ms.toFixed(2), draw_p95_ms: +r.p95_ms.toFixed(2), draw_max_ms: +r.max_ms.toFixed(2) });
    console.log(`dpr ${dpr} · ${name.padEnd(34)} ${r.fps.toFixed(0)} fps · draw mean ${r.mean_ms.toFixed(2)} ms, p95 ${r.p95_ms.toFixed(2)} ms`);
  }
  const sweep = async (a, b, n = 120, back = true) => { await page.mouse.move(...a); await page.mouse.down(); for (let k = 0; k <= n; k++) { const f = back ? (k <= n / 2 ? 2 * k / n : 2 - 2 * k / n) : k / n; await page.mouse.move(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f); await page.waitForTimeout(16); } await page.mouse.up(); };
  await open('beat=3');
  await measure('Beat 3 · hold the gas, then refine', async () => { const p = await fig(600, 150); await page.mouse.move(...p); await page.mouse.down(); await page.waitForTimeout(1500); for (let k = 0; k <= 60; k++) { await page.mouse.move(p[0], p[1] + (k <= 30 ? k * 3 : (60 - k) * 3)); await page.waitForTimeout(16); } await page.mouse.up(); });
  await open('beat=7'); await measure('Beat 7 · peculiar-velocity drag (b)', async () => sweep(await fig(745, 112), await fig(800, 112)));   // inside the domain: v changes every move (no clamp, no memo hits)
  await open('beat=12'); await measure('Beat 12 · inverse spectral scan', async () => sweep(await fig(110, 560), await fig(1030, 560)));
  await open('beat=10'); await measure('Beat 10 · light-table loupe', async () => sweep(await fig(130, 235), await fig(1000, 235)));
  await open('beat=5&stage=1'); await measure('Beat 5 · drag the light', async () => sweep(await fig(990, 74), await fig(130, 74)));
  await open('beat=6'); await measure('Beat 6 · move the parcel', async () => sweep(await fig(741, 150), await fig(300, 150)));   // every move recomputes its τ (and the ghost's comparison)
  await open('beat=6'); await measure('Beat 6 · push its motion', async () => sweep(await fig(778, 104), await fig(700, 104)));
  await open('beat=6'); await measure('Beat 6 · hold the parcel (warmer)', async () => { const p = await fig(741, 150); await page.mouse.move(...p); await page.mouse.down(); await page.waitForTimeout(2000); await page.mouse.up(); });
  await open('beat=0'); await page.waitForTimeout(7600); await measure('Beat 0 · slide along the beam (after the entry drift)', async () => sweep(await fig(200, 208), await fig(760, 208)));
  await ctx.close();
}
await browser.close();
// the exact physics behind each update, timed alone (Node, the same lyaphys and toy data): no cache or approximation is used
const P = require(path.join(here, '../science/js/lyaphys.js')), sk = JSON.parse(fs.readFileSync(path.join(here, '../science/data/toy/skewer.json'), 'utf8'));
const HUB = P.hubblePerMpch(sk.z, sk.cosmo), period = HUB * sk.L_mpch, cells = P.cellsFromSkewer({ z: sk.z, cosmo: sk.cosmo, dx_mpch: sk.dx_mpch, x: sk.x, nHI: sk.nHI, T: sk.T, v: sk.v });
const ugW = P.linspace(HUB * -0.45, HUB * 4.85, 1100), ug = P.linspace(0, period, 2049).slice(0, 2048);
const time = (fn, n = 200) => { fn(); const t0 = performance.now(); for (let i = 0; i < n; i++) fn(i); return (performance.now() - t0) / n; };
const physics = {
  'Beat 3 · one temperature: b(T) and 260 velocities': time(i => { const b = P.dopplerB(1e4 + i); let s = 0; for (let k = 0; k < 260; k++) s += k * b / Math.SQRT2; return s; }),
  'Beat 7 · one dragged parcel: parcelToCells + Voigt τ on 1100 velocities': time(i => P.tauFromCells(ugW, P.parcelToCells({ ...sk.parcels[1], v: 87 + i }, HUB, { nsub: 161 }), { profile: 'voigt' })),
  'Beat 6 · one change: parcelTau on the drawn grid, and lineMoments of it and the ghost on the comparison grid': time(i => { const p = { ...sk.parcels[1], dvdx: 0, x: 2 + i * 1e-3 }, t = P.parcelTau(ugW, p, HUB), ug6 = P.linspace(ugW[0] - 300, ugW[ugW.length - 1] + 300, 2200); return [t, P.lineMoments(ug6, P.parcelTau(ug6, p, HUB)), P.lineMoments(ug6, P.parcelTau(ug6, sk.parcels[1], HUB))]; }, 50),
  'Beat 12 · one cursor position: tauContributions over every cell': time(i => P.tauContributions((i * 37.3) % period, cells, { period, cut: 6 })),
  'Beat 12 · one gas region: its own τ on 2048 colours': time(i => P.tauFromCells(ug, cells.slice(100 + (i % 40), 106 + (i % 40)), { period, profile: 'gauss', cut: 6 })),
};
for (const [k, v] of Object.entries(physics)) console.log(`physics · ${k.padEnd(70)} ${v.toFixed(3)} ms`);
fs.writeFileSync(out, JSON.stringify({ generated_by: 'app/perf.mjs', note: 'headless Chromium, software rendering; draw = the scene draw including physics recomputation', results, physics_ms_per_update: Object.fromEntries(Object.entries(physics).map(([k, v]) => [k, +v.toFixed(4)])) }, null, 1));
