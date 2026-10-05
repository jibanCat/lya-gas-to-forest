// The guided tour (the slideshow): every beat's slides, in order, by tapping one empty place — and the rules that keep
// it honest. A slide either takes a step of its beat or acts out one variation with the beat's own state and physics.
// Checks:
//   1. one fixed empty point, tapped at a reader's pace, plays every slide of every beat in order (0 → 13) and ends at
//      "the end of the story"; the same with taps 150 ms apart (no waiting for animations) and with reduced motion;
//   2. every slide has a caption that fits its line, and the cue says which slide this is;
//   3. every value a slide animates ends inside its declared range — the interaction's domain (BEATS.yaml, `int`) or
//      the control's own range (`key`) — and every `int` names an interaction of that beat;
//   4. a tap on an object of the scene does its own job and never turns the page; a reader's gesture stops a playing
//      slide where it is; "continue ›" is a target itself;
//   5. no page errors.
// The reader's-pace walk runs on the app's virtual clock (window.__lyaClock), so each slide's animation is finished at
// once and every slide's end state is checked. Usage: node app/tour_check.mjs [out.json]   (PW_CHANNEL=chrome for Chrome)
import fs from 'node:fs'; import path from 'node:path'; import { execSync } from 'node:child_process'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
const here = path.dirname(new URL(import.meta.url).pathname), [out] = process.argv.slice(2), APP = 'file://' + path.join(here, 'dist/lya.html');
const BEATS = JSON.parse(fs.readFileSync(path.join(here, '../design/canonical/beats.json'))).beats;
const INTS = Object.fromEntries(BEATS.map(b => [b.n, Object.fromEntries((b.interactions || []).map(i => [i.id, i]))]));
const browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});
const R = [], ok = (name, pass, detail = {}) => { R.push({ name, pass: !!pass, ...detail }); console.log(`${pass ? 'ok  ' : 'FAIL'} ${name}${pass ? '' : '  ' + JSON.stringify(detail).slice(0, 400)}`); };
const VP = { width: 1180, height: 820 };   // a tablet in landscape: the tour's main audience
async function fresh(opts = {}, virtual = false) {
  const ctx = await browser.newContext({ viewport: VP, hasTouch: true, ...opts }), p = await ctx.newPage(), errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  if (virtual) await p.addInitScript(() => { window.__lyaVirtualClock = true; });
  await p.goto(APP + '?t=' + Math.random() + '#beat=0'); await p.waitForFunction(() => document.getElementById('mtitle') && document.getElementById('mtitle').textContent.length > 0);
  const pt = await p.evaluate(() => { const r = document.getElementById('stage').getBoundingClientRect(), s = r.width / 1440; return [r.left + 700 * s, r.top + 866 * s]; });   // empty paper above the footer, on every beat
  return { ctx, p, errs, pt };
}
const where = p => p.evaluate(() => {
  const n = +(document.getElementById('mtag').textContent.match(/beat (\d+)/) || [])[1], t = window.__lyaTour(), say = document.getElementById('tsay'), go = document.getElementById('tgo').textContent;
  return { n, i: t ? t.i : -1, len: t ? t.n : 0, int: t && t.int, key: t && t.key, keys: t ? t.keys : [], playing: t && t.playing, say: say.textContent, fits: say.scrollWidth <= say.clientWidth + 1, go, S: window.__lyaState() };
});
const frames = p => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

// 1–3. the reader's pace, on the virtual clock: every slide, its caption, its end state
{ const { ctx, p, errs, pt } = await fresh({}, true);
  const seen = [], bad = { caption: [], cue: [], range: [], int: [] }; let clock = 0, w = await where(p);
  for (let k = 0; k < 120; k++) {
    seen.push([w.n, w.i, w.len]);
    if (!w.say.trim() || !w.fits) bad.caption.push({ beat: w.n, slide: w.i + 1, say: w.say });
    if (!new RegExp(`^${w.i + 1} / ${w.len} · `).test(w.go)) bad.cue.push({ beat: w.n, slide: w.i + 1, go: w.go });
    if (w.int && !INTS[w.n][w.int]) bad.int.push({ beat: w.n, slide: w.i + 1, int: w.int });
    for (const key of w.keys) {   // the value this slide moved, inside its declared range
      let dom = w.int && INTS[w.n][w.int] && INTS[w.n][w.int].domain;
      if (!dom) dom = await p.evaluate(k2 => { const r = document.querySelector(`[aria-labelledby="rl-${k2}"]`); return r ? [+r.getAttribute('aria-valuemin'), +r.getAttribute('aria-valuemax')] : null; }, key);
      const v = w.S[key];
      if (dom && !(v >= dom[0] - 1e-9 && v <= dom[1] + 1e-9)) bad.range.push({ beat: w.n, slide: w.i + 1, key, v, dom });
      if (!dom && w.int) R.push({ name: `beat ${w.n} slide ${w.i + 1}: ${key} (${w.int} declares no numeric domain)`, pass: true, note: 'inspection coordinate' });
    }
    if (/the end of the story/.test(w.go)) break;
    await p.touchscreen.tap(...pt); clock += 8; await p.evaluate(t => window.__lyaClock(t), clock); await frames(p); await frames(p);
    w = await where(p);
  }
  const lens = {}; for (const [n, , len] of seen) lens[n] = len;
  const want = BEATS.flatMap(b => Array.from({ length: lens[b.n] || 0 }, (_, i) => `${b.n}:${i}`)).join(' ');
  ok(`reader's pace: one empty place, tapped ${seen.length - 1} times, plays all ${seen.length} slides of the 14 beats in order and ends at "the end of the story"`, seen.map(([n, i]) => `${n}:${i}`).join(' ') === want && Object.keys(lens).length === 14 && /the end/.test(w.go), { seen: seen.map(([n, i]) => `${n}:${i}`).join(' ').slice(0, 300) });
  ok('every beat has a tour; every slide has a caption that fits its line', Object.values(lens).every(x => x >= 2) && !bad.caption.length, { lens, bad: bad.caption.slice(0, 3) });
  ok('the cue says which slide this is ("i / n · …")', !bad.cue.length, { bad: bad.cue.slice(0, 3) });
  ok('every slide that names an interaction names one of its own beat', !bad.int.length, { bad: bad.int });
  ok('every value a slide moves ends inside its declared range (the interaction’s domain or the control’s own)', !bad.range.length, { bad: bad.range.slice(0, 5) });
  ok('reader’s pace: no page errors', !errs.length, { errs: errs.slice(0, 3) });
  await ctx.close(); }

