// A real Firefox check without Playwright's patched build: drive an installed Firefox through its built-in WebDriver
// BiDi protocol (Node's own WebSocket; nothing to install). Every beat is loaded live and checked — no script errors
// (log.entryAdded), the figure has drawn, the title matches the manifest — and the "sources & assumptions" sheet and the
// science notes are opened; screenshots are saved. Usage: node app/firefox_bidi.mjs <out> [firefox binary]
// (default binary: FIREFOX_BIN, or the macOS app). Writes <out>/firefox.json.
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import { spawn } from 'node:child_process';
const here = path.dirname(new URL(import.meta.url).pathname), [out, binArg] = process.argv.slice(2);
const bin = binArg || process.env.FIREFOX_BIN || '/Applications/Firefox.app/Contents/MacOS/firefox';
if (!out || !fs.existsSync(bin)) { console.log('usage: node app/firefox_bidi.mjs <out> [firefox]; no Firefox found'); process.exit(2); }
fs.mkdirSync(out, { recursive: true });
const beats = JSON.parse(fs.readFileSync(path.join(here, '../design/canonical/beats.json'))).beats;
const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'lya-ff-')), port = 9300 + Math.floor(Math.random() * 500);
fs.writeFileSync(path.join(prof, 'user.js'), 'user_pref("remote.active-protocols", 1);\nuser_pref("browser.shell.checkDefaultBrowser", false);\nuser_pref("datareporting.policy.dataSubmissionEnabled", false);\n');
const ff = spawn(bin, ['--headless', '--no-remote', '--profile', prof, '--remote-debugging-port', String(port), '--window-size=1440,880', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
let wsUrl = null; ff.stderr.on('data', d => { const m = String(d).match(/WebDriver BiDi listening on (ws:\/\/\S+)/); if (m) wsUrl = m[1]; });
const sleep = ms => new Promise(r => setTimeout(r, ms));
for (let i = 0; i < 100 && !wsUrl; i++) await sleep(200);
if (!wsUrl) { console.log('Firefox did not open a WebDriver BiDi endpoint'); ff.kill(); process.exit(2); }
const ws = new WebSocket(wsUrl.replace(/\/?$/, '/session')); await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let id = 0; const pending = new Map(), logs = [];
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id != null && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } else if (m.method === 'log.entryAdded') logs.push(m.params); };
const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ok = m => { if (m.type === 'error' || m.error) throw new Error(`${m.error}: ${m.message}`); return m.result; };
const version = ok(await send('session.new', { capabilities: {} })).capabilities.browserVersion;
ok(await send('session.subscribe', { events: ['log.entryAdded'] }));
const ctx = ok(await send('browsingContext.getTree')).contexts[0].context;
const nav = async u => ok(await send('browsingContext.navigate', { context: ctx, url: u, wait: 'complete' }));
const evalJS = async expr => { const r = ok(await send('script.evaluate', { expression: expr, target: { context: ctx }, awaitPromise: true })); if (r.type === 'exception') throw new Error(r.exceptionDetails.text); return r.result.value; };
const shot = async f => { const r = ok(await send('browsingContext.captureScreenshot', { context: ctx })); fs.writeFileSync(path.join(out, f), Buffer.from(r.data, 'base64')); };
const appUrl = h => 'file://' + path.join(here, 'dist/lya.html') + '?' + Math.random().toString(36).slice(2) + '#' + h;
const report = { firefox: version, beats: [], problems: [] };
for (const b of beats) {
  const n0 = logs.length; await nav(appUrl(`beat=${b.n}`)); await sleep(1500);
  const r = JSON.parse(await evalJS(`JSON.stringify((() => { const c = document.getElementById('cv'); if (!c) return { title: null, ink: 0 }; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let ink = 0; for (let i = 0; i < d.length; i += 4 * 97) if (d[i] < 200 || d[i + 1] < 200) ink++; return { title: document.getElementById('mtitle').textContent, ink }; })())`));
  const errs = logs.slice(n0).filter(l => l.level === 'error').map(l => l.text);
  const good = r.title === b.title && r.ink > 50 && !errs.length;
  report.beats.push({ beat: b.n, ok: good, ink_samples: r.ink, errors: errs }); if (!good) report.problems.push(`beat ${b.n}: ${r.title !== b.title ? `title '${r.title}'; ` : ''}${r.ink <= 50 ? 'figure empty; ' : ''}${errs.join(' | ')}`);
  if ([0, 3, 6, 12].includes(b.n)) await shot(`firefox-beat${b.n}.png`);
}
await nav(appUrl('beat=5&src=1')); await sleep(900);
report.sources_sheet = JSON.parse(await evalJS(`JSON.stringify({ open: !document.getElementById('srcp').classList.contains('hidden'), links: document.querySelectorAll('#srcbody a').length })`));
if (!report.sources_sheet.open) report.problems.push('the sources sheet did not open'); await shot('firefox-sources.png');
await nav('file://' + path.join(here, 'dist/science/index.html#voigt-profile')); await sleep(700);
report.science_notes = JSON.parse(await evalJS(`JSON.stringify({ anchor: !!document.getElementById('voigt-profile'), equations: document.querySelectorAll('.katex').length })`));
if (!report.science_notes.anchor || !report.science_notes.equations) report.problems.push('science notes did not render'); await shot('firefox-science.png');
report.ok = !report.problems.length;
await send('session.end'); ws.close(); ff.kill(); fs.rmSync(prof, { recursive: true, force: true });
fs.writeFileSync(path.join(out, 'firefox.json'), JSON.stringify(report, null, 1));
console.log(`firefox ${version} (WebDriver BiDi): ${report.beats.filter(b => b.ok).length}/${report.beats.length} beats · sources sheet ${report.sources_sheet.open ? `open, ${report.sources_sheet.links} links` : 'FAIL'} · notes ${report.science_notes.equations} equations${report.problems.length ? ' · PROBLEMS: ' + report.problems.join('; ') : ''}`);
process.exit(report.ok ? 0 : 1);
