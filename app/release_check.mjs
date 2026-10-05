// Release check for the static site in app/dist/ (run after the build; no network):
//   links    every in-page anchor of the science notes resolves; every link from a scene's "sources & assumptions" sheet
//            reaches an anchor that exists in the notes; beat links name real beats; linked reports exist; external links
//            are absolute https URLs (http is reported); every beat has a sheet
//   assets   every vendored file matches its sha256 in app/vendor/VENDOR.md; every licence text exists; every vendored
//            asset is listed in THIRD_PARTY_LICENSES.md; the pages load nothing from the network
//   version  the app, the notes and CITATION.cff carry the same version
//   wording  phrasings that misled readers in review, and ambiguous uses of
//            the canonical glossary's terms (design/canonical/glossary.json), do not
//            come back anywhere in the app or the notes, and the canonical definitions are present
// Usage: node app/release_check.mjs        (exit 1 on any failure)
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
const here = path.dirname(new URL(import.meta.url).pathname), root = path.join(here, '..'), dist = path.join(here, 'dist');
const fails = [], warns = []; const fail = m => fails.push(m), warn = m => warns.push(m);
const rd = p => fs.readFileSync(p, 'utf8');
// ---------------------------------------------------------------------------------------------- the pages
const notes = rd(path.join(dist, 'science/index.html')), app = rd(path.join(dist, 'lya.html'));
const ids = new Set([...notes.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
const prov = JSON.parse(rd(path.join(root, 'design/canonical/public_provenance.json')));
let nInternal = 0, nExternal = 0;
for (const m of notes.matchAll(/href="([^"]*)"/g)) {
  const h = m[1].replace(/&amp;/g, '&');
  if (h.startsWith('#')) { nInternal++; if (!ids.has(h.slice(1))) fail(`science notes: link to missing anchor ${h}`); }
  else if (h.startsWith('../lya.html')) { const b = (h.match(/beat=(\d+)/) || [])[1]; if (b != null && !prov.beats[b]) fail(`science notes: link to beat ${b}, which does not exist`); }
  else if (h.startsWith('../licenses/')) { if (!fs.existsSync(path.join(dist, h.slice(3)))) fail(`science notes: licence link ${h} is missing`); }
  else if (h.startsWith('validation/')) { if (!fs.existsSync(path.join(dist, 'science', h))) fail(`science notes: linked report ${h} is missing`); }
  else if (/^https:\/\//.test(h)) nExternal++;
  else if (/^http:\/\//.test(h)) { nExternal++; warn(`science notes: plain-http link ${h}`); }
  else fail(`science notes: unexpected link ${h}`);
}
// the sheets: every [[#anchor|…]] in a beat's public provenance, every source and check, every claim
for (const [n, b] of Object.entries(prov.beats)) {
  const anchors = [...JSON.stringify(b).matchAll(/\[\[#([a-z0-9-]+)\|/g)].map(m => m[1]).concat(b.sources.map(s => s.ref), b.validations, b.entries.map(e => e.anchor));
  for (const a of anchors) { nInternal++; if (!ids.has(a)) fail(`beat ${n} sheet: links to #${a}, which the science notes do not contain`); }
}
for (let n = 0; n <= 13; n++) if (!prov.beats[String(n)]) fail(`beat ${n} has no "sources & assumptions" sheet`);
if (!ids.has('scenes')) fail('science notes: the "by scene" anchor the sheets link to is missing');
// nothing loaded from the network (navigational links are fine)
for (const [name, html] of [['lya.html', app], ['science/index.html', notes]]) {
  const loads = [...html.matchAll(/<(?:script|link|img|iframe|source)\b[^>]*\s(?:src|href)="(https?:[^"]+)"/g)].map(m => m[1]).concat([...html.matchAll(/url\((["']?)https?:[^)]*\)/g)].map(m => m[0]));
  if (loads.length) fail(`${name} loads from the network: ${loads.slice(0, 3).join(', ')}`);
}
// ---------------------------------------------------------------------------------------------- vendored assets and licences
const vendor = path.join(here, 'vendor'), vmd = rd(path.join(vendor, 'VENDOR.md'));
const sums = [...vmd.matchAll(/^([0-9a-f]{64})\s+(\S+)$/gm)];
if (!sums.length) fail('VENDOR.md lists no checksums');
for (const [, sum, rel] of sums) {
  const f = path.join(vendor, rel); if (!fs.existsSync(f)) { fail(`vendored file missing: ${rel}`); continue; }
  if (crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex') !== sum) fail(`vendored file changed: ${rel}`);
}
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.relative(vendor, path.join(d, e.name))]);
const listed = new Set(sums.map(m => m[2]));
for (const f of walk(vendor)) if (f !== 'VENDOR.md' && !listed.has(f)) warn(`vendored file without a checksum in VENDOR.md: ${f}`);
const tpl = path.join(root, 'THIRD_PARTY_LICENSES.md');
if (!fs.existsSync(tpl)) fail('THIRD_PARTY_LICENSES.md is missing');
else { const t = rd(tpl); for (const name of ['Fraunces', 'Inter', 'IBM Plex Mono', 'KaTeX']) if (!t.includes(name)) fail(`THIRD_PARTY_LICENSES.md does not list ${name}`);
  for (const l of fs.readdirSync(path.join(vendor, 'LICENSES'))) if (!t.includes(l)) fail(`THIRD_PARTY_LICENSES.md does not point to LICENSES/${l}`); }
for (const l of fs.readdirSync(path.join(vendor, 'LICENSES'))) if (!fs.existsSync(path.join(dist, 'licenses', l))) fail(`the published site lacks licenses/${l}`);
for (const [name, html] of [['lya.html', app], ['science/index.html', notes]]) if (!/Licence texts: (?:\.\.\/)?licenses\//.test(html)) fail(`${name} does not name the embedded assets' licences`);
// ---------------------------------------------------------------------------------------------- audited wording
// phrasings that misled readers, and the canonical definitions that must stay; each with the reason it matters
const RETIRED = [
  ['grab the gas or its arrow', 'in Beat 7 only the velocity arrow carries motion; the gas is selected'],
  ['push the gas: drag its motion', 'the hint names the velocity arrow'],
  ['its neutral hydrogen (ink)', 'ink is a contribution to optical depth, never neutral hydrogen'],
  ['ink: neutral atoms', 'ink is a contribution to optical depth'], ['ink dots', 'ink is a contribution to optical depth'], ['ink: each parcel', 'ink is a contribution to optical depth'],
  ['relative to measured (z ≈ 3)', 'the microscope’s ×1 is the toy’s tuned ultraviolet background'],
  ['at the measured ultraviolet', 'the toy’s ultraviolet background is tuned, not measured'],
  ['along the whole sightline: the Lyman-alpha forest', 'Beat 11 shows a 20 Mpc/h toy stretch'], ['A real forest emerges', 'Beat 11 shows a toy stretch, not a real forest'],
  ['(and the atomic profile) set its spread', 'the parcel’s size (the Hubble flow across it) sets its width too'],
  ['heat spreads it', 'heat is one of two widths'], ['Ink: e^(', 'the transmitted flux is never ink'], ['place its opacity', 'cells place optical depth'], ['the Hubble flow across the parcel\'s size the rest', 'the two widths add in quadrature'],
  ['the simulation’s velocities', 'a toy, not a simulation'], ['simulation’s range', 'a toy, not a simulation'], ['the simulated sample', 'a toy, not a simulation'], ['back to the simulation’s parcel', 'a toy, not a simulation'],
];
const REQUIRED = [
  ['its ink: its contribution to optical depth τ', 'the canonical definition, where Beat 6 draws ink'],
  ['heat alone b = ', 'Beat 6 prints heat alone beside the drawn line'], ['the Hubble flow across it', 'the second width, named'],
  ['Gpc/h to us', 'the distance to us at the observer’s end'], ['not to scale', 'the broken beam is declared not to scale'],
  ['tuned, not measured', 'the toy’s ultraviolet background is declared'], ['a calibration, not a test', 'the mean-flux check is public as a calibration'],
  ['drag its arrow', 'Beat 7 names the velocity arrow'], ['one beam — its colours drawn apart for clarity', 'Beat 2’s rows are one beam'],
  ['heat broadens light atoms more than heavy ions;', 'why Si IV breaks the tie'], ['under expansion alone', 'the Hubble-flow baseline is named'], ['redward of 1215.67 Å', 'where every forest shadow lies'],
  ['denser part of the continuous gas', 'structures and clouds are parts of continuous gas'], ['scattering that colour out of the beam', 'absorption is resonant scattering'],
  ['where its ink appears in the spectrum, not where the gas is', 'where a parcel lands is not where its gas is'],
];
let nWording = 0;
// the canonical public glossary (design/canonical/glossary.json): ambiguous uses of its terms must not reach a reader
const GLOSSARY = JSON.parse(rd(path.join(root, 'design/canonical/glossary.json')));
for (const t of GLOSSARY.terms) for (const x of t.prohibited) for (const [name, html] of [['lya.html', app], ['science/index.html', notes]]) { nWording++; if (html.includes(x.phrase)) fail(`${name}: “${x.phrase}” — ambiguous use of “${t.term}” (${x.why}; design/canonical/glossary.json)`); }
for (const [t, why] of RETIRED) for (const [name, html] of [['lya.html', app], ['science/index.html', notes]]) { nWording++; if (html.includes(t)) fail(`${name}: retired wording “${t}” is back (${why})`); }
for (const [t, why] of REQUIRED) { nWording++; if (!app.includes(t) && !notes.includes(t)) fail(`audited wording missing: “${t}” (${why})`); }
// ---------------------------------------------------------------------------------------------- one version everywhere
const v = prov.site.version, cff = fs.existsSync(path.join(root, 'CITATION.cff')) ? rd(path.join(root, 'CITATION.cff')) : '';
if (!app.includes(`<meta name="lya-version" content="${v}">`)) fail(`lya.html does not carry version ${v}`);
if (!notes.includes(`v${v}`)) fail(`science notes do not carry version ${v}`);
if (!cff) fail('CITATION.cff is missing'); else if (!new RegExp(`^version:\\s*"?${v.replace(/\./g, '\\.')}"?\\s*$`, 'm').test(cff)) fail(`CITATION.cff version is not ${v}`);
console.log(`release check: ${nInternal} internal links, ${nExternal} external links, ${sums.length} vendored files, ${nWording} wording checks, version ${v}; ${fails.length} failures, ${warns.length} warnings`);
for (const w of warns) console.log('  warn', w);
for (const f of fails) console.log('  FAIL', f);
process.exit(fails.length ? 1 : 0);
