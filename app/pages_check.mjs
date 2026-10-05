// Hosted-site check: run against a deployed copy (GitHub Pages staging, or tools/pages_emulator.mjs) under a project
// path, never the domain root. Root and deep links, reloads, session storage, all 14 scenes through "next", the sources
// sheet and its links into the science notes, stable claim anchors, licence files, the 404 page and its way back,
// fonts and KaTeX, cache headers, the small-screen notice, and no console errors.
// Usage: node app/pages_check.mjs <base URL ending in /> [out.json] [repository URL]
//        e.g. https://jibancat.github.io/lya-gas-to-forest/ receipt.json https://github.com/Jibancat/lya-gas-to-forest
//        (with LOCAL_MAP=127.0.0.1:8155 the base URL's host is resolved to the local emulator)
import fs from 'node:fs'; import path from 'node:path'; import { execSync } from 'node:child_process'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
const [base, out, repo] = process.argv.slice(2);
if (!base || !base.endsWith('/')) { console.log('usage: node app/pages_check.mjs <base URL ending in /> [out.json]'); process.exit(2); }
const host = new URL(base).host, args = process.env.LOCAL_MAP ? [`--host-resolver-rules=MAP ${new URL(base).hostname} ${process.env.LOCAL_MAP}`] : [];
const browser = await chromium.launch({ args, ...(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}) });
const R = [], errs = [], ok = (name, pass, detail = {}) => R.push({ name, pass: !!pass, ...detail });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 880 } }), p = await ctx.newPage();
p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
const ready = () => p.waitForFunction(() => document.getElementById('mtitle') && document.getElementById('mtitle').textContent, null, { timeout: 30000 });
const tag = () => p.evaluate(() => document.getElementById('mtag').textContent);

// root and deep links
let r = await p.goto(base); await ready(); ok('the site root opens the app', new URL(p.url()).pathname === new URL(base).pathname + 'lya.html' && /beat 0/.test(await tag()), { url: p.url(), status: r.status() });
r = await p.goto(base + '#beat=7'); await ready(); ok('a scene deep link through the root keeps its scene', /beat 7/.test(await tag()), { url: p.url() });
r = await p.goto(base + 'lya.html?d=1#beat=12'); await ready(); ok('a direct scene deep link', /beat 12/.test(await tag()) && r.status() === 200, { headers: { 'cache-control': r.headers()['cache-control'], 'content-encoding': r.headers()['content-encoding'] } });
await p.reload(); await ready(); ok('a reload keeps the scene', /beat 12/.test(await tag()));
// a study session survives a reload in the same tab (session storage on this origin)
await p.goto(base + 'lya.html?s=1#cold=1'); await ready(); await p.waitForTimeout(300); await p.reload(); await ready();
ok('session storage works on the host (a study session resumes after reload)', await p.evaluate(() => { try { return JSON.parse(sessionStorage.getItem('lyaStudy') || '{}').reloads >= 1; } catch (e) { return false; } }));
// every scene, through "next"
await p.goto(base + 'lya.html?n=1#beat=0'); await ready(); const seen = [await tag()];
for (let k = 1; k < 14; k++) { await p.click('#next'); await p.waitForTimeout(120); seen.push(await tag()); }
ok('all 14 scenes, one "next" at a time', seen.every((t, k) => t.startsWith(`beat ${k} `)), { last: seen[13] });
const fonts = await p.evaluate(async () => { await document.fonts.ready; return ['300 16px Fraunces', 'italic 300 16px Fraunces', '300 13px Inter', '400 11px "IBM Plex Mono"'].map(f => document.fonts.check(f)); });
ok('fonts load from the page itself', fonts.every(Boolean), { fonts });
// the sources sheet, and its links into the science notes
await p.goto(base + 'lya.html?s=2#beat=13'); await ready(); await p.click('.srclink');
const links = await p.evaluate(() => [...document.querySelectorAll('#srcbody a')].map(a => a.href).filter(h => /science\/index\.html/.test(h)));
const anchors = [...new Set(links.map(h => new URL(h).hash.slice(1)).filter(Boolean))];
ok('the sources sheet links into the science notes under the project path', links.length > 0 && links.every(h => h.startsWith(base + 'science/')), { n: links.length, first: links[0] });
const sci = await ctx.newPage(); r = await sci.goto(base + 'science/'); const ids = await sci.evaluate(() => [...document.querySelectorAll('[id]')].map(e => e.id));
ok('the science notes open at science/', r.status() === 200, { status: r.status() });
ok('every claim the sheet links to has its anchor', anchors.every(a => ids.includes(a)), { checked: anchors.length, missing: anchors.filter(a => !ids.includes(a)) });
for (const a of ['thermal-doppler-broadening', 'beer-lambert', 'same-shadow-degeneracy', 'damping-wings', 'velocity-to-wavelength']) ok(`stable claim anchor #${a}`, ids.includes(a));
ok('KaTeX renders in the science notes', (await sci.evaluate(() => document.querySelectorAll('.katex').length)) > 20);
const sciLinks = await sci.evaluate(() => [...document.querySelectorAll('a[href]')].map(a => a.href).filter(h => h.startsWith(location.origin) && !h.includes('#')));
const bad = []; for (const h of [...new Set(sciLinks)]) { const st = await sci.evaluate(async u => (await fetch(u, { cache: 'no-store' })).status, h); if (st !== 200) bad.push([h, st]); }   // through the page, so the host resolves as the browser resolves it
ok('every same-site link in the science notes resolves (licences, reports, back to the app)', !bad.length, { checked: new Set(sciLinks).size, bad });
// nothing escapes the project path: no root-absolute or other-path same-origin URL in the app or the notes
const escapes = [];
for (const [pg, u] of [[p, base + 'lya.html?e=1#beat=0'], [sci, base + 'science/']]) { await pg.goto(u); await pg.waitForTimeout(200);
  escapes.push(...await pg.evaluate(b => [...document.querySelectorAll('[href],[src]')].map(e => e.getAttribute('href') ?? e.getAttribute('src')).filter(v => v && !v.startsWith('data:') && !v.startsWith('#') && !v.startsWith('mailto:'))
    .map(v => [v, new URL(v, location.href).href]).filter(([v, abs]) => v.startsWith('/') || (abs.startsWith(location.origin) && !abs.startsWith(b))).map(([v]) => v), base)); }
