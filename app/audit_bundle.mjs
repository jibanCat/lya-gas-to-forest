// The review bundle: the public app as a user sees it, rendered — never its source, design history or rationale.
// For every beat, a series of states (each a reproducible URL), each with a screenshot and a transcript of everything the
// page shows as text: the margin, the figure's accessible description, "show the physics", microscopes, the "sources &
// assumptions" sheet, the footer. A neutral caption says what the user did to reach each state. Also the public science
// notes, as text and a few screenshots. Writes <out>/MANIFEST.md listing every file. Run python3 app/audit_sheets.py <out>
// afterwards to compose one sheet per beat. Usage: node app/audit_bundle.mjs <out>
import fs from 'node:fs'; import path from 'node:path'; import { execSync } from 'node:child_process'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
const here = path.dirname(new URL(import.meta.url).pathname), [out] = process.argv.slice(2);
if (!out) throw new Error('usage: node app/audit_bundle.mjs <out>');
fs.mkdirSync(out, { recursive: true });
// [beat, [[file, hash, caption]]] — the caption describes the user's action, never its purpose
const S = [
  [0, [['a-start', 'beat=0', 'the page as first shown'], ['b-hint', 'beat=0&hints=b0.beam&aff=beam:hover', 'the first-use hint, with the pointer near the beam'], ['c-moved', 'beat=0&px=15.5', 'after sliding the pointer along the beam to the right'], ['d-turned', 'beat=0&yaw=-0.4&tilt=0.8&px=15.5', 'after dragging the gas to turn the volume'], ['e-physics', 'beat=0&adv=1', '“show the physics” switched on']]],
  [1, [['a-start', 'beat=1', 'the page as first shown'], ['b-parcel', 'beat=1&zoom=0.34', 'magnification set to “parcel”'], ['c-particles', 'beat=1&zoom=0.67', 'magnification set to “particles”'], ['d-atoms', 'beat=1&zoom=1', 'magnification set to “atoms”'], ['e-physics', 'beat=1&zoom=1&adv=1', '“show the physics” switched on']]],
  [2, [['a-start', 'beat=2&hints=b2.push&aff=atom:hover', 'the page as first shown, with the first-use hint'], ['b-pushed', 'beat=2&v=-22', 'after dragging the atom’s arrow to the left'], ['c-zero', 'beat=2&v=0', 'after dragging the arrow back to the atom'], ['d-many', 'beat=2&mode=many', 'view switched to “one colour, many atoms”'], ['e-physics', 'beat=2&adv=1', '“show the physics” switched on']]],
  [3, [['a-forming', 'beat=3&stage=2', 'part-way through the first animation (marks being written)'], ['b-hint', 'beat=3&hints=b3.warm&aff=parcel:hover', 'after the first animation, with the first-use hint'], ['c-held', 'beat=3&T=42000', 'after pressing and holding the gas for about 5 seconds'], ['d-cooled', 'beat=3&T=4000', 'after holding the gas and dragging downward'], ['e-bin', 'beat=3&_vb=6&_vbPin=true', 'after touching one column of the census'], ['f-physics', 'beat=3&adv=1', '“show the physics” switched on']]],
  [4, [['a-step1', 'beat=4&stage=1', 'step 1'], ['b-step2', 'beat=4&stage=2', 'step 2'], ['c-step3', 'beat=4&stage=3', 'step 3'], ['d-step4', 'beat=4&stage=4', 'step 4'], ['e-physics', 'beat=4&stage=4&adv=1&T=40000', '“show the physics” on, temperature set to 4×10⁴ K']]],
  [5, [['a-start', 'beat=5&stage=1&hints=b5.light&aff=light:hover', 'the page as first shown, with the first-use hint'], ['b-midway', 'beat=5&stage=3', 'after dragging the light part of the way toward us (step 3)'], ['c-later', 'beat=5&stage=5', 'after dragging the light further (step 5)'], ['d-arrived', 'beat=5&stage=6', 'the light has arrived (step 6)'], ['e-shadow', 'beat=5&stage=7', 'step 7'], ['f-physics-frame', 'beat=5&stage=6&adv=1&frame=absorber', '“show the physics” on; the recorded spectrum expressed in the selected structure’s frame'], ['g-physics-quasar', 'beat=5&stage=6&adv=1&frame=quasar', '“show the physics” on; expressed in the quasar’s frame']]],
  [6, [['a-hint', 'beat=6&hints=b6.place&aff=body:hover', 'the page after its first animation, with the first-use hint'], ['b-moved', 'beat=6&x=1.6&ref=sim&last=place', 'after pressing the gas and sliding it left along the beam'], ['c-pushed', 'beat=6&v=-60&ref=sim&last=motion', 'after dragging the gas’s arrow to the left'], ['d-warmed', 'beat=6&T=60000&ref=sim&last=width', 'after pressing and holding the gas'], ['e-amount', 'beat=6&logN=14.57&ref=sim&last=amount', 'after dragging the “how much neutral hydrogen” control to the right'], ['f-physics', 'beat=6&adv=1', '“show the physics” switched on']]],
  [7, [['a-expansion', 'beat=7&mode=expansion', 'after pressing “expansion alone”'], ['b-sim', 'beat=7&hints=b7.vpec&aff=vel:b:hover', 'the toy’s velocities, with the first-use hint'], ['c-pushed', 'beat=7&vb=190&_dragP=b', 'after dragging parcel b’s arrow to the right'], ['c2-gas-dragged', 'beat=7', 'after pressing parcel b’s gas (not its arrow) and dragging it to the right', dragFig([740.7, 150], [830, 150])], ['d-scan', 'beat=7&_uh=455&_uhPin=true', 'after touching the velocity-space strip at one point'], ['e-physics', 'beat=7&adv=1', '“show the physics” switched on']]],
  [8, [['a-3', 'beat=8&nc=3', '“3 parcels” chosen'], ['b-12', 'beat=8&nc=12', '“12” chosen'], ['c-48', 'beat=8&nc=48', '“48” chosen'], ['d-full', 'beat=8&nc=225', '“full sampling” chosen'], ['e-physics', 'beat=8&adv=1', '“show the physics” switched on']]],
  [9, [['a-stacked', 'beat=9', 'after the stacking animation'], ['b-wrong', 'beat=9&wrong=true', '“what if dips added instead?” switched on'], ['c-physics', 'beat=9&adv=1', '“show the physics” switched on']]],
  [10, [['a-start', 'beat=10&hints=b10.loupe&aff=loupe:hover', 'the page as first shown, with the first-use hint'], ['b-dense', 'beat=10&pu=452', 'after moving the lens over a dark part of the sheet'], ['c-thin', 'beat=10&pu=150', 'after moving the lens over a pale part of the sheet'], ['d-physics', 'beat=10&adv=1', '“show the physics” switched on']]],
  [11, [['a-start', 'beat=11', 'the page as first shown'], ['b-blur', 'beat=11&fwhm=70&_obs=true', 'resolution set to 70 km/s'], ['c-noise', 'beat=11&fwhm=70&snr=5&_obs=true', 'signal-to-noise set to 5'], ['d-physics', 'beat=11&adv=1', '“show the physics” switched on']]],
  [12, [['a-tracing', 'beat=12&hints=b12.scan&aff=scan:hover', 'after the first slow trace, with the first-use hint'], ['b-colour', 'beat=12&pu=505', 'after pressing the spectrum at one colour'], ['c-other', 'beat=12&pu=1280', 'after sliding to another colour'], ['d-gas', 'beat=12&_rx=9.9&_rxPin=true', 'after touching the gas strip at one place'], ['e-physics', 'beat=12&adv=1', '“show the physics” switched on']]],
  [13, [['a-predict', 'beat=13&hints=b13.pick', 'step 1, with the first-use hint'], ['b-picked', 'beat=13&pick=ii', 'after choosing the second gas'], ['c-reveal', 'beat=13&phase=reveal&pick=ii', 'step 2'], ['d-break', 'beat=13&phase=break&metal=true&lyb=true', 'step 3, both extra lines added'], ['e-physics', 'beat=13&phase=break&adv=1', '“show the physics” switched on']]],
];
// a live gesture for a state that a URL cannot express: press at a figure point, drag to another, release (figure → page: stage at scale 1)
function dragFig([x0, y0], [x1, y1]) { return async page => { await page.mouse.move(340 + x0, 70 + y0); await page.mouse.down(); for (let k = 1; k <= 12; k++) { await page.mouse.move(340 + x0 + (x1 - x0) * k / 12, 70 + y0 + (y1 - y0) * k / 12); await page.waitForTimeout(16); } await page.mouse.up(); await page.mouse.move(5, 5); }; }
const browser = await chromium.launch(), page = await browser.newPage({ viewport: { width: 1440, height: 880 }, deviceScaleFactor: 1.25 }), errs = [];
page.on('pageerror', e => errs.push(e.message));
const files = []; let q = 0;
async function state(dir, file, hash, act) {
  await page.goto('file://' + path.join(here, 'dist/lya.html') + `?b=${q++}#${hash}&shoot=1`);
  await page.waitForFunction(() => document.body.dataset.ready === '1', null, { timeout: 60000 }); await page.waitForTimeout(200);
  if (act) { await act(page); await page.waitForTimeout(900); }   // the live description updates within 0.7 s
  await page.screenshot({ path: path.join(dir, file + '.png') }); files.push(path.relative(out, path.join(dir, file + '.png')));
  return page.evaluate(() => {
    const t = id => { const el = document.getElementById(id); return el && !el.classList.contains('hidden') && el.offsetParent !== null ? el.innerText.trim() : ''; };
    return { margin: t('margin'), figure: document.getElementById('cv').getAttribute('aria-label') || '', described: document.getElementById('live').textContent.trim(), micro: t('micro'), sources: t('srcp'), foot: t('foot') };
  });
}
for (const [n, states] of S) {
  const dir = path.join(out, `beat-${String(n).padStart(2, '0')}`); fs.mkdirSync(dir, { recursive: true });
  const T = [`# Beat ${n}`, '', 'Screenshots of this page in several states, in order. Each state lists what the page shows as text.', ''];
  for (const [file, hash, caption, act] of states) {
    const s = await state(dir, file, hash, act);
    T.push(`## ${file} — ${caption}`, '', `Screenshot: \`${file}.png\``, '', '**Margin (left column):**', '', s.margin, '', `**Figure, as described to a screen reader:** ${s.described}`, '', `**Footer:** ${s.foot}`, '');
  }
  const micros = (await page.evaluate(() => [...document.querySelectorAll('.whylink')].map(b => b.dataset.fk.slice(2)))) || [];
  for (const key of micros) { const s = await state(dir, `m-${key}`, `beat=${n}&micro=${key}`); T.push(`## m-${key} — a “why?” link opened`, '', `Screenshot: \`m-${key}.png\``, '', s.micro, ''); }
  const src = await state(dir, 'z-sources', `beat=${n}&src=1`); T.push('## z-sources — the “sources & assumptions” link opened', '', 'Screenshot: `z-sources.png`', '', src.sources, '');
  fs.writeFileSync(path.join(dir, 'transcript.md'), T.join('\n')); files.push(path.relative(out, path.join(dir, 'transcript.md')));
  console.log('beat', n, states.length + micros.length + 1, 'states');
}
// the public science notes: text, and the first screens
await page.goto('file://' + path.join(here, 'dist/science/index.html')); await page.waitForTimeout(500);
fs.writeFileSync(path.join(out, 'science-notes.txt'), await page.evaluate(() => document.body.innerText)); files.push('science-notes.txt');
for (const [f, a] of [['science-notes-top', ''], ['science-notes-claim', '#thermal-doppler-broadening'], ['science-notes-accuracy', '#accuracy']]) {
  await page.goto('file://' + path.join(here, 'dist/science/index.html') + a); await page.waitForTimeout(400); await page.screenshot({ path: path.join(out, f + '.png') }); files.push(f + '.png');
}
await browser.close();
const M = ['# Blind-audit bundle', '', 'What a user of the public app sees, rendered: per beat, screenshots of states (with what the user did to reach each) and transcripts of all on-screen text; the public science notes. No source code, design history or rationale is included.', '', `Generated from app/dist (version ${JSON.parse(fs.readFileSync(path.join(here, '../design/canonical/public_provenance.json'))).site.version}).`, '', '## Files', '', ...files.map(f => `- ${f}`), ''];
fs.writeFileSync(path.join(out, 'MANIFEST.md'), M.join('\n'));
console.log(`bundle: ${files.length} files → ${out}; page errors: ${errs.length ? errs.slice(0, 3) : 'none'}`);
