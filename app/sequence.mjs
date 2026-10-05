// Reproducible captures of transformations in progress: drive the production page on a virtual clock (window.__lyaClock)
// with keys and real pointer events, and screenshot chosen moments. A spec is a JSON list of sequences:
//   [{ "name": "b03", "hash": "beat=3", "steps": [ {"key": "2"}, {"wait": 1.2}, {"shot": "b03-write"} ] }]
// Steps: wait (s of virtual time), key (pressed with the figure focused), click (CSS selector), move / down / up
// ([x, y] in figure coordinates), eval (JS in the page), shot (file name, .png added), rm (true: reduced motion).
// Usage: node app/sequence.mjs <outDir> <spec.json> [name …]
import fs from 'node:fs'; import path from 'node:path'; import { execSync } from 'node:child_process'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
const here = path.dirname(new URL(import.meta.url).pathname);
const [outdir, specPath, ...only] = process.argv.slice(2);
fs.mkdirSync(outdir, { recursive: true });
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8')).filter(s => !only.length || only.includes(s.name));
const browser = await chromium.launch(), errs = [];
for (const sq of spec) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 880 }, deviceScaleFactor: 2, reducedMotion: sq.rm ? 'reduce' : 'no-preference' }), page = await ctx.newPage();
  await ctx.addInitScript(() => { window.__lyaVirtualClock = true; });   // boot and entry happen on the capture clock: a fresh session is truly cold
  page.on('pageerror', e => errs.push(`${sq.name}: ${e.message}`)); page.on('console', m => { if (m.type() === 'error') errs.push(`${sq.name}: ${m.text()}`); });
  await page.goto('file://' + path.join(here, 'dist/lya.html') + '#' + sq.hash);
  await page.waitForFunction(() => typeof window.__lyaClock === 'function');
  let T = 0; await page.evaluate(t => window.__lyaClock(t), T);
  await page.evaluate(() => { const c = document.createElement('style'); c.textContent = '.dev{animation:none!important}'; document.head.appendChild(c); });
  const settle = () => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const fig = async ([x, y]) => { const b = await page.$eval('#cv', el => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }); return [b.x + x / 1070 * b.w, b.y + y / 780 * b.h]; };
  await settle();
  for (const st of sq.steps) {
    if (st.wait != null) { const n = Math.max(1, Math.round(st.wait * 30)); for (let i = 0; i < n; i++) { T += st.wait / n; await page.evaluate(t => window.__lyaClock(t), T); } await settle(); }
    if (st.key) { await page.focus('#cv'); await page.keyboard.press(st.key); await settle(); }
    if (st.click) { await page.click(st.click); await settle(); }
    if (st.move) { await page.mouse.move(...await fig(st.move)); await settle(); }
    if (st.down) { await page.mouse.move(...await fig(st.down)); await page.mouse.down(); await settle(); }
    if (st.up) { await page.mouse.move(...await fig(st.up)); await page.mouse.up(); await settle(); }
    if (st.eval) { await page.evaluate(st.eval); await settle(); }
    if (st.shot) { await page.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur()); await settle(); await page.screenshot({ path: path.join(outdir, st.shot + '.png') }); }
  }
  await ctx.close();
}
await browser.close();
console.log(`captured ${spec.length} sequence(s) → ${outdir}; page errors: ${errs.length ? errs.slice(0, 6).join(' | ') : 'none'}`);
