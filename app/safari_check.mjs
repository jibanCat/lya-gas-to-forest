// Real Safari release check through Safari's own WebDriver (safaridriver; W3C WebDriver over HTTP, no extra packages).
// Needs Develop → "Allow Remote Automation" (the machine owner's setting; this script never changes it). Serve the
// site first under a project path, e.g.  node tools/pages_emulator.mjs app/dist lya-gas-to-forest 8155
// Usage: node app/safari_check.mjs <base URL ending in /> [outDir]
// Loading (root, 14 scenes, deep links, refresh, science notes), rendering (fonts, KaTeX, a drawn canvas), navigation
// (numerals, previous/next, keyboard focus, Escape, the sources sheet), the high-risk gestures with real pointer actions
// (Beat 3 hold, Beat 5 light, Beat 6 place / motion / hold, Beat 7 velocity arrow, Beat 10 loupe, Beat 12 scan), state
// (session storage, first-session hints, reload/resume). Safari's console is not exposed to WebDriver: every page gets
// an error hook, and its errors are read back. Reduced motion and browser zoom are OS/browser settings WebDriver cannot
// set; they are in the manual iPad checklist.
import fs from 'node:fs'; import path from 'node:path'; import { spawn } from 'node:child_process';
const [base, outDir] = process.argv.slice(2);
if (!base || !base.endsWith('/')) { console.log('usage: node app/safari_check.mjs <base URL ending in /> [outDir]'); process.exit(2); }
if (outDir) fs.mkdirSync(outDir, { recursive: true });
const PORT = 4445, D = `http://127.0.0.1:${PORT}`, drv = spawn('/usr/bin/safaridriver', ['-p', String(PORT)], { stdio: 'ignore' });
const wait = ms => new Promise(r => setTimeout(r, ms));
const call = async (method, p, body) => { const r = await fetch(D + p, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); const j = await r.json(); if (j.value && j.value.error) throw new Error(`${j.value.error}: ${j.value.message}`); return j.value; };
const R = [], ok = (name, pass, detail = {}) => { R.push({ name, pass: !!pass, ...detail }); console.log(`${pass ? 'ok  ' : 'FAIL'} ${name}${pass ? '' : ' ' + JSON.stringify(detail).slice(0, 200)}`); };
let sid = null, version = null;
try {
  await wait(800);
  const s = await call('POST', '/session', { capabilities: { alwaysMatch: { browserName: 'safari' } } }); sid = s.sessionId; version = s.capabilities.browserVersion;
  const S = p => `/session/${sid}${p}`, js = (script, args = []) => call('POST', S('/execute/sync'), { script, args }), url = () => call('GET', S('/url'));
  const until = async (script, ms = 20000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await js(script)) return true; } catch (e) {} await wait(150); } return false; };
  const HOOK = 'if (!window.__errs) { window.__errs = []; window.addEventListener("error", e => window.__errs.push(String(e.message))); window.addEventListener("unhandledrejection", e => window.__errs.push("unhandled: " + String(e.reason))); } return true;';
  const errs = []; const collect = async () => { try { errs.push(...(await js('return window.__errs || []'))); } catch (e) {} };
  const go = async (u, readyScript = 'return !!document.getElementById("mtitle") && document.getElementById("mtitle").textContent.length > 0') => { await collect(); await call('POST', S('/url'), { url: u }); const r = await until(readyScript); await js(HOOK); return r; };
  const shot = async name => { if (!outDir) return; const b64 = await call('GET', S('/screenshot')); fs.writeFileSync(path.join(outDir, `safari-${name}.png`), Buffer.from(b64, 'base64')); };
  const tag = () => js('return document.getElementById("mtag").textContent'), st = () => js('return JSON.parse(JSON.stringify(window.__lyaState(), (k, v) => typeof v === "object" && v !== null && !Array.isArray(v) && k ? undefined : v))');
  const fig = async (x, y) => { const r = await js('const r = document.getElementById("cv").getBoundingClientRect(); return [r.left, r.top, r.width, r.height]'); return [Math.round(r[0] + x / 1070 * r[2]), Math.round(r[1] + y / 780 * r[3])]; };
  const pointer = acts => call('POST', S('/actions'), { actions: [{ type: 'pointer', id: 'p', parameters: { pointerType: 'mouse' }, actions: acts }] }).then(() => call('DELETE', S('/actions')));
  const drag = async ([x0, y0], [x1, y1], steps = 12) => { await pointer([{ type: 'pointerMove', x: x0, y: y0 }, { type: 'pointerDown', button: 0 }, ...Array.from({ length: steps }, (_, i) => ({ type: 'pointerMove', duration: 25, x: Math.round(x0 + (x1 - x0) * (i + 1) / steps), y: Math.round(y0 + (y1 - y0) * (i + 1) / steps) })), { type: 'pointerUp', button: 0 }]); await wait(250); };
  const hold = async ([x, y], ms = 1600) => { await pointer([{ type: 'pointerMove', x, y }, { type: 'pointerDown', button: 0 }, { type: 'pause', duration: ms }, { type: 'pointerUp', button: 0 }]); await wait(250); };
  await call('POST', S('/window/rect'), { width: 1440, height: 960 });
  ok(`Safari ${version} (${s.capabilities.platformName})`, true, { version });

  // loading: the root, every scene by deep link, refresh, the science notes
  await go(base); ok('the site root opens the app', /\/lya\.html(#|$)/.test(await url()) && /beat 0/.test(await tag()), { url: await url() });
  for (let n = 0; n < 14; n++) {
    const drawn = await go(`${base}lya.html?n=${n}#beat=${n}`, 'return !!document.getElementById("live") && document.getElementById("live").textContent.length > 40');
    const ink = await js('const c = document.getElementById("cv"), d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 64) if (Math.abs(d[i] - 252) + Math.abs(d[i + 1] - 251) + Math.abs(d[i + 2] - 248) > 30 && d[i + 3] > 0) n++; return n;');
    ok(`Beat ${n}: deep link loads, the figure is drawn and described`, drawn && /beat \d+/.test(await tag()) && (await tag()).startsWith(`beat ${n} `) && ink > 200, { ink });
    if ([0, 6, 13].includes(n)) await shot(`beat-${n}`);
  }
  await call('POST', S('/refresh'), {}); await until('return !!document.getElementById("mtitle") && document.getElementById("mtitle").textContent.length > 0'); await js(HOOK);
  ok('refresh keeps the scene', /beat 13/.test(await tag()));
  ok('fonts load from the page (Fraunces, Inter, IBM Plex Mono)', await js('return ["300 16px Fraunces", "italic 300 16px Fraunces", "300 13px Inter", "400 11px \\"IBM Plex Mono\\""].every(f => document.fonts.check(f))'));
  await go(`${base}lya.html?k=1#beat=6&adv=1`); await until('return document.querySelectorAll("#eqs .katex").length > 0', 8000);
  ok('KaTeX renders in the app ("show the physics")', await js('return document.querySelectorAll("#eqs .katex").length > 0'));
  await go(`${base}science/#thermal-doppler-broadening`, 'return document.querySelectorAll(".katex").length > 20');
  ok('the science notes render, at a stable claim anchor', await js('return document.querySelectorAll(".katex").length > 20 && !!document.getElementById("thermal-doppler-broadening")')); await shot('science');

  // navigation: numerals, previous / next, keyboard focus, the sources sheet, Escape
  await go(`${base}lya.html?nav=1#beat=6`);
  await js('document.querySelector(\'#topnav .bn[data-k="9"]\').click(); return true'); await wait(200); ok('a beat numeral navigates', /beat 9/.test(await tag()));
  const nextEl = await call('POST', S('/element'), { using: 'css selector', value: '#next' }); await call('POST', S(`/element/${Object.values(nextEl)[0]}/click`), {}); await wait(250);
  ok('"next" (a real click on its label) navigates', /beat 10/.test(await tag()));
  const prevEl = await call('POST', S('/element'), { using: 'css selector', value: '#prev' }); await call('POST', S(`/element/${Object.values(prevEl)[0]}/click`), {}); await wait(250);
  ok('"previous" navigates', /beat 9/.test(await tag()));
  await js('document.activeElement && document.activeElement.blur(); return true');
  const tabbed = []; for (let i = 0; i < 3; i++) { await call('POST', S('/actions'), { actions: [{ type: 'key', id: 'k', actions: [{ type: 'keyDown', value: '' }, { type: 'keyDown', value: '' }, { type: 'keyUp', value: '' }, { type: 'keyUp', value: '' }] }] }); await wait(120);
    tabbed.push(await js('const e = document.activeElement, o = getComputedStyle(e); return { tag: e.tagName, id: e.id, outline: o.outlineStyle !== "none" && parseFloat(o.outlineWidth) > 0 }')); }
  ok('keyboard (Option-Tab) reaches the navigation with a visible focus mark', tabbed.some(t => t.tag === 'BUTTON' && t.outline), { tabbed });
  await js('document.querySelector(".srclink").click(); return true'); await wait(250); const srcOpen = await js('return !document.getElementById("srcp").classList.contains("hidden")');
  await call('POST', S('/actions'), { actions: [{ type: 'key', id: 'k', actions: [{ type: 'keyDown', value: '' }, { type: 'keyUp', value: '' }] }] }); await wait(250);
  ok('the sources sheet opens; Escape closes it', srcOpen && await js('return document.getElementById("srcp").classList.contains("hidden")'));

  // the high-risk gestures, with real pointer input
  await go(`${base}lya.html?g=3#beat=3`); let a = await st(); await hold(await fig(600, 150)); let b = await st();
  ok('Beat 3: holding the gas warms it', b.T > a.T * 1.5, { T: [a.T, b.T] });
  await go(`${base}lya.html?g=5#beat=5&stage=1`); a = await st(); await drag(await fig(990, 74), await fig(700, 74), 16); b = await st();
  ok('Beat 5: dragging the light moves it along its path', (b._free ?? 0) > 0.5, { journey: b._free });
  await go(`${base}lya.html?g=6#beat=6`); a = await st(); await drag(await fig(740, 150), await fig(600, 152), 14); b = await st();
  ok('Beat 6: dragging the gas moves only its place', b.x < a.x - 0.5 && b.v === a.v && b.T === a.T, { x: [a.x, b.x] });
  a = b; const tip = 90 + (a.x + 0.45) / 5.3 * 950 + a.v * 0.45; await drag(await fig(tip - 2, 104), await fig(tip - 42, 104), 12); b = await st();
  ok('Beat 6: dragging its arrow changes only its motion', b.v < a.v - 50 && b.x === a.x && b.T === a.T, { v: [a.v, b.v] });
  a = b; await hold(await fig(90 + (a.x + 0.45) / 5.3 * 950, 150)); b = await st();
  ok('Beat 6: holding the gas changes only its temperature', b.T > a.T && b.x === a.x && b.v === a.v, { T: [a.T, b.T] });
  // Beats 7 and 12 open with a first-visit reveal (the velocities grow in; the first trace): the gesture follows it, as a reader's does
  await go(`${base}lya.html?g=7#beat=7`); await until('return window.__lyaState()._intro == null', 8000); a = await st(); const tipb = 90 + (3.18 + 0.45) / 5.3 * 950 + a.vb * 0.45; await drag(await fig(tipb - 2, 110), await fig(tipb + 60, 110), 14); b = await st();
  ok('Beat 7: dragging parcel b’s velocity arrow changes only its velocity', b.vb > a.vb + 100 && b.va === a.va, { vb: [a.vb, b.vb] });
  await go(`${base}lya.html?g=10#beat=10`); a = await st(); await drag(await fig(800, 235), await fig(300, 235), 14); b = await st();
  ok('Beat 10: the loupe follows along the sheet', b.pu < a.pu - 100, { pu: [a.pu, b.pu] });
  await go(`${base}lya.html?g=12#beat=12`); await until('return window.__lyaState()._traceT == null', 8000); a = await st(); await drag(await fig(588, 600), await fig(300, 560), 16); b = await st();
  ok('Beat 12: scanning the spectrum traces another colour', Math.abs(b.pu - a.pu) > 200, { pu: [a.pu, b.pu] });

  // state: a fresh session shows first-use hints and is logged; it resumes after a reload
  await go(`${base}lya.html?s=1#cold=1`); await wait(3500);
  const log0 = await js('try { return JSON.parse(sessionStorage.getItem("lyaStudy") || "null") } catch (e) { return null }');
  ok('a fresh session: first-use hints appear (logged), session storage works', !!log0 && log0.visits && log0.visits[0] && log0.visits[0].hints.length > 0, { hints: log0 && log0.visits && log0.visits[0] && log0.visits[0].hints });
  await call('POST', S('/refresh'), {}); await until('return !!document.getElementById("mtitle") && document.getElementById("mtitle").textContent.length > 0'); await js(HOOK);
  ok('reload resumes the session', await js('try { return JSON.parse(sessionStorage.getItem("lyaStudy") || "{}").reloads >= 1 } catch (e) { return false }'));
  await collect(); ok('no page errors (uncaught exceptions or rejections)', errs.length === 0, { errs: errs.slice(0, 5) });
} catch (e) { ok('safaridriver session', false, { error: String(e.message || e) }); }
finally { if (sid) await call('DELETE', `/session/${sid}`).catch(() => {}); drv.kill(); }
if (outDir) fs.writeFileSync(path.join(outDir, 'safari.json'), JSON.stringify({ safari: version, base, results: R }, null, 1));
console.log(`safari ${version || '?'}: ${R.filter(x => x.pass).length}/${R.length}`);
process.exit(R.length > 1 && R.every(x => x.pass) ? 0 : 1);
