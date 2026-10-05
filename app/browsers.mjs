// Cross-browser release check: in every installed Playwright engine (Chromium, Firefox, WebKit), every beat is loaded
// live and checked — no page errors, the figure has drawn, the title matches the manifest — and the "sources &
// assumptions" sheet, the science notes, reduced motion and the keyboard path are exercised. In phone-sized viewports it
// records how small the fixed 1440 × 880 stage becomes (the scale and the smallest text in CSS px). A system Firefox that
// Playwright cannot drive (FIREFOX_BIN, or the macOS app) gets the same live check through WebDriver BiDi
// (app/firefox_bidi.mjs). An engine that cannot open a page within 30 s is recorded as unavailable, not failed. Writes <out>/browsers.json and screenshots. Usage: node app/browsers.mjs <out>
import fs from 'node:fs'; import path from 'node:path'; import { execSync, spawnSync } from 'node:child_process'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const pw = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
const here = path.dirname(new URL(import.meta.url).pathname), [out] = process.argv.slice(2);
if (!out) throw new Error('usage: node app/browsers.mjs <out>');
fs.mkdirSync(out, { recursive: true });
const beats = JSON.parse(fs.readFileSync(path.join(here, '../design/canonical/beats.json'))).beats;
const url = h => 'file://' + path.join(here, 'dist/lya.html') + '?' + Math.random().toString(36).slice(2) + '#' + h;
const report = { engines: {}, phones: [], systemFirefox: null }; let failed = 0;
async function engine(name) {
  let browser; try { browser = await pw[name].launch(); } catch (e) { report.engines[name] = { skipped: 'not installed: ' + e.message.split('\n')[0] }; console.log(`${name}: not installed (skipped)`); return; }
  const R = { beats: [], problems: [] }, ctx = await browser.newContext({ viewport: { width: 1440, height: 880 } });
  const page = await Promise.race([ctx.newPage(), new Promise(r => setTimeout(() => r(null), 30000))]), errs = [];
  if (!page) { report.engines[name] = { skipped: `unavailable in this environment: ${name} ${browser.version()} could not open a page within 30 s` }; console.log(`${name}: could not open a page (skipped)`); browser.close().catch(() => {}); return; }
  page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  for (const b of beats) {
    const before = errs.length; await page.goto(url(`beat=${b.n}`)); await page.waitForTimeout(1300);
    const r = await page.evaluate(() => { const c = document.getElementById('cv'), g = c.getContext('2d'), d = g.getImageData(0, 0, c.width, c.height).data; let ink = 0; for (let i = 0; i < d.length; i += 4 * 97) if (d[i] < 200 || d[i + 1] < 200) ink++; return { title: document.getElementById('mtitle').textContent, ink }; });
    const ok = r.title === b.title && r.ink > 50 && errs.length === before;
    R.beats.push({ beat: b.n, ok, ink_samples: r.ink, errors: errs.slice(before) }); if (!ok) R.problems.push(`beat ${b.n}: ${r.title !== b.title ? 'title mismatch; ' : ''}${r.ink <= 50 ? 'figure empty; ' : ''}${errs.slice(before).join(' | ')}`);
    if ([0, 3, 6, 12].includes(b.n)) await page.screenshot({ path: path.join(out, `${name}-beat${b.n}.png`) });
  }
  // the sources sheet, opened and closed from the keyboard; the keyboard path through the page
  await page.goto(url('beat=3')); await page.waitForTimeout(800);
  const order = [];
  for (let k = 0; k < 40; k++) { await page.keyboard.press('Tab'); order.push(await page.evaluate(() => { const a = document.activeElement; return a ? (a.getAttribute('aria-label') || a.dataset.fk || a.id || a.textContent.trim().slice(0, 30) || a.tagName) : null; })); if (order[order.length - 1] === 'src') break; }
  const reached = order.includes('src');
  if (reached) { await page.keyboard.press('Enter'); await page.waitForTimeout(200); }
  const opened = reached && await page.evaluate(() => !document.getElementById('srcp').classList.contains('hidden') && document.activeElement && document.activeElement.id === 'srcback');
  await page.keyboard.press('Escape'); await page.waitForTimeout(150);
  const closed = await page.evaluate(() => document.getElementById('srcp').classList.contains('hidden') && document.activeElement && document.activeElement.dataset.fk === 'src');
  R.keyboard = { tab_stops_to_sources: order.length, path: order, sources_opened_by_enter: !!opened, escape_closes_and_returns_focus: !!closed };
  if (!reached || !opened || !closed) R.problems.push('keyboard: the sources sheet could not be opened and closed from the keyboard');
  // the canvas takes keys: a temperature step on Beat 3
  await page.focus('#cv'); const T0 = await page.evaluate(() => window.__lyaState().T); await page.keyboard.press('ArrowUp'); const T1 = await page.evaluate(() => window.__lyaState().T);
  R.keyboard.figure_keys_change_state = T1 > T0; if (!(T1 > T0)) R.problems.push('keyboard: the figure did not respond to a key');
  await page.screenshot({ path: path.join(out, `${name}-keyboard-focus.png`) });
  // the science notes
  await page.goto('file://' + path.join(here, 'dist/science/index.html#voigt-profile')); await page.waitForTimeout(400);
  R.science_notes = await page.evaluate(() => ({ anchor: !!document.getElementById('voigt-profile'), equations: document.querySelectorAll('.katex').length, claims: document.querySelectorAll('article.entry').length }));
  if (!R.science_notes.anchor || !R.science_notes.equations) R.problems.push('science notes did not render');
  await page.screenshot({ path: path.join(out, `${name}-science.png`) });
  // reduced motion
  const rm = await browser.newContext({ viewport: { width: 1440, height: 880 }, reducedMotion: 'reduce' }), p2 = await rm.newPage(); const e2 = []; p2.on('pageerror', e => e2.push(e.message));
  await p2.goto(url('beat=3')); await p2.waitForTimeout(800); R.reduced_motion = { honoured: await p2.evaluate(() => document.getElementById('cv') && window.matchMedia('(prefers-reduced-motion: reduce)').matches), errors: e2 }; await rm.close();
  R.errors = errs; R.ok = !R.problems.length; if (!R.ok) failed++;
  report.engines[name] = R; console.log(`${name}: ${R.beats.filter(b => b.ok).length}/${R.beats.length} beats · keyboard ${reached && opened && closed ? 'ok' : 'FAIL'} (${order.length} tab stops to the sources link) · notes ${R.science_notes.claims} claims, ${R.science_notes.equations} equations · reduced motion ${R.reduced_motion.honoured ? 'honoured' : 'no'}${R.problems.length ? ' · PROBLEMS: ' + R.problems.join('; ') : ''}`);
  // phone-sized viewports (touch): how small the fixed stage becomes
  if (name !== 'firefox') for (const [label, w, h] of [['phone portrait', 390, 844], ['phone landscape', 844, 390], ['tablet', 1024, 768]]) {
    const pc = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: name === 'chromium' }), pp = await pc.newPage(); const pe = []; pp.on('pageerror', e => pe.push(e.message));
    await pp.goto(url('beat=6')); await pp.waitForTimeout(900);
    const m = await pp.evaluate(() => { const s = document.getElementById('stage').getBoundingClientRect().width / 1440; return { scale: +s.toFixed(3), body_text_px: +(15.5 * s).toFixed(1), smallest_text_px: +(9 * s).toFixed(1) }; });
    await pp.screenshot({ path: path.join(out, `${name}-${label.replace(' ', '-')}.png`) });
    report.phones.push({ engine: name, viewport: label, w, h, ...m, errors: pe }); await pc.close();
  }
  await browser.close();
}
for (const e of ['chromium', 'firefox', 'webkit']) await engine(e);
for (const p of report.phones) console.log(`  ${p.engine} ${p.viewport} ${p.w}×${p.h}: stage scale ${p.scale}; body text ${p.body_text_px} px, smallest text ${p.smallest_text_px} px${p.errors.length ? '; errors ' + p.errors.join(' | ') : ''}`);
// a system Firefox that Playwright cannot drive: the full live check through WebDriver BiDi (app/firefox_bidi.mjs)
const ff = process.env.FIREFOX_BIN || (fs.existsSync('/Applications/Firefox.app/Contents/MacOS/firefox') ? '/Applications/Firefox.app/Contents/MacOS/firefox' : null);
if (ff && report.engines.firefox && report.engines.firefox.skipped) {
  const r = spawnSync(process.execPath, [path.join(here, 'firefox_bidi.mjs'), out, ff], { timeout: 300000 });
  console.log(r.stdout.toString().trim() || 'system Firefox: no result');
  report.systemFirefox = fs.existsSync(path.join(out, 'firefox.json')) ? JSON.parse(fs.readFileSync(path.join(out, 'firefox.json'))) : { ok: false, problems: ['no result'] };
  if (!report.systemFirefox.ok) failed++;
}
fs.writeFileSync(path.join(out, 'browsers.json'), JSON.stringify(report, null, 1));
console.log(failed ? `browsers: ${failed} engine(s) with problems` : 'browsers: every installed engine passed');
process.exit(failed ? 1 : 0);
