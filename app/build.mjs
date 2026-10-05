// Production build: app/src (ES modules) → app/dist/lya.html, one self-contained page (fonts and KaTeX from CDN for now).
// Dependency-free on purpose. The bundler resolves the module graph from src/main.js, checks every imported name is
// exported by its module, refuses duplicate top-level names (all modules share one scope), strips import/export syntax
// and wraps the result in one IIFE. It also checks design/VISUAL_LANGUAGE.md against src/design/tokens.js, and the scene
// modules against the beat manifest (design/canonical/beats.json, generated from BEATS.yaml).
import fs from 'node:fs';
import path from 'node:path';
const here = path.dirname(new URL(import.meta.url).pathname), root = path.join(here, '..');
import { sciencePage } from './science_page.mjs';
const rd = p => fs.readFileSync(p, 'utf8'), fail = m => { console.error('BUILD ERROR:', m); process.exit(1); };

// ---------------------------------------------------------------------------------------------- module graph
const mods = new Map();
const importRe = /^import\s*\{([^}]*)\}\s*from\s*'([^']+)';?\s*$/gm;
function load(file) {
  if (mods.has(file)) return;
  const src = rd(file), imports = [];
  for (const m of src.matchAll(importRe)) imports.push({ names: m[1].split(',').map(s => s.trim()).filter(Boolean), from: path.resolve(path.dirname(file), m[2]) });
  if (/^export\s+default/m.test(src)) fail(`${path.relative(root, file)}: export default is not allowed`);
  if (/^import\s+(?!\{)/m.test(src)) fail(`${path.relative(root, file)}: only named imports are allowed`);
  const exports = new Set(), decls = [];
  for (const m of src.matchAll(/^(export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm)) { decls.push(m[2]); if (m[1]) exports.add(m[2]); }
  for (const m of src.matchAll(/^(export\s+)?(?:const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm)) { decls.push(m[2]); if (m[1]) exports.add(m[2]); }
  // plain multi-name declarations without initialisers: let a, b, c;
  for (const m of src.matchAll(/^(export\s+)?(?:let|var)\s+([A-Za-z_$][\w$]*(?:\s*,\s*[A-Za-z_$][\w$]*)+)\s*;/gm)) for (const n of m[2].split(',').map(x => x.trim()).slice(1)) { decls.push(n); if (m[1]) exports.add(n); }
  if (/^export\s+(?:let|var)\s+[^;\n]*=[^;\n]*,\s*[A-Za-z_$][\w$]*\s*=/m.test(src)) fail(`${path.relative(root, file)}: export one name per declaration`);
  mods.set(file, { src, imports, exports, decls });
  for (const im of imports) load(im.from);
}
const entry = path.join(here, 'src/main.js');
load(entry);
// every imported name must be exported by its module
for (const [file, m] of mods) for (const im of m.imports) for (const n of im.names) {
  if (/\sas\s/.test(n)) fail(`${path.relative(root, file)}: renamed imports are not allowed (${n})`);
  if (!mods.get(im.from).exports.has(n)) fail(`${path.relative(root, file)} imports '${n}' which ${path.relative(root, im.from)} does not export`);
}
// one shared scope: no duplicate top-level names
const owner = new Map();
for (const [file, m] of mods) for (const d of m.decls) { if (owner.has(d)) fail(`top-level name '${d}' is declared in both ${path.relative(root, owner.get(d))} and ${path.relative(root, file)}`); owner.set(d, file); }
// dependency order (post-order DFS); cycles are allowed because top-level code only declares
const order = [], seen = new Set();
(function visit(f) { if (seen.has(f)) return; seen.add(f); for (const im of mods.get(f).imports) visit(im.from); order.push(f); })(entry);
const body = order.map(f => {
  const s = mods.get(f).src.replace(importRe, '').replace(/^export\s+(?=(async\s+)?function|const|let|var|class)/gm, '');
  return `// ---- ${path.relative(here, f)}\n${s}`;
}).join('\n');
const bundle = `(function () {\n'use strict';\n${body}\n})();`;
try { new Function(bundle); } catch (e) { fail('bundle does not parse: ' + e.message); }

// ---------------------------------------------------------------------------------------------- design guard: tokens vs the spec
const tokSrc = mods.get(path.join(here, 'src/design/tokens.js')).src;
const TK = Object.fromEntries([...tokSrc.match(/export const TK = \{([^}]*)\}/)[1].matchAll(/(\w+):\s*'(#[0-9A-Fa-f]{6})'/g)].map(m => [m[1], m[2].toUpperCase()]));
const spec = rd(path.join(root, 'design/VISUAL_LANGUAGE.md'));
const specTok = Object.fromEntries([...spec.matchAll(/^\|\s*`(\w+)`(?:\s*\([^)]*\))?\s*\|\s*`(#[0-9A-Fa-f]{6})`/gm)].map(m => [m[1], m[2].toUpperCase()]));
for (const [k, v] of Object.entries(specTok)) if (TK[k] !== v) fail(`token '${k}': VISUAL_LANGUAGE.md says ${v}, tokens.js says ${TK[k]}`);
for (const k of Object.keys(TK)) if (!(k in specTok)) fail(`token '${k}' is in tokens.js but not in VISUAL_LANGUAGE.md`);

// ---------------------------------------------------------------------------------------------- manifest guard: scenes vs beats.json
const beats = JSON.parse(rd(path.join(root, 'design/canonical/beats.json')));
const sceneFiles = order.filter(f => f.includes(`${path.sep}scenes${path.sep}`));
const declared = sceneFiles.map(f => { const s = mods.get(f).src, n = s.match(/^\s*n:\s*(\d+),/m), slug = s.match(/^\s*slug:\s*'([^']+)'/m); return { f, n: n && +n[1], slug: slug && slug[1] }; }).filter(d => d.n != null);
for (const d of declared) { const b = beats.beats.find(x => x.n === d.n); if (!b) fail(`${path.relative(root, d.f)}: beat ${d.n} is not in the manifest`); if (b.slug !== d.slug) fail(`${path.relative(root, d.f)}: slug '${d.slug}' ≠ manifest '${b.slug}'`); }

// ---------------------------------------------------------------------------------------------- assemble
const data = { skewer: JSON.parse(rd(path.join(root, 'science/data/toy/skewer.json'))), slab: JSON.parse(rd(path.join(root, 'science/data/toy/slab.json'))),
  beats, prov: null, sameShadow: JSON.parse(rd(path.join(root, 'science/validation/degeneracy/configs.json'))),
  // validation reports scenes quote from (numbers in prose are never typed by hand)
  reports: Object.fromEntries([['VAL-VOIGT-001', 'voigt'], ['VAL-TOY-002', 'toy_reference'], ['VAL-DEG-001', 'degeneracy'], ['VAL-RED-001', 'redshift']].map(([id, d]) => [id, JSON.parse(rd(path.join(root, 'science/validation', d, 'report.json')))])) };
// the public provenance: the app embeds what its "sources & assumptions" sheets show; the science notes get all of it
const PROV = JSON.parse(rd(path.join(root, 'design/canonical/public_provenance.json')));
{ const refs = new Set(Object.values(PROV.beats).flatMap(b => b.sources.map(s => s.ref)));
  data.prov = { site: { version: PROV.site.version }, beats: PROV.beats,
    references: Object.fromEntries(Object.entries(PROV.references).filter(([, r]) => refs.has(r.anchor)).map(([id, r]) => [id, { anchor: r.anchor, short: r.short, links: r.links }])),
    validations: Object.fromEntries(Object.entries(PROV.validations).map(([id, v]) => [id, { anchor: v.anchor, name: v.name, status: v.status, measured: v.measured }])) }; }
let html = rd(path.join(here, 'index.html'));
const put = (tag, s) => { if (!html.includes(`<!--${tag}-->`)) fail('shell lacks ' + tag); html = html.replace(`<!--${tag}-->`, () => s); };
// vendored fonts and KaTeX (app/vendor/VENDOR.md), inlined as data URIs: a double-clicked file cannot load neighbouring font files
const VEN = path.join(here, 'vendor'), b64 = f => fs.readFileSync(f).toString('base64');
const inlineUrls = (css, dir) => css.replace(/url\(([^)'"]+\.woff2)\)/g, (m, f) => { const fp = path.join(dir, f); if (!fs.existsSync(fp)) fail('vendored font missing: ' + fp); return `url(data:font/woff2;base64,${b64(fp)})`; });
// Google's stylesheet declares the same variable-font file once per weight (300, 400); embedding each copy would ship the
// file twice. Faces that differ only in weight are merged into one face with a weight range — the same file, the same
// glyphs, rendered at the same weights through the font's own weight axis.
function mergeWeights(css) {
  const faces = [], keyOf = b => b.replace(/font-weight:\s*[\d ]+;/, '');
  for (const m of css.matchAll(/@font-face\s*\{[^}]*\}/g)) { const b = m[0], w = +(/font-weight:\s*(\d+)/.exec(b) || [0, 0])[1], k = keyOf(b), f = faces.find(x => x.k === k); if (f) f.w.push(w); else faces.push({ k, b, w: [w] }); }
  const merged = faces.map(f => { const lo = Math.min(...f.w), hi = Math.max(...f.w); return f.b.replace(/font-weight:\s*[\d ]+;/, `font-weight: ${lo === hi ? lo : lo + ' ' + hi};`); });
  return css.replace(/@font-face\s*\{[^}]*\}\s*/g, '').trim() + '\n' + merged.join('\n');
}
const fontsCSS = inlineUrls(mergeWeights(rd(path.join(VEN, 'fonts/fonts.css'))), path.join(VEN, 'fonts'));
const katexCSS = inlineUrls(rd(path.join(VEN, 'katex/katex.min.css')).replace(/,url\(fonts\/[^)]+\.woff\) format\("woff"\),url\(fonts\/[^)]+\.ttf\) format\("truetype"\)/g, ''), path.join(VEN, 'katex'));
if (/fonts\.googleapis|jsdelivr|https?:\/\//.test(fontsCSS + katexCSS)) fail('a vendored stylesheet still points at the network');
const NOTICE = '/* Embedded third-party assets: Fraunces, Inter (SIL OFL 1.1), IBM Plex Mono (SIL OFL 1.1, Reserved Font Name "Plex", unmodified), KaTeX and its fonts (MIT). Licence texts: licenses/ beside this page (THIRD_PARTY_LICENSES.md). */';
put('VENDOR', `<style>\n${NOTICE}\n${fontsCSS}\n</style>\n<style>\n${katexCSS}\n</style>\n<script>\n${rd(path.join(VEN, 'katex/katex.min.js'))}\n</script>`);
put('PHYSICS', `<script>\n${rd(path.join(root, 'science/js/lyaphys.js'))}\n</script>`);
put('DATA', `<script>window.LYA_DATA = ${JSON.stringify(data)};</script>`);
put('APP', `<script>\n${bundle}\n</script>`);
const version = data.prov.site.version;
put('META', `<meta name="lya-version" content="${version}">`);
fs.mkdirSync(path.join(here, 'dist/science/validation'), { recursive: true });
fs.writeFileSync(path.join(here, 'dist/lya.html'), html);
// the public science notes (generated from the same provenance), the small validation reports they link to, and the site's root
const REL = JSON.parse(rd(path.join(root, 'release.json')));   // release-time facts (repository, site, licences): null until set at release
fs.writeFileSync(path.join(here, 'dist/science/index.html'), sciencePage(PROV, { fontsCSS, katexCSS, version, repository: REL.repository }));
for (const v of Object.values(PROV.validations)) if (v.report) fs.copyFileSync(path.join(root, v.report), path.join(here, 'dist/science/validation', v.anchor + '.json'));
// third-party licence texts travel with the fonts and KaTeX embedded in the pages (SIL OFL 1.1, MIT)
fs.mkdirSync(path.join(here, 'dist/licenses'), { recursive: true });
for (const l of fs.readdirSync(path.join(VEN, 'LICENSES'))) fs.copyFileSync(path.join(VEN, 'LICENSES', l), path.join(here, 'dist/licenses', l));
fs.copyFileSync(path.join(root, 'THIRD_PARTY_LICENSES.md'), path.join(here, 'dist/licenses/THIRD_PARTY_LICENSES.md'));
// every page declares an (empty) icon, so a browser never asks the domain root for /favicon.ico — outside a project site
fs.writeFileSync(path.join(here, 'dist/index.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><link rel="icon" href="data:,"><title>Lyα: from gas to forest</title><meta http-equiv="refresh" content="0; url=lya.html"><script>location.replace('lya.html' + location.hash);</script></head><body><a href="lya.html">Lyα: from gas to forest</a> · <a href="science/index.html">science notes</a></body></html>\n`);
// GitHub Pages serves 404.html for any missing path; under a project page (/<repo>/) it finds its way back to the site's
// root without hard-coding it (scenes and claims are linked with #fragments, which never reach the server)
fs.writeFileSync(path.join(here, 'dist/404.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><link rel="icon" href="data:,"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Not found · Lyα: from gas to forest</title>
<style>body{margin:0;padding:48px 32px;max-width:640px;background:${TK.paper};color:${TK.ink};font:300 18px/1.5 Georgia,'Times New Roman',serif}a{color:${TK.accent}}.m{color:${TK.muted};font-size:15px}</style></head>
<body><p>This page does not exist.</p><p><a id="home" href="./">Lyα: from gas to forest</a> · <a id="sci" href="./science/">science notes</a></p>
<p class="m">A scene can be linked as …/#beat=7, and a claim as …/science/#thermal-doppler-broadening.</p>
<script>(function () { var s = location.pathname.split('/').filter(Boolean), b = /\.github\.io$/.test(location.hostname) && s.length ? '/' + s[0] + '/' : '/'; document.getElementById('home').href = b; document.getElementById('sci').href = b + 'science/'; })();</script></body></html>\n`);
console.log(`wrote app/dist/lya.html ${(html.length / 1e3).toFixed(0)} kB · ${order.length} modules · ${declared.length} scenes · tokens match the spec; science notes; v${version}`);
