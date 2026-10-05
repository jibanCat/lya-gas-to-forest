// Touch check: the major direct manipulations driven by real touch input (Chromium's touch pipeline via CDP, which the
// page receives as pointer events of type "touch"), on a touch-enabled context. Each case drags or taps, then reads the
// physical state back and checks it changed as it should. Writes a JSON report and one still per case.
// Usage: node app/touch.mjs <outDir>
import fs from 'node:fs'; import path from 'node:path'; import { execSync } from 'node:child_process'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
const here = path.dirname(new URL(import.meta.url).pathname), [outdir] = process.argv.slice(2);
fs.mkdirSync(outdir, { recursive: true });
const browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}), ctx = await browser.newContext({ viewport: { width: 1440, height: 880 }, hasTouch: true, deviceScaleFactor: 1 }), page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
const cdp = await ctx.newCDPSession(page);
const fig = async (x, y) => { const b = await page.$eval('#cv', el => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }); return [b.x + x / 1070 * b.w, b.y + y / 780 * b.h]; };
const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y]) => ({ x, y })) });
async function swipe([x0, y0], [x1, y1], steps = 12) { await touch('touchStart', [[x0, y0]]); for (let i = 1; i <= steps; i++) { await touch('touchMove', [[x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps]]); await page.waitForTimeout(16); } await touch('touchEnd', []); await page.waitForTimeout(120); }
async function tap(p) { await touch('touchStart', [p]); await page.waitForTimeout(40); await touch('touchEnd', []); await page.waitForTimeout(120); }
const state = () => page.evaluate(() => { const S = window.__lyaState(); return JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(S).filter(([k, v]) => typeof v !== 'object' || v === null)))); });
async function open(hash) { await page.goto('file://' + path.join(here, 'dist/lya.html') + '?' + Math.random() + '#' + hash); await page.waitForFunction(() => typeof window.__lyaState === 'function'); await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); }); await page.waitForTimeout(600); }
const cases = [];
async function check(name, fn, pass, detail) { const r = await fn(); const ok = pass(r); cases.push({ name, ok, ...detail(r) }); await page.screenshot({ path: path.join(outdir, `touch-${cases.length}.png`) }); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}  ${JSON.stringify(detail(r))}`); }
// Beat 5: drag the light
await open('beat=5&stage=1');
await check('Beat 5 · drag the light along its path', async () => { const a = await state(); await swipe(await fig(990, 74), await fig(700, 74), 16); return { a, b: await state() }; }, r => r.b._free > 0.5, r => ({ journey_before: r.a._free ?? 0, journey_after: +(r.b._free ?? 0).toFixed(2), z_now: +(r.b._zL ?? 0).toFixed(3) }));
// Beat 3: temperature on the margin ruler, then tap the census
await open('beat=3');
await page.evaluate(() => { document.querySelector('#next').click(); document.querySelector('#prev').click(); });
await check('Beat 3 · hold the gas with a finger (warmer)', async () => { const a = await state(); const p = await fig(600, 150); await touch('touchStart', [p]); await page.waitForTimeout(1600); await touch('touchEnd', []); await page.waitForTimeout(150); return { a, b: await state() }; }, r => r.b.T > r.a.T * 1.8, r => ({ T_before: r.a.T, T_after: Math.round(r.b.T) }));
await check('Beat 3 · hold and slide down (cooler)', async () => { const a = await state(); await swipe(await fig(600, 140), await fig(600, 240), 14); return { a, b: await state() }; }, r => r.b.T < r.a.T / 2, r => ({ T_before: Math.round(r.a.T), T_after: Math.round(r.b.T) }));
await check('Beat 3 · tap the census (atoms in a bin; tap again elsewhere clears)', async () => { await tap(await fig(640, 440)); return { b: await state() }; }, r => r.b._vb != null && r.b._vbPin === true, r => ({ bin: r.b._vb, pinned: r.b._vbPin }));
// Beat 7: the velocity arrow carries motion; the gas itself is selected, never pushed (in Beat 6 dragging the gas moves its place)
await open('beat=7');
await check('Beat 7 · drag parcel a’s gas (selects it; no velocity changes)', async () => { const a = await state(); const x = 90 + (1.93 + 0.45) / 5.3 * 950; await swipe(await fig(x, 150), await fig(x + 70, 150), 14); return { a, b: await state() }; }, r => r.b.pick === 'a' && r.b.va === r.a.va && r.b.vb === r.a.vb && r.b.vc === r.a.vc, r => ({ pick_after: r.b.pick, va: [r.a.va, r.b.va], vb: [r.a.vb, r.b.vb], vc: [r.a.vc, r.b.vc] }));
await check('Beat 7 · drag parcel b’s velocity arrow (only its v_pec)', async () => { const a = await state(); const tip = 90 + (3.18 + 0.45) / 5.3 * 950 + a.vb * 0.45; await swipe(await fig(tip - 2, 110), await fig(tip + 60, 110), 14); return { a, b: await state() }; }, r => r.b.vb > r.a.vb + 100 && r.b.va === r.a.va && r.b.vc === r.a.vc && r.b.pick === 'b', r => ({ vb_before: r.a.vb, vb_after: r.b.vb, pick_after: r.b.pick }));
await check('Beat 7 · tap velocity space (which gas lands there)', async () => { await tap(await fig(880, 420)); return { b: await state() }; }, r => r.b._uh != null && r.b._uhPin === true, r => ({ u_kms: Math.round(r.b._uh), pinned: r.b._uhPin }));
// Beat 10: the loupe
await open('beat=10');
await check('Beat 10 · drag the loupe along the ribbon', async () => { const a = await state(); await swipe(await fig(800, 235), await fig(300, 235), 14); return { a, b: await state() }; }, r => r.b.pu < r.a.pu - 100, r => ({ u_before: Math.round(r.a.pu), u_after: Math.round(r.b.pu) }));
await check('Beat 10 · drag along the spectrum (the loupe follows)', async () => { const a = await state(); await swipe(await fig(300, 600), await fig(600, 600), 10); return { a, b: await state() }; }, r => r.b.pu > r.a.pu + 50, r => ({ u_before: Math.round(r.a.pu), u_after: Math.round(r.b.pu) }));
// Beat 12: scan the spectrum after the first trace, then tap the gas
await open('beat=12');
await page.evaluate(() => sessionStorage.setItem('lya.b12.traced', '1')); await page.evaluate(() => { document.querySelector('#next').click(); document.querySelector('#prev').click(); }); await page.waitForTimeout(300);
await check('Beat 12 · scan the spectrum with a finger', async () => { const a = await state(); await swipe(await fig(588, 600), await fig(300, 560), 16); return { a, b: await state() }; }, r => Math.abs(r.b.pu - r.a.pu) > 200, r => ({ u_before: Math.round(r.a.pu), u_after: Math.round(r.b.pu) }));
await check('Beat 12 · tap the gas (where it absorbs)', async () => { await tap(await fig(560, 262)); return { b: await state() }; }, r => r.b._rx != null && r.b._rxPin === true, r => ({ x_mpch: +(r.b._rx ?? 0).toFixed(2), pinned: r.b._rxPin }));
// Beat 0: slide along the beam
await open('beat=0');
await check('Beat 0 · slide along the beam (the probe follows)', async () => { const a = await state(); await swipe(await fig(300, 208), await fig(600, 208), 14); return { a, b: await state() }; }, r => Math.abs(r.b.px - r.a.px) > 2, r => ({ px_before: +r.a.px.toFixed(2), px_after: +r.b.px.toFixed(2) }));
// Beat 2: push the atom
await open('beat=2');
await check('Beat 2 · push the atom (drag its motion)', async () => { const a = await state(); await swipe(await fig(363, 352), await fig(420, 352), 12); return { a, b: await state() }; }, r => r.b.v > r.a.v + 15, r => ({ v_before: r.a.v, v_after: r.b.v }));
// Beat 6: one parcel — move it, push it, hold it; each changes only its own variable
await open('beat=6');
await check('Beat 6 · move the gas along the beam (only its place)', async () => { const a = await state(); await swipe(await fig(740, 150), await fig(600, 152), 14); return { a, b: await state() }; }, r => r.b.x < r.a.x - 0.5 && r.b.v === r.a.v && r.b.T === r.a.T && r.b.logN === r.a.logN, r => ({ x_before: r.a.x, x_after: r.b.x, T: r.b.T }));
await check('Beat 6 · push its motion (only v_pec)', async () => { const a = await state(); const tip = 90 + (a.x + 0.45) / 5.3 * 950 + a.v * 0.45; await swipe(await fig(tip - 2, 104), await fig(tip - 42, 104), 12); return { a, b: await state() }; }, r => r.b.v < r.a.v - 50 && r.b.x === r.a.x && r.b.T === r.a.T, r => ({ v_before: r.a.v, v_after: r.b.v, x: r.b.x }));
await check('Beat 6 · hold the gas with a finger (only T)', async () => { const a = await state(); const p = await fig(90 + (a.x + 0.45) / 5.3 * 950, 150); await touch('touchStart', [p]); await page.waitForTimeout(1600); await touch('touchEnd', []); await page.waitForTimeout(150); return { a, b: await state() }; }, r => r.b.T > r.a.T * 1.5 && r.b.x === r.a.x && r.b.v === r.a.v, r => ({ T_before: r.a.T, T_after: r.b.T, x: r.b.x }));
// interruptions: a touch the system cancels mid-hold (a gesture, palm rejection) must end the hold; a drag released
// outside the figure must end cleanly (pointer capture); "previous"/"next" are whole-label touch targets
await open('beat=3');
await check('Beat 3 · a cancelled touch ends the hold (pointercancel)', async () => { const p = await fig(600, 150); await touch('touchStart', [p]); await page.waitForTimeout(900); await touch('touchCancel', []); const a = await state(); await page.waitForTimeout(1200); return { a, b: await state() }; }, r => r.b.T === r.a.T, r => ({ T_at_cancel: r.a.T, T_after_1_2s: r.b.T }));
await open('beat=6');
await check('Beat 6 · a drag released outside the figure ends cleanly', async () => { const a = await state(); const p0 = await fig(90 + (a.x + 0.45) / 5.3 * 950, 150); const cvLeft = await page.$eval('#cv', el => el.getBoundingClientRect().left); await swipe(p0, [cvLeft - 60, p0[1]], 14); await page.waitForTimeout(300); const b = await state(); await page.waitForTimeout(1200); return { a, b, c: await state() }; }, r => r.b.x !== r.a.x && r.c.T === r.b.T && r.c.x === r.b.x, r => ({ x_before: r.a.x, x_after: r.b.x, T_after: r.b.T, T_later: r.c.T }));
await check('Navigation · tap "next" (the whole label)', async () => { const b = await page.$eval('#next', el => { const r = el.getBoundingClientRect(); return [r.left + r.width * 0.8, r.top + r.height / 2]; }); await tap(b); return { tag: await page.evaluate(() => document.getElementById('mtag').textContent) }; }, r => /beat 7/.test(r.tag), r => ({ now: r.tag }));
await check('Navigation · tap just above "previous" (its invisible margin)', async () => { const b = await page.$eval('#prev', el => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top - 6]; }); await tap(b); return { tag: await page.evaluate(() => document.getElementById('mtag').textContent) }; }, r => /beat 6/.test(r.tag), r => ({ now: r.tag }));
await browser.close();
const rep = { generated_by: 'app/touch.mjs', input: 'CDP Input.dispatchTouchEvent (pointerType "touch")', cases, page_errors: errs, pass: cases.every(c => c.ok) && !errs.length };
fs.writeFileSync(path.join(outdir, 'touch-report.json'), JSON.stringify(rep, null, 1));
console.log(`touch: ${cases.filter(c => c.ok).length}/${cases.length} · page errors: ${errs.length ? errs.slice(0, 3) : 'none'}`);
process.exit(rep.pass ? 0 : 1);
