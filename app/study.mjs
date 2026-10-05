// The study session mode (#cold=1), checked end to end before giving it to naïve users: it begins at Beat 0, hides
// provenance ids, logs navigation, first interactions, hints and learning (with latency), readings pressed, the physics layer,
// microscopes, replays and resets, and no identity; a reload resumes it with its own clock; the save link appears at the last
// beat only; Shift+L saves the log. Usage: node app/study.mjs <outDir> (writes the downloaded log there)
import path from 'node:path'; import fs from 'node:fs'; import { execSync } from 'node:child_process'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
const here = path.dirname(new URL(import.meta.url).pathname), [outdir] = process.argv.slice(2); fs.mkdirSync(outdir, { recursive: true });
const browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}), ctx = await browser.newContext({ viewport: { width: 1440, height: 880 }, acceptDownloads: true }), page = await ctx.newPage();
await ctx.addInitScript(() => { window.__lyaVirtualClock = true; });
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto('file://' + path.join(here, 'dist/lya.html') + '#beat=5&cold=1');   // a study session ignores the beat asked for await page.waitForFunction(() => typeof window.__lyaClock === 'function');
let T = 0; const step = async s => { const n = Math.max(1, Math.round(s * 20)); for (let i = 0; i < n; i++) { T += s / n; await page.evaluate(t => window.__lyaClock(t), T); } await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))); };
let fails = 0; const ok = (name, c, d = '') => { if (!c) fails++; console.log(`${c ? 'ok  ' : 'FAIL'} ${name} ${d}`); };
await step(2);
ok('starts at Beat 0', await page.evaluate(() => document.getElementById('mtag').textContent) === 'beat 0 of 13');
const foot0 = await page.evaluate(() => document.getElementById('foot').textContent); ok('footer without ids', !/SCI-|VAL-|\.js/.test(foot0), JSON.stringify(foot0));
ok('no save link before the end', (await page.evaluate(() => document.getElementById('sess').innerHTML)) === '');
for (const x of [300, 360, 420]) { await page.mouse.move(340 + x, 70 + 212); await step(0.1); }
await page.click('#next'); await step(0.5);              // → Beat 1
await page.click('#topnav .bn[data-k="3"]'); await step(4.5);   // jump → Beat 3 (skips 2)
const b = await (await page.$('[data-fk="r:T"]')).boundingBox(); await page.mouse.click(b.x + 50, b.y + 12); await step(0.5);   // a reading pressed like a slider
await page.mouse.move(340 + 600, 70 + 150); await page.mouse.down(); await step(1.5); await page.mouse.up(); await step(0.3);   // hold
await page.click('#advtoggle'); await step(0.3); await page.click('#advtoggle'); await step(0.3);
await page.click('.whylink'); await step(0.5); await page.click('#mback'); await step(0.3);
await page.click('[data-fk="b:replay how this forms (slowly) ▸"]'); await step(0.5);
await page.click('#topnav .bn[data-k="6"]'); await step(2.5);
await page.click('[data-fk="b:back to the toy’s parcel"]'); await step(0.3);
await page.click('#prev'); await step(0.3);               // back → Beat 5
// reload: resumed, same beat, onboarding kept
await page.reload(); await page.waitForFunction(() => typeof window.__lyaClock === 'function'); T = 0; await step(1);
const s = await page.evaluate(() => window.__lyaSession());
ok('resumed after reload', s.reloads === 1 && s.on, `reloads ${s.reloads}`);
ok('resumed on the same beat', await page.evaluate(() => document.getElementById('mtag').textContent) === 'beat 5 of 13');
ok('onboarding kept (Beat 3 hint learned)', await page.evaluate(() => sessionStorage.getItem('lya.hint.b3.warm')) === '1');
const v = s.visits; const by = n => v.filter(x => x.beat === n);
ok('Beat 0: first interaction by hovering the beam', by(0)[0].first_interaction_s != null, JSON.stringify({ fi: by(0)[0].first_interaction_s, learned: by(0)[0].learned }));
ok('Beat 3 visit: jump skipped 1 beat via beat number', by(3)[0].skipped === 1 && by(3)[0].via === 'beat number' && by(3)[0].direction === 'forward');
ok('Beat 3: reading pressed recorded', by(3)[0].readings_pressed.length === 1, JSON.stringify(by(3)[0].readings_pressed));
ok('Beat 3: hold gesture counted and learned with latency', by(3)[0].gestures.hold === 1 && by(3)[0].learned.some(l => l.key === 'b3.warm' && l.after_hint_s != null), JSON.stringify(by(3)[0].learned));
ok('Beat 3: physics opened and closed', by(3)[0].physics.length === 2);
ok('Beat 3: microscope opened', by(3)[0].microscopes.length === 1);
ok('Beat 3: replay recorded', by(3)[0].replays.length === 1);
ok('Beat 6: reset recorded', by(6)[0].resets.length === 1);
ok('Beat 5 entered back via arrow', v.some(x => x.beat === 5 && x.direction === 'back' && x.via === 'arrow'));
ok('no identity fields', !JSON.stringify(s).match(/userAgent|name"|email|ip"/i));
console.log('input', JSON.stringify(s.input), 'viewport', JSON.stringify(s.viewport), 'durations', v.map(x => x.duration_s).join(','));
// the end: the link appears at Beat 13; Shift+L saves at any time
await page.click('#topnav .bn[data-k="13"]'); await step(0.5);
ok('save link at the last beat', (await page.evaluate(() => document.getElementById('sess').textContent)).includes('save the session log'));
const [dl] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('Shift+L')]); const f = path.join(outdir, 'study-log.json'); await dl.saveAs(f);
const j = JSON.parse(fs.readFileSync(f, 'utf8')); ok('Shift+L downloads the log', j.schema === 'lya-study/1' && j.visits.length > 5, dl.suggestedFilename());
console.log(`study: ${fails ? fails + ' failed' : 'all checks pass'} · page errors: ${errs.length ? errs : 'none'}`);
await browser.close();
process.exit(fails || errs.length ? 1 : 0);
