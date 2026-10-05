// Continuous reading: one stable place turns every page. From Beat 0 the pointer moves once to the centre of "next →"
// and clicks 13 times without moving — no waiting for reveals, no scrolling, no re-aiming, no scene interaction — and the
// beats must run 0 → 13 exactly; then once to "← previous", 13 clicks back to 0. The same with the keyboard (Enter on the
// focused control, 13 times each way) and with touch (13 taps at one point). Each run starts fresh, so every first-visit
// reveal is playing when the next click lands. Checks: the exact sequence, that "next →" and "← previous" never move (to
// the pixel), that no dialog, hold or selection is left behind, and no page errors. Viewports: desktop and tablet landscape.
// Usage: node app/continuous_navigation.mjs [out.json]      (PW_CHANNEL=chrome for installed Chrome)
import fs from 'node:fs'; import path from 'node:path'; import { execSync } from 'node:child_process'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
const here = path.dirname(new URL(import.meta.url).pathname), [out] = process.argv.slice(2), APP = 'file://' + path.join(here, 'dist/lya.html');
const browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});
const R = [], ok = (name, pass, detail = {}) => { R.push({ name, pass: !!pass, ...detail }); console.log(`${pass ? 'ok  ' : 'FAIL'} ${name}${pass ? '' : '  ' + JSON.stringify(detail).slice(0, 300)}`); };
const GAP = 120;   // ms between clicks: a quick reader, well inside every reveal
const VIEWPORTS = [['desktop 1440×880', { width: 1440, height: 880 }], ['tablet landscape 1180×820', { width: 1180, height: 820 }], ['tablet landscape 1024×768', { width: 1024, height: 768 }]];
const beatOf = p => p.evaluate(() => +(document.getElementById('mtag').textContent.match(/beat (\d+)/) || [])[1]);
const box = (p, id) => p.evaluate(i => { const r = document.getElementById(i).getBoundingClientRect(); return [r.left, r.top, r.width, r.height].map(v => Math.round(v * 100) / 100); }, id);
const clean = p => p.evaluate(() => ({ micro: !document.getElementById('micro').classList.contains('hidden'), sources: !document.getElementById('srcp').classList.contains('hidden'),
  python: !document.getElementById('pyp').classList.contains('hidden'), selection: String(getSelection()), hash: location.hash.match(/beat=(\d+)/)[1] }));