ok('no URL escapes the project path (to the domain root or another path)', !escapes.length, { escapes: escapes.slice(0, 5) });
if (repo) { const rl = await sci.evaluate(() => [...document.querySelectorAll('a[href^="https://github.com/"]')].map(a => a.href));
  ok('the science notes link the public repository (and no private one)', rl.some(h => h.replace(/\/$/, '') === repo) && !rl.some(h => /Lya_app/i.test(h)), { links: [...new Set(rl)].slice(0, 4) }); }
// the 404 page and its way back
const nf = await ctx.newPage(); r = await nf.goto(base + 'no/such/page'); const back = await nf.evaluate(() => [document.getElementById('home').href, document.getElementById('sci').href]);
ok('a missing path answers 404 with a way back to the site', r.status() === 404 && back[0] === base && back[1] === base + 'science/', { status: r.status(), back });
// the app inside "show the physics" renders equations
await p.goto(base + 'lya.html?s=3#beat=6&adv=1'); await ready(); ok('KaTeX renders in the app', (await p.evaluate(() => document.querySelectorAll('#eqs .katex').length)) > 0);
// devices: a tablet sees no notice, a phone a gentle one
for (const [name, vp, want] of [['tablet 1024×768', { width: 1024, height: 768 }, false], ['phone 390×844', { width: 390, height: 844 }, true]]) {
  const c2 = await browser.newContext({ viewport: vp, hasTouch: true }), q = await c2.newPage(); await q.goto(base + 'lya.html'); await q.waitForFunction(() => document.getElementById('mtitle').textContent);
  ok(`${name}: small-screen notice ${want ? 'shown' : 'absent'}`, (await q.evaluate(() => !!document.getElementById('small'))) === want); await c2.close(); }
await browser.close();
ok('no console errors', !errs.length, { errs: errs.slice(0, 5) });
if (out) fs.writeFileSync(out, JSON.stringify({ base, results: R }, null, 1));
for (const x of R) console.log(`${x.pass ? 'ok  ' : 'FAIL'} ${x.name}`);
console.log(`pages check (${host}): ${R.filter(x => x.pass).length}/${R.length}`);
process.exit(R.every(x => x.pass) ? 0 : 1);
