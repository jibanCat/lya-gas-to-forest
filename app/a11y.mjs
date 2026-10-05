// Accessibility and navigation check: the parts of the release audit a browser can verify.
// Targets (size and overlap of every margin and navigation target, including its invisible hit area) on a tablet;
// keyboard order, focus visibility, arrow keys that belong to a focused control, Escape; what a screen reader is given
// on each beat; reduced motion; browser zoom; the small-screen notice. Manual checks (real screen readers, real devices)
// are recorded separately — this file does not pretend to replace them.
// Usage: node app/a11y.mjs <outDir>      (exit 1 on a failure)
import fs from 'node:fs'; import path from 'node:path'; import { execSync } from 'node:child_process'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
const here = path.dirname(new URL(import.meta.url).pathname), [outdir] = process.argv.slice(2);
if (!outdir) throw new Error('usage: node app/a11y.mjs <outDir>');
fs.mkdirSync(outdir, { recursive: true });
const FILE = 'file://' + path.join(here, 'dist/lya.html'), N = 14, MIN = 24;   // WCAG 2.2 target size (minimum), CSS px
const R = { targets: {}, overlaps: [], keyboard: {}, semantics: [], reduced: [], zoom: {}, small: {}, fails: [] };
const fail = m => R.fails.push(m);
const browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});
const errs = [];
async function page(opts = {}) { const ctx = await browser.newContext({ viewport: { width: 1440, height: 880 }, deviceScaleFactor: 1, ...opts }), p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); return p; }
const open = (p, hash, extra = '') => p.goto(`${FILE}?${Math.random()}${extra}#${hash}`).then(() => p.waitForFunction(() => typeof window.__lyaState === 'function' && document.getElementById('mtitle').textContent));

// ---- 1 · targets: every margin and navigation target on a 1024 × 768 tablet, with its invisible hit area
const TARGETS = () => {
  const k = new DOMMatrix(getComputedStyle(document.getElementById('stage')).transform).a;
  const els = [...document.querySelectorAll('#topnav .bn, #topnav .bnav:not(.none), #advtoggle, #margin button, #margin [role=slider], #margin [role=radio]')].filter(e => e.getClientRects().length);
  return els.map(e => {
    const r = e.getBoundingClientRect(), a = getComputedStyle(e, '::after'); let [x0, y0, x1, y1] = [r.left, r.top, r.right, r.bottom];
    if (a.content && a.content !== 'none' && a.position === 'absolute') { const v = q => (isNaN(parseFloat(a[q])) ? 0 : parseFloat(a[q])) * k; x0 = Math.min(x0, r.left + v('left')); y0 = Math.min(y0, r.top + v('top')); x1 = Math.max(x1, r.right - v('right')); y1 = Math.max(y1, r.bottom - v('bottom')); }
    return { name: (e.getAttribute('aria-label') || e.textContent).trim().replace(/\s+/g, ' ').slice(0, 48), kind: e.id || e.className || e.getAttribute('role'), x0, y0, x1, y1, w: +(x1 - x0).toFixed(1), h: +(y1 - y0).toFixed(1) };
  });
};
R.targets1180 = {};
{ const q = await page({ viewport: { width: 1180, height: 820 }, hasTouch: true });   // a current iPad, landscape
  for (let n = 0; n < N; n++) { await open(q, `beat=${n}&shoot=1`); const T = await q.evaluate(TARGETS); R.targets1180[n] = T.map(({ name, kind, w, h }) => ({ name, kind, w, h }));
    for (const t of T) if (!/\bbn\b/.test(t.kind) && (t.w < MIN || t.h < MIN)) fail(`beat ${n} at 1180×820: "${t.name}" target ${t.w}×${t.h} CSS px < ${MIN}`); }
  await q.context().close(); }
{ const p = await page({ viewport: { width: 1024, height: 768 }, hasTouch: true });   // the smallest supported tablet
  for (let n = 0; n < N; n++) {
    await open(p, `beat=${n}&shoot=1`); const T = await p.evaluate(TARGETS); R.targets[n] = T.map(({ name, kind, w, h }) => ({ name, kind, w, h }));
    for (let i = 0; i < T.length; i++) for (let j = i + 1; j < T.length; j++) { const a = T[i], b = T[j], ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), oy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0); if (ox > 0.5 && oy > 0.5) R.overlaps.push({ beat: n, a: a.name, b: b.name, ox: +ox.toFixed(1), oy: +oy.toFixed(1) }); }
    for (const t of T) if (/previous|next beat|show the physics|sources/.test(t.name) && (t.w < MIN || t.h < MIN)) fail(`beat ${n}: "${t.name}" target ${t.w}×${t.h} CSS px < ${MIN}`);
  }
  if (R.overlaps.length) fail(`${R.overlaps.length} overlapping target pairs (first: beat ${R.overlaps[0].beat}, "${R.overlaps[0].a}" × "${R.overlaps[0].b}")`);
  await p.context().close(); }