async function fresh(ctxOpts) {
  const ctx = await browser.newContext(ctxOpts), p = await ctx.newPage(), errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(APP + '?n=' + Math.random() + '#beat=0'); await p.waitForFunction(() => document.getElementById('mtitle') && document.getElementById('mtitle').textContent.length > 0);
  return { ctx, p, errs };
}
for (const [vname, vp] of VIEWPORTS) {
  // pointer: one position, 13 clicks each way
  { const { ctx, p, errs } = await fresh({ viewport: vp });
    const nb0 = await box(p, 'next'), seq = [await beatOf(p)], moved = [];
    await p.mouse.move(nb0[0] + nb0[2] / 2, nb0[1] + nb0[3] / 2);
    for (let i = 0; i < 13; i++) { await p.mouse.down(); await p.mouse.up(); await p.waitForTimeout(GAP); seq.push(await beatOf(p)); const b = await box(p, 'next'); if (i < 12 && b.join() !== nb0.join()) moved.push([i + 1, b]); }
    ok(`${vname}: Beat 0 → Beat 13 with 13 clicks at one fixed pointer location`, seq.join() === [...Array(14).keys()].join(), { seq });
    ok(`${vname}: "next →" never moves (0 → 12)`, !moved.length, { first: nb0, moved: moved.slice(0, 3) });
    const st = await clean(p); ok(`${vname}: arrived clean at Beat 13 (no dialog, no selection, address #beat=13)`, !st.micro && !st.sources && !st.python && !st.selection && st.hash === '13', st);
    const pb0 = await box(p, 'prev'), back = [await beatOf(p)], pmoved = [];
    await p.mouse.move(pb0[0] + pb0[2] / 2, pb0[1] + pb0[3] / 2);
    for (let i = 0; i < 13; i++) { await p.mouse.down(); await p.mouse.up(); await p.waitForTimeout(GAP); back.push(await beatOf(p)); const b = await box(p, 'prev'); if (i < 12 && b.join() !== pb0.join()) pmoved.push([i + 1, b]); }
    ok(`${vname}: Beat 13 → Beat 0 with 13 clicks at one fixed pointer location`, back.join() === [...Array(14).keys()].reverse().join(), { back });
    ok(`${vname}: "← previous" never moves (13 → 1)`, !pmoved.length, { first: pb0, moved: pmoved.slice(0, 3) });
    // the target on screen: the label plus its invisible margin, at the stage's scale (the page fits the stage to the window)
    const hit = await p.evaluate(() => ['prev', 'next'].map(id => { const el = document.getElementById(id); if (!el || el.tagName !== 'BUTTON') return null; const r = el.getBoundingClientRect(), s = r.width / el.offsetWidth, a = getComputedStyle(el, '::after');
      return { id, w: Math.round((el.offsetWidth - parseFloat(a.left) - parseFloat(a.right)) * s), h: Math.round((el.offsetHeight - parseFloat(a.top) - parseFloat(a.bottom)) * s) }; }).filter(Boolean));
    const need = vp.width >= 1180 ? 44 : 36;   // ~44 px where the layout allows; a 1024-px tablet scales the whole stage down
    ok(`${vname}: "next →" and "← previous" targets on screen ≥ ${need} px (with their invisible margins)`, hit.every(h => h.w >= need && h.h >= need), { hit });
    ok(`${vname}: no page errors while turning pages during reveals`, !errs.length, { errs: errs.slice(0, 3) });
    await ctx.close(); }
  // keyboard: Enter on the focused control, 13 times each way; focus stays on the control from page to page
  { const { ctx, p, errs } = await fresh({ viewport: vp });
    await p.focus('#next'); const seq = [await beatOf(p)];
    for (let i = 0; i < 13; i++) { await p.keyboard.press('Enter'); await p.waitForTimeout(GAP); seq.push(await beatOf(p)); }
    const f13 = await p.evaluate(() => document.activeElement.id), back = [await beatOf(p)];
    for (let i = 0; i < 13; i++) { await p.keyboard.press('Enter'); await p.waitForTimeout(GAP); back.push(await beatOf(p)); }
    ok(`${vname}: keyboard — Enter ×13 reads 0 → 13, then (focus on "previous") Enter ×13 reads 13 → 0`, seq.join() === [...Array(14).keys()].join() && f13 === 'prev' && back.join() === [...Array(14).keys()].reverse().join(), { seq, focusAt13: f13, back });
    ok(`${vname}: keyboard — no page errors`, !errs.length, { errs: errs.slice(0, 3) });
    await ctx.close(); }
}
// touch: a tablet, 13 taps at one point each way
{ const { ctx, p, errs } = await fresh({ viewport: { width: 1180, height: 820 }, hasTouch: true, isMobile: false });
  const nb = await box(p, 'next'), seq = [await beatOf(p)];
  for (let i = 0; i < 13; i++) { await p.touchscreen.tap(nb[0] + nb[2] / 2, nb[1] + nb[3] / 2); await p.waitForTimeout(GAP); seq.push(await beatOf(p)); }
  const pb = await box(p, 'prev'), back = [await beatOf(p)];
  for (let i = 0; i < 13; i++) { await p.touchscreen.tap(pb[0] + pb[2] / 2, pb[1] + pb[3] / 2); await p.waitForTimeout(GAP); back.push(await beatOf(p)); }
  const st = await clean(p);
  ok('touch (tablet 1180×820): 13 taps at one point read 0 → 13, and 13 taps read 13 → 0', seq.join() === [...Array(14).keys()].join() && back.join() === [...Array(14).keys()].reverse().join(), { seq, back });
  ok('touch: nothing selected, no dialog left open, no page errors', !st.selection && !st.micro && !st.sources && !st.python && !errs.length, { ...st, errs: errs.slice(0, 3) });
  ok('touch: the navigation suppresses double-tap zoom and text selection', await p.evaluate(() => { const s = getComputedStyle(document.getElementById('next')); return s.touchAction === 'manipulation' && s.userSelect === 'none'; }));
  await ctx.close(); }
await browser.close();
if (out) fs.writeFileSync(out, JSON.stringify({ generated_by: 'app/continuous_navigation.mjs', channel: process.env.PW_CHANNEL || 'chromium', results: R }, null, 1));
console.log(`continuous navigation: ${R.filter(x => x.pass).length}/${R.length}`);
process.exit(R.every(x => x.pass) ? 0 : 1);
