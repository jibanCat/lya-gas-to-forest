// The surface control audit, generated from the running app (not written by hand): for every beat, every visible control
// in the margin and every physical object in the figure, classified by the role its scene declares —
//   physical gesture (an object in the figure, linked to its INT record) · readout · explicit instrument ·
//   advanced precision ("show the physics", microscopes) · narrative & representation (steps, replays, resets, views)
// Fails (exit 1) on a generic slider (a ruler with no role), an unclassified control, an object without an INT record, or
// an INT record that names no control on the page. Writes docs/SURFACE_AUDIT.md.
// Usage: node app/audit.mjs
import fs from 'node:fs'; import path from 'node:path'; import { execSync } from 'node:child_process'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
const here = path.dirname(new URL(import.meta.url).pathname), root = path.join(here, '..');
const beats = JSON.parse(fs.readFileSync(path.join(root, 'design/canonical/beats.json'), 'utf8')).beats;
const INT = Object.fromEntries(beats.flatMap(b => (b.interactions || []).map(t => [t.id, { ...t, beat: b.n }])));
const EXTRA = { 2: ['mode=many'], 4: ['stage=4'], 5: ['stage=6'], 13: ['phase=break'] };   // states where more controls appear
const CLASS = { readout: 'readout', instrument: 'explicit instrument', advanced: 'advanced precision', step: 'narrative', replay: 'narrative', reset: 'narrative', baseline: 'narrative', view: 'representation', representation: 'representation', counterfactual: 'representation' };
const browser = await chromium.launch(), page = await browser.newPage({ viewport: { width: 1440, height: 880 } }), errs = [];
page.on('pageerror', e => errs.push(e.message));
let q = 0;
async function load(hash) {
  await page.goto('file://' + path.join(here, 'dist/lya.html') + `?a=${q++}#${hash}&shoot=1`);
  await page.waitForFunction(() => document.body.dataset.ready === '1', null, { timeout: 60000 });
}
const margin = sel => page.$$eval(`${sel} .ctl`, els => els.map(e => {
  const lab = e.querySelector('.clab'), btn = e.querySelector('button'), rul = e.querySelector('.rul');
  const label = lab ? [...lab.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim() : btn ? btn.textContent.replace(/^[●○]\s*/, '').trim() : '';
  return { role: e.dataset.role, why: e.dataset.why || '', int: e.dataset.int || null, label, operable: rul ? !rul.classList.contains('ro') || rul.classList.contains('op') : null, kind: rul ? 'ruler' : e.querySelector('[role=radiogroup]') ? 'choice' : e.querySelector('[role=switch]') ? 'toggle' : 'button' };
}));
const rows = [], problems = [], seenInt = new Set();
for (const b of beats) {
  const n = b.n, found = new Map();
  const add = (where, c) => { const k = c.kind === 'object' ? `obj|${c.id}|${c.int}` : `${c.kind}|${c.label}|${c.role}`; if (!found.has(k)) found.set(k, { where, ...c }); else if (c.kind === 'object' && c.hint && !found.get(k).hint) Object.assign(found.get(k), { label: c.hint, hint: c.hint }); if (c.int && c.kind !== 'object') c.int.split(' · ').forEach(id => seenInt.add(id)); };
  for (const [mode, hash] of [['surface', `beat=${n}`], ...(EXTRA[n] || []).map(e => ['surface', `beat=${n}&${e}`]), ['show the physics', `beat=${n}&adv=1`], ...(EXTRA[n] || []).map(e => ['show the physics', `beat=${n}&adv=1&${e}`])]) {
    await load(hash);
    for (const c of await margin('#ctrl')) add(mode, c);
    for (const o of await page.evaluate(() => window.__lyaAffs())) add(mode, { kind: 'object', label: o.hint || o.name || o.id.replace(/:.*/, ' (each)'), hint: o.hint, role: o.role || 'gesture', int: o.int, aff: o.kind, id: o.id.replace(/:.*/, ':…') });
  }
  for (const key of (b.micro || []).map(m => m.key)) { await load(`beat=${n}&micro=${key}`); for (const c of await margin('#mctrl')) add(`microscope “${key}”`, { ...c, role: c.role === 'slider' ? 'microscope' : c.role }); }
  for (const c of found.values()) {
    let cls, note = c.why;
    if (c.kind === 'object') {
      if (c.role === 'predict') { cls = 'narrative'; note = 'a choice of answer (a prediction), not a physical state'; }
      else {
        const ids = (c.int || '').split(' · ').filter(Boolean);
        if (!ids.length) problems.push(`beat ${n}: object ${c.id} has no INT record`);
        ids.forEach(id => { if (!INT[id]) problems.push(`beat ${n}: object ${c.id} names unknown ${id}`); seenInt.add(id); });
        cls = ids.length && ids.every(id => INT[id] && INT[id].inspection) ? 'physical gesture (inspection)' : 'physical gesture';
        note = ids.map(id => INT[id] ? `${id}: ${(INT[id].gesture || {}).type} — ${INT[id].variable}` : id).join('; ');
      }
    } else if (c.role === 'microscope') { cls = 'advanced precision'; note = note || 'a microscope sweeps one variable for controlled, quantitative exploration'; }
    else if (CLASS[c.role]) cls = CLASS[c.role];
    else { cls = c.role === 'slider' ? 'GENERIC SLIDER' : 'UNCLASSIFIED'; problems.push(`beat ${n}: ${c.kind} “${c.label}” — ${cls.toLowerCase()} (role ${c.role}, no justification)`); }
    if (c.role === 'readout') note = `reports the physical state; ${c.operable ? 'operable' : 'takes a precise value only after the gesture is learned, or with “show the physics”'}`;
    if (['explicit instrument', 'advanced precision', 'narrative', 'representation'].includes(cls) && !note) problems.push(`beat ${n}: ${c.kind} “${c.label}” (${cls}) has no stated reason`);
    rows.push({ n, title: b.title, where: c.where, kind: c.kind === 'object' ? `figure: ${c.aff}` : `margin: ${c.kind}`, label: c.label, cls, note });
  }
}
for (const id of Object.keys(INT)) if (!seenInt.has(id) && !INT[id].reuses) {
  const used = rows.some(r => r.note.includes(id)); if (!used) problems.push(`${id} (Beat ${INT[id].beat}) names no object found on the page`);
}
await browser.close();
const esc = s => String(s).replace(/\|/g, '\\|');
const count = cls => rows.filter(r => r.cls.startsWith(cls)).length;
const L = ['# Surface control audit', '', '*GENERATED by `node app/audit.mjs` from the running app (every beat on the surface, with “show the physics”, in the states where more controls appear, and every microscope). Classes come from the role each scene declares; a ruler with no role, or a control without a stated reason, fails the audit.*', '',
  `**${rows.length} controls:** ${count('physical gesture')} physical gestures (${count('physical gesture (inspection)')} of them inspection), ${count('readout')} readouts, ${count('explicit instrument')} explicit instruments, ${count('advanced precision')} advanced precision controls, ${count('narrative')} narrative and ${count('representation')} representation controls. **Generic sliders: ${count('GENERIC')}.** ${problems.length ? `**Problems: ${problems.length}.**` : 'No problems.'}`, ''];
for (const b of beats) {
  const rs = rows.filter(r => r.n === b.n); if (!rs.length) continue;
  L.push(`## Beat ${b.n} · ${b.title}`, '', '| where | control | class | why / what it changes |', '|---|---|---|---|');
  for (const r of rs) L.push(`| ${esc(r.where)} · ${esc(r.kind)} | ${esc(r.label)} | ${esc(r.cls)} | ${esc(r.note)} |`);
  L.push('');
}
if (problems.length) L.push('## Problems', '', ...problems.map(p => `- ${p}`), '');
fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
fs.writeFileSync(path.join(root, 'docs/SURFACE_AUDIT.md'), L.join('\n'));
console.log(`audit: ${rows.length} controls · gestures ${count('physical gesture')} · readouts ${count('readout')} · instruments ${count('explicit instrument')} · advanced ${count('advanced precision')} · narrative ${count('narrative')} · representation ${count('representation')} · generic sliders ${count('GENERIC')} · problems ${problems.length}; page errors: ${errs.length ? errs.join(' | ') : 'none'}`);
for (const p of problems) console.log('  ' + p);
process.exit(problems.length || errs.length ? 1 : 0);