// ---- 2 · keyboard: order, visible focus, arrows that belong to a control, Enter on navigation, Escape
{ const p = await page();
  const desc = () => p.evaluate(() => { const e = document.activeElement; if (!e || e === document.body) return { id: 'body', cls: '', role: null, name: '(the page)', outline: true }; const os = getComputedStyle(e); return { id: e.id, cls: e.className, role: e.getAttribute('role'), name: (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 40), outline: os.outlineStyle !== 'none' && parseFloat(os.outlineWidth) > 0 }; });
  for (const n of [0, 3, 6, 7, 12, 13]) {
    await open(p, `beat=${n}`); await p.evaluate(() => document.activeElement && document.activeElement.blur());
    const seq = []; for (let i = 0; i < 60; i++) { await p.keyboard.press('Tab'); const d = await desc(); if (d.id === 'body') break; seq.push(d); }   // one pass, up to the focus leaving the page
    const has = f => seq.some(f);
    R.keyboard[n] = { order: seq.map(d => d.id || d.role || d.cls.split(' ')[0]).join(' → '), unfocusedOutline: seq.filter(d => !d.outline && d.id !== 'cv').map(d => d.name) };
    if (!has(d => d.id === 'next') && n < 13) fail(`beat ${n}: "next" not reachable by Tab`);
    if (!has(d => d.id === 'cv')) fail(`beat ${n}: the figure is not reachable by Tab`);
    if (!has(d => /srclink/.test(d.cls))) fail(`beat ${n}: "sources & assumptions" not reachable by Tab`);
    if (R.keyboard[n].unfocusedOutline.length) fail(`beat ${n}: no visible focus on ${R.keyboard[n].unfocusedOutline.join(', ')}`);
  }
  // a focused control keeps its arrows; the figure keeps arrows it uses; Enter on "next" navigates
  await open(p, 'beat=6'); const beat = () => p.evaluate(() => document.getElementById('mtag').textContent);
  const N0 = await p.evaluate(() => window.__lyaState().logN); await p.focus('#margin [role=slider]'); await p.keyboard.press('ArrowRight');   // the neutral-amount instrument
  R.keyboard.sliderArrow = { beatAfter: await beat(), changed: (await p.evaluate(() => window.__lyaState().logN)) !== N0 };
  if (!/beat 6/.test(R.keyboard.sliderArrow.beatAfter) || !R.keyboard.sliderArrow.changed) fail('Beat 6: ArrowRight on the neutral-amount slider did not change it, or changed the beat');
  const x0 = await p.evaluate(() => window.__lyaState().x); await p.focus('#cv'); await p.keyboard.press('ArrowRight');
  R.keyboard.figureArrow = { beatAfter: await beat(), xChanged: (await p.evaluate(() => window.__lyaState().x)) !== x0 };
  if (!/beat 6/.test(R.keyboard.figureArrow.beatAfter) || !R.keyboard.figureArrow.xChanged) fail('Beat 6: ArrowRight on the figure did not move the parcel, or changed the beat');
  await p.focus('#next'); await p.keyboard.press('Enter'); R.keyboard.enterNext = await beat(); if (!/beat 7/.test(R.keyboard.enterNext)) fail('Enter on "next" did not go to Beat 7');
  await p.focus('#prev'); await p.keyboard.press(' '); R.keyboard.spacePrev = await beat(); if (!/beat 6/.test(R.keyboard.spacePrev)) fail('Space on "previous" did not go back to Beat 6');
  await open(p, 'beat=3'); await p.click('.srclink'); const srcOpen = await p.evaluate(() => !document.getElementById('srcp').classList.contains('hidden')); await p.keyboard.press('Escape');
  const srcClosed = await p.evaluate(() => document.getElementById('srcp').classList.contains('hidden'));
  await p.click('.whylink'); const microOpen = await p.evaluate(() => !document.getElementById('micro').classList.contains('hidden')); await p.keyboard.press('Escape');
  const microClosed = await p.evaluate(() => document.getElementById('micro').classList.contains('hidden'));
  R.keyboard.escape = { srcOpen, srcClosed, microOpen, microClosed }; if (!(srcOpen && srcClosed && microOpen && microClosed)) fail('Escape did not close the sources sheet or the microscope');
  await p.context().close(); }

