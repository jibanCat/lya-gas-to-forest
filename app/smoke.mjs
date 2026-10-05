// Production smoke test: every beat in live mode — pointer sweep, every margin control, the figure's keyboard, the
// microscopes (exact return), "show the physics", the probes, and a reduced-motion pass. Fails on any console error and
// on any text drawn in a non-text colour (design guard, design/VISUAL_LANGUAGE.md §10). Also runs the scenes' pixel checks
// (window.__lyaChecks: the picture performs its claim) and writes science/validation/render/report.json (VAL-REND-001).
// Usage: node app/smoke.mjs
import fs from 'node:fs'; import path from 'node:path'; import { execSync } from 'node:child_process'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
const here = path.dirname(new URL(import.meta.url).pathname), url = 'file://' + path.join(here, 'dist/lya.html');
const b = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}), errs = [];
async function run(page, label) {
  page.on('pageerror', e => errs.push(`${label}: ${e.message}`)); page.on('console', m => { if (m.type() === 'error') errs.push(`${label}: ${m.text()}`); });
  await page.goto(url); await page.waitForTimeout(1500);
  const cv = await page.$('#cv'), box = await cv.boundingBox(), n = await page.evaluate(() => document.querySelectorAll('#topnav .bn').length);
  for (let k = 0; k < n; k++) {
    await page.click(`#topnav .bn[data-k="${k}"]`); await page.waitForTimeout(250);
    for (const fx of [0.2, 0.5, 0.8]) for (const fy of [0.15, 0.5, 0.8]) await page.mouse.move(box.x + box.width * fx, box.y + box.height * fy);
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.12); await page.mouse.down(); await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.12, { steps: 4 }); await page.mouse.up();
    await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.7); await page.mouse.down(); await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.7, { steps: 4 }); await page.mouse.up();   // click / drag in the lower figure (Beat 12 traces a colour)
    for (const sel of ['.tog', '.cho', '.btn']) { const els = await page.$$('#ctrl ' + sel); for (const e of els) { await e.click().catch(() => {}); await page.waitForTimeout(60); } }
    const ruls = await page.$$('#ctrl .rul'); for (const r of ruls) { await r.focus(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('End'); await page.keyboard.press('Home'); }
    await cv.focus(); for (const key of ['ArrowRight', 'ArrowLeft', 'ArrowUp', ']', '[', '1', '2', '3', '4', 'a', 'w', 'Enter', ' ']) await page.keyboard.press(key);
    await page.keyboard.press('p'); await page.waitForTimeout(120); await page.keyboard.press('p');
    const whys = await page.$$('.whylink');
    for (let i = 0; i < whys.length; i++) {
      const before = await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(App_state()).filter(([k]) => !k.startsWith('_')))));
      await (await page.$$('.whylink'))[i].click(); await page.waitForTimeout(250); await page.keyboard.press('Escape'); await page.waitForTimeout(120);
      const after = await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(App_state()).filter(([k]) => !k.startsWith('_')))));
      if (before !== after) errs.push(`${label} beat ${k}: microscope return was not exact`);
    }
  }
}
// expose state for the exact-return check without widening the app's API: read it through the hash-writer's view
const ctx1 = await b.newContext({ viewport: { width: 1440, height: 880 } }); await ctx1.addInitScript(() => { window.App_state = () => window.__lyaState ? window.__lyaState() : {}; });
const p1 = await ctx1.newPage(); await run(p1, 'motion');
const lint = await p1.evaluate(() => window.__lyaLint ? window.__lyaLint() : []);
const fps = {}; for (const k of [0, 1, 5, 7, 10, 13]) { await p1.click(`#topnav .bn[data-k="${k}"]`); await p1.waitForTimeout(300); fps[k] = await p1.evaluate(async () => { let n = 0; const t0 = performance.now(); await new Promise(r => { const f = () => { n++; if (performance.now() - t0 < 1500) requestAnimationFrame(f); else r(); }; requestAnimationFrame(f); }); return Math.round(n / 1.5); }); }
// probes run end to end
await p1.goto(url + '?probe#probe=all'); await p1.waitForTimeout(1500);
for (let q = 0; q < 5; q++) { const opt = await p1.$('#probe .popt'); if (opt) await opt.click(); else { const box = await (await p1.$('#cv')).boundingBox(); await p1.mouse.click(box.x + 0.15 * box.width, box.y + 0.6 * box.height); } await p1.waitForTimeout(150); const rv = await p1.$('#preveal'); if (rv) await rv.click(); await p1.waitForTimeout(150); const nx = await p1.$('#pnext'); if (nx) await nx.click(); await p1.waitForTimeout(300); }
const probeDone = await p1.evaluate(() => !!document.querySelector('#psave'));
// probes 3–4 by hand: grab a shadow and squeeze it back to where it belongs; squeeze into the quasar's frame (it stops there)
const squeeze = {};
for (const [id, from, to] of [['absorber-frame', 876, 309], ['quasar-frame', 930, 100]]) {
  await p1.goto(url + '?sq-' + id + '#probe=' + id); await p1.waitForTimeout(1200);
  const bx = await (await p1.$('#cv')).boundingBox(), X = x => bx.x + x / 1070 * bx.width, Y = bx.y + 330 / 780 * bx.height;
  await p1.mouse.move(X(from), Y); await p1.mouse.down(); await p1.mouse.move(X(to), Y, { steps: 12 }); await p1.mouse.up(); await p1.waitForTimeout(150);
  squeeze[id] = await p1.evaluate(() => ({ D: window.__lyaState()._Dsq, answer: ([...document.querySelectorAll('#probe .pa')].map(e => e.textContent).find(t => t.includes('your answer')) || '') }));
}
const squeezeOK = Math.abs(squeeze['quasar-frame'].D - 1) < 1e-9 && /your answer: 1 2[0-5]\d Å/.test(squeeze['absorber-frame'].answer);
if (!squeezeOK) errs.push('probe squeeze: ' + JSON.stringify(squeeze));
// the pictures that perform their claims (VAL-REND-001)
await p1.goto(url + '?checks#beat=10'); await p1.waitForTimeout(1200);
const checks = await p1.evaluate(() => window.__lyaChecks());
const rendRep = { generated_by: 'app/smoke.mjs (window.__lyaChecks)', checks, pass: checks.length > 0 && checks.every(c => c.pass) };
fs.mkdirSync(path.join(here, '../science/validation/render'), { recursive: true });
fs.writeFileSync(path.join(here, '../science/validation/render/report.json'), JSON.stringify(rendRep, null, 1));
if (!rendRep.pass) errs.push('scene checks failed: ' + JSON.stringify(checks));
// Beat 6 prints the line it draws: the margin's width and peak are the ones VAL-ORTH-001 measured on the drawn
// profile, and a pointer gesture leaves the printed state current (not the state before the gesture)
const orth = JSON.parse(fs.readFileSync(path.join(here, '../science/validation/orthogonality/report.json'), 'utf8')).base;
await p1.goto(url + '?b6#beat=6&adv=1'); await p1.waitForTimeout(2600);
const b6eq = () => p1.evaluate(() => document.getElementById('eqs').innerText);
const e0 = await b6eq(), want = `heat alone b = ${orth.b_thermal_kms.toFixed(1)} km/s · its size (the Hubble flow across it) ${orth.b_size_kms.toFixed(1)} km/s · together, the drawn line: b = ${orth.b_drawn_kms.toFixed(1)} km/s, peak τ = ${orth.peak_tau_drawn.toFixed(2)}`;
if (!e0.includes(want)) errs.push(`Beat 6 width line: expected “${want}”, shows ${e0.split('\n').find(l => l.startsWith('its width')) || 'nothing'}`);
{ const bx = await (await p1.$('#cv')).boundingBox(), X = x => bx.x + x / 1070 * bx.width, Y = y => bx.y + y / 780 * bx.height;
  await p1.mouse.move(X(740.7), Y(150)); await p1.mouse.down(); await p1.mouse.move(X(600), Y(151), { steps: 12 }); await p1.mouse.up(); await p1.waitForTimeout(200);
  const x = await p1.evaluate(() => window.__lyaState().x), e1 = await b6eq(), u = Math.round(orth.hub_kms_per_mpch * x);
  if (!e1.includes(`now: u = ${u} `)) errs.push(`Beat 6: after moving the gas to x = ${x} the margin still shows ${e1.split('\n').find(l => l.startsWith('now')) || 'nothing'}`); }
// reduced motion
const ctx2 = await b.newContext({ viewport: { width: 1440, height: 880 }, reducedMotion: 'reduce' }); await ctx2.addInitScript(() => { window.App_state = () => window.__lyaState ? window.__lyaState() : {}; });
await run(await ctx2.newPage(), 'reduced-motion');
await b.close();
console.log('design guard (text in non-text colours):', lint.length ? lint : 'none');
console.log('probes ran end to end:', probeDone, '· squeeze (probes 3–4):', squeezeOK ? 'ok' : 'FAILED');
console.log('scene checks:', checks.map(c => `beat ${c.beat} ${c.name}: ${c.pass ? 'pass' : 'FAIL'} (max |ΔT| ${c.max_abs_dT.toExponential(1)} ≤ ${c.quantisation_bound.toExponential(1)})`).join('; '));
console.log('frame rate by beat (headless):', JSON.stringify(fps));
console.log('errors:', errs.length ? errs.slice(0, 12) : 'none');
process.exit(errs.length || lint.length || !probeDone ? 1 : 0);