// 1. no waiting: taps 150 ms apart, during every animation; and with reduced motion
for (const [label, opts] of [['taps 150 ms apart (no waiting for animations)', {}], ['reduced motion', { reducedMotion: 'reduce' }]]) {
  const { ctx, p, errs, pt } = await fresh(opts); const seq = []; let w = await where(p), taps = 0;
  while (!/the end of the story/.test(w.go) && taps < 120) { await p.touchscreen.tap(...pt); taps++; await p.waitForTimeout(150); w = await where(p); seq.push(w.n * 100 + w.i); }
  ok(`${label}: the whole tour, beat 0 → 13, in ${taps} taps, never going back`, /the end/.test(w.go) && w.n === 13 && seq.every((x, k) => !k || x >= seq[k - 1]), { taps, end: w.go });
  ok(`${label}: no page errors`, !errs.length, { errs: errs.slice(0, 3) });
  await ctx.close(); }

// 4. taps on the scene's objects do their own job; a gesture stops a playing slide; "continue ›" is a target
{ const { ctx, p, errs } = await fresh();
  const st = (x, y) => p.evaluate(([x, y]) => { const r = document.getElementById('stage').getBoundingClientRect(), s = r.width / 1440; return [r.left + x * s, r.top + y * s]; }, [x, y]);
  const go = async h => { await p.goto(APP + '?o=' + Math.random() + '#' + h); await p.waitForFunction(() => document.getElementById('mtitle').textContent.length > 0); await p.waitForTimeout(600); };
  await go('beat=13'); await p.touchscreen.tap(...await st(1230, 170)); await p.waitForTimeout(250); let w = await where(p);
  ok('Beat 13: a tap on a gas chooses it and does not turn the page', w.n === 13 && w.i === 0 && w.S.pick === 'iii', { beat: w.n, slide: w.i, pick: w.S.pick });
  await go('beat=6'); const S6 = await p.evaluate(() => window.__lyaState()), gx = 340 + 90 + (S6.x + 0.45) / 5.3 * 950;
  await p.touchscreen.tap(...await st(gx, 220)); await p.waitForTimeout(250); w = await where(p);
  ok('Beat 6: a tap on the gas does not turn the page', w.n === 6 && w.i === 0, { beat: w.n, slide: w.i });
  await p.click('#tgo'); await p.waitForTimeout(120); w = await where(p);
  ok('"continue ›" is a target itself: it plays the next slide', w.n === 6 && w.i === 1 && w.playing, { beat: w.n, slide: w.i, playing: w.playing });
  const S1 = await p.evaluate(() => window.__lyaState()), bx = 340 + 90 + (S1.x + 0.45) / 5.3 * 950;
  await p.mouse.move(...await st(bx, 220)); await p.mouse.down(); await p.waitForTimeout(80); w = await where(p); const x1 = w.S.x; await p.waitForTimeout(350); const x2 = (await where(p)).S.x; await p.mouse.up();
  ok('a reader’s gesture on the gas stops a playing slide where it is', !w.playing && Math.abs(x2 - x1) < 0.05, { playing: w.playing, x1, x2 });
  ok('object taps and gestures: no page errors', !errs.length, { errs: errs.slice(0, 3) });
  await ctx.close(); }

await browser.close();
if (out) fs.writeFileSync(out, JSON.stringify({ generated_by: 'app/tour_check.mjs', channel: process.env.PW_CHANNEL || 'chromium', results: R }, null, 1));
const checks = R.filter(x => !x.note);
console.log(`guided tour: ${checks.filter(x => x.pass).length}/${checks.length}`);
process.exit(checks.every(x => x.pass) ? 0 : 1);