// ---- 3 · what a screen reader is given on each beat
{ const p = await page();
  for (let n = 0; n < N; n++) {
    await open(p, `beat=${n}`);
    const s = await p.evaluate(() => {
      const nav = [...document.querySelectorAll('#topnav button')], cur = nav.find(b => b.getAttribute('aria-current')), cv = document.getElementById('cv'), live = document.getElementById('live').textContent.trim();
      return { title: document.getElementById('mtitle').textContent.trim(), h1: document.getElementById('mtitle').tagName, statement: document.getElementById('mtext').textContent.trim().length,
        live, cvRole: cv.getAttribute('role'), cvDesc: cv.getAttribute('aria-describedby'), current: cur && cur.getAttribute('aria-label'),
        numbered: nav.filter(b => b.classList.contains('bn')).every(b => /^beat \d+: \S/.test(b.getAttribute('aria-label'))), next: document.getElementById('next')?.getAttribute('aria-label') || null,
        sources: [...document.querySelectorAll('.srclink')].map(b => b.textContent.trim())[0] || null, ids: /\b(?:SCI|VAL|VT|INT)-[A-Z]/.test(live + document.getElementById('margin').textContent) };
    });
    R.semantics.push({ beat: n, ...s, live: s.live.slice(0, 160) });
    if (!s.title || s.h1 !== 'H1') fail(`beat ${n}: no h1 title`);
    if (s.live.length < 40) fail(`beat ${n}: the figure's description is missing or too short`);
    if (s.cvRole !== 'application' || s.cvDesc !== 'live') fail(`beat ${n}: the figure is not described for assistive technology`);
    if (!s.current || !s.current.startsWith(`beat ${n}:`)) fail(`beat ${n}: the current beat is not marked`);
    if (!s.numbered) fail(`beat ${n}: a beat number has no title in its accessible name`);
    if (n < 13 && !/^next beat — beat \d+: /.test(s.next || '')) fail(`beat ${n}: "next" has no meaningful name`);
    if (s.sources !== 'sources & assumptions') fail(`beat ${n}: no sources link`);
    if (s.ids) fail(`beat ${n}: provenance ids reach the reader`);
  }
  await p.context().close(); }

