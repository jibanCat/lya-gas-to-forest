// The release performance budget: what the site weighs (raw and gzip, as GitHub Pages serves it; and what the fonts,
// KaTeX, data and code contribute), how long it takes to load from a gzip-serving static server under throttled
// networks (the figure's first drawing, not just the load event), and the cost of direct manipulation under 4× CPU
// throttling (a phone-class stand-in). Usage: node app/load_perf.mjs <out.json>
import fs from 'node:fs'; import path from 'node:path'; import http from 'node:http'; import zlib from 'node:zlib'; import { execSync } from 'node:child_process'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
const here = path.dirname(new URL(import.meta.url).pathname), dist = path.join(here, 'dist'), [out] = process.argv.slice(2);
const kb = n => +(n / 1024).toFixed(0);
// ---------------------------------------------------------------------------------------------- weight
const html = fs.readFileSync(path.join(dist, 'lya.html'), 'utf8'), notes = fs.readFileSync(path.join(dist, 'science/index.html'), 'utf8');
const part = (re) => [...html.matchAll(re)].reduce((s, m) => s + m[0].length, 0);
const weight = {
  app_raw_kB: kb(Buffer.byteLength(html)), app_gzip_kB: kb(zlib.gzipSync(html, { level: 9 }).length), app_brotli_kB: kb(zlib.brotliCompressSync(html).length),
  notes_raw_kB: kb(Buffer.byteLength(notes)), notes_gzip_kB: kb(zlib.gzipSync(notes, { level: 9 }).length),
  app_parts_raw_kB: {
    text_fonts_inline: kb(part(/url\(data:font\/woff2;base64,[^)]+\)/g) - part(/KaTeX_[A-Za-z0-9-]+\.woff2|font-family:KaTeX/g) * 0) ,
    katex_js: kb(Buffer.byteLength(fs.readFileSync(path.join(here, 'vendor/katex/katex.min.js')))),
    data: kb(Buffer.byteLength(html.match(/window\.LYA_DATA = [\s\S]*?;<\/script>/)[0])),
    physics_js: kb(Buffer.byteLength(fs.readFileSync(path.join(here, '../science/js/lyaphys.js')))),
  },
};
const fontsAll = part(/url\(data:font\/woff2;base64,[^)]+\)/g), katexFonts = [...html.matchAll(/@font-face\{font-family:KaTeX_[^}]*url\(data:font\/woff2;base64,[^)]+\)/g)].reduce((s, m) => s + m[0].length, 0);
weight.app_parts_raw_kB.text_fonts_inline = kb(fontsAll - katexFonts); weight.app_parts_raw_kB.katex_fonts_inline = kb(katexFonts);
weight.app_parts_raw_kB.app_code_and_shell = weight.app_raw_kB - Object.values(weight.app_parts_raw_kB).reduce((a, b) => a + b, 0);
// ---------------------------------------------------------------------------------------------- a gzip static server (GitHub Pages serves gzip)
const server = http.createServer((req, res) => {
  const p = path.join(dist, decodeURIComponent(req.url.split('?')[0].split('#')[0]).replace(/\/$/, '/index.html'));
  if (!p.startsWith(dist) || !fs.existsSync(p)) { res.writeHead(404); res.end(); return; }
  const body = fs.readFileSync(p), type = p.endsWith('.html') ? 'text/html; charset=utf-8' : p.endsWith('.json') ? 'application/json' : 'text/plain';
  res.writeHead(200, { 'content-type': type, 'content-encoding': 'gzip', 'cache-control': 'no-store' }); res.end(zlib.gzipSync(body));
}).listen(0); const port = server.address().port;
const browser = await chromium.launch(), load = [];
const NET = { 'desktop broadband (50 Mbps, 20 ms)': [50e6, 20], 'fast 4G (9 Mbps, 170 ms)': [9e6, 170], 'slow 4G (1.6 Mbps, 150 ms)': [1.6e6, 150] };
for (const [label, [bps, rtt]] of Object.entries(NET)) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 880 } }), page = await ctx.newPage(), cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: rtt, downloadThroughput: bps / 8, uploadThroughput: bps / 8 });
  const t0 = Date.now(); await page.goto(`http://127.0.0.1:${port}/lya.html#beat=0`, { waitUntil: 'load', timeout: 120000 }); const tLoad = Date.now() - t0;
  await page.waitForFunction(() => { const c = document.getElementById('cv'); if (!c || !document.getElementById('mtitle').textContent) return false; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4 * 211) if (d[i] < 200) n++; return n > 30; }, null, { timeout: 120000, polling: 50 });
  const tDrawn = Date.now() - t0;
  load.push({ network: label, load_event_s: +(tLoad / 1000).toFixed(2), first_figure_s: +(tDrawn / 1000).toFixed(2) }); await ctx.close();
}
// ---------------------------------------------------------------------------------------------- interaction under 4× CPU throttling
const interact = [];
for (const rate of [1, 4]) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 880 } }), page = await ctx.newPage(), cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate });
  await page.goto(`http://127.0.0.1:${port}/lya.html#beat=6`); await page.waitForTimeout(2500);
  const fig = (x, y) => [340 + x, 70 + y];
  await page.evaluate(() => { window.__lyaPerf(true); window.__fr = 0; window.__run = true; const f = () => { window.__fr++; if (window.__run) requestAnimationFrame(f); }; requestAnimationFrame(f); window.__t0 = performance.now(); });
  await page.mouse.move(...fig(741, 150)); await page.mouse.down(); for (let k = 0; k <= 80; k++) { await page.mouse.move(...fig(741 - k * 4, 151)); await page.waitForTimeout(16); } await page.mouse.up();
  const r = await page.evaluate(() => { window.__run = false; const dt = (performance.now() - window.__t0) / 1000; return { fps: window.__fr / dt, ...window.__lyaPerf() }; });
  interact.push({ cpu_throttle: rate, gesture: 'Beat 6 · move the parcel', fps: +r.fps.toFixed(0), draw_mean_ms: +r.mean_ms.toFixed(1), draw_p95_ms: +r.p95_ms.toFixed(1) }); await ctx.close();
}
await browser.close(); server.close();
const rep = { weight, load, interact, note: 'headless Chromium on the build machine; the network is emulated (CDP); gzip as GitHub Pages serves; first_figure = the figure has drawn' };
if (out) fs.writeFileSync(out, JSON.stringify(rep, null, 1));
console.log(`weight: app ${weight.app_raw_kB} kB raw, ${weight.app_gzip_kB} kB gzip (${weight.app_brotli_kB} kB brotli); science notes ${weight.notes_raw_kB} kB raw, ${weight.notes_gzip_kB} kB gzip`);
console.log('  app parts (raw kB):', JSON.stringify(weight.app_parts_raw_kB));
for (const l of load) console.log(`load ${l.network}: load event ${l.load_event_s} s, figure drawn ${l.first_figure_s} s`);
for (const i of interact) console.log(`interaction ×${i.cpu_throttle} CPU: ${i.gesture} ${i.fps} fps, draw mean ${i.draw_mean_ms} ms, p95 ${i.draw_p95_ms} ms`);