// ---- 4 · reduced motion: every beat renders; direct manipulation still works; no develop animation
{ const p = await page({ reducedMotion: 'reduce' });
  for (let n = 0; n < N; n++) { await open(p, `beat=${n}`); const r = await p.evaluate(() => ({ rm: matchMedia('(prefers-reduced-motion: reduce)').matches, anim: [...document.querySelectorAll('.dev')].some(e => getComputedStyle(e).animationName !== 'none'), live: document.getElementById('live').textContent.trim().length })); R.reduced.push({ beat: n, ...r }); if (!r.rm || r.anim || r.live < 40) fail(`beat ${n}: reduced motion — media ${r.rm}, animation ${r.anim}, description ${r.live}`); }
  await open(p, 'beat=3'); const T0 = await p.evaluate(() => window.__lyaState().T); const b = await p.$eval('#cv', el => { const r = el.getBoundingClientRect(); return { x: r.left + 600 / 1070 * r.width, y: r.top + 150 / 780 * r.height }; });
  await p.mouse.move(b.x, b.y); await p.mouse.down(); await p.waitForTimeout(1600); await p.mouse.up(); const T1 = await p.evaluate(() => window.__lyaState().T);
  R.reducedHold = { T0, T1 }; if (!(T1 > T0)) fail('reduced motion: holding the gas in Beat 3 no longer warms it');
  await p.context().close(); }

// ---- 5 · browser zoom enlarges the stage (it is not undone by fitting); the page then scrolls
{ const p = await page({ viewport: { width: 1440, height: 900 } }); await open(p, 'beat=6'); const cdp = await p.context().newCDPSession(p);
  const before = await p.evaluate(() => new DOMMatrix(getComputedStyle(document.getElementById('stage')).transform).a);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 720, height: 450, deviceScaleFactor: 2, mobile: false }); await p.evaluate(() => window.dispatchEvent(new Event('resize'))); await p.waitForTimeout(150);
  const after = await p.evaluate(() => ({ k: new DOMMatrix(getComputedStyle(document.getElementById('stage')).transform).a, scrollW: document.documentElement.scrollWidth, overflow: getComputedStyle(document.body).overflow }));
  R.zoom = { scaleAt100: before, scaleAt200: after.k, cssWidthAt200: 720, scrollWidth: after.scrollW, overflow: after.overflow };
  if (!(after.k > 0.9 * before) || after.scrollW < 1400) fail(`browser zoom 200%: stage scale ${after.k} (was ${before}); scroll width ${after.scrollW}`);
  await p.context().close(); }

// ---- 6 · small screens: a gentle notice, never a trap; tablets see none
{ for (const [name, vp] of [['phone portrait', { width: 390, height: 844 }], ['phone landscape', { width: 844, height: 390 }], ['tablet landscape', { width: 1024, height: 768 }]]) {
    const p = await page({ viewport: vp, hasTouch: true }); await open(p, 'beat=0');
    const shown = await p.evaluate(() => !!document.getElementById('small')); let after = null, again = null;
    if (shown) { await p.click('#smallgo'); after = await p.evaluate(() => !!document.getElementById('small')); await p.reload(); await p.waitForFunction(() => document.getElementById('mtitle').textContent); again = await p.evaluate(() => !!document.getElementById('small')); }
    R.small[name] = { shown, closedByContinue: after === false, notShownAgain: again === false };
    if (name.startsWith('phone') && !(shown && after === false && again === false)) fail(`${name}: the small-screen notice is missing or traps the reader`);
    if (name.startsWith('tablet') && shown) fail('tablet landscape: the small-screen notice appeared');
    await p.context().close(); } }

await browser.close();
if (errs.length) fail(`page errors: ${errs.slice(0, 3).join(' | ')}`);
fs.writeFileSync(path.join(outdir, 'a11y.json'), JSON.stringify(R, null, 1));
const tgt = Object.values(R.targets).flat(), small = tgt.filter(t => t.w < MIN || t.h < MIN);
console.log(`a11y: ${tgt.length} targets on 14 beats at 1024×768 (${small.length} under ${MIN} CSS px in a dimension), ${R.overlaps.length} overlaps; keyboard ${Object.keys(R.keyboard).length} checks; semantics 14 beats; reduced motion 14 beats; browser zoom 200% → ×${(2 * R.zoom.scaleAt200 / R.zoom.scaleAt100).toFixed(2)} on screen; ${R.fails.length} failures`);
for (const f of R.fails) console.log('  FAIL', f);
process.exit(R.fails.length ? 1 : 0);
