// VAL-INV-001 — the inverse lookup of Beat 12 (SCI-TAU-003). The contributions the scene traces (lyaphys tauContributions)
// must sum to the spectrum's own τ (tauFromCells, exactly as the app draws it) at every pixel and at any colour in between.
// Also measured: how much of a pixel's τ the display cut leaves untraced (cells under cell_min_fraction; their τ stays in
// the ledger's "rest"). The display thresholds are read from the beat manifest (design/canonical/beats.json, VT-INV-TRACE),
// never typed here. Order: python3 science/tools/build_provenance.py → node science/tests/test_inverse.js → build again.
const fs = require('fs'), path = require('path'), P = require('../js/lyaphys.js');
const sk = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/toy/skewer.json'), 'utf8'));
const beats = JSON.parse(fs.readFileSync(path.join(__dirname, '../../design/canonical/beats.json'), 'utf8'));
const th = beats.beats.find(b => b.n === 12).visual_transforms.find(t => t.id === 'VT-INV-TRACE').thresholds;
const period = P.hubblePerMpch(sk.z, sk.cosmo) * sk.L_mpch;
const ug = P.linspace(0, period, 2049).slice(0, 2048);                       // the app's grid (app/src/data/scene-data.js)
const cells = P.cellsFromSkewer({ z: sk.z, cosmo: sk.cosmo, dx_mpch: sk.dx_mpch, x: sk.x, nHI: sk.nHI, T: sk.T, v: sk.v });
const tau = P.tauFromCells(ug, cells, { period, profile: 'gauss', cut: th.kernel_cut_b });
const checks = []; const check = (name, ok, detail) => { checks.push({ name, ok, detail }); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}  ${detail}`); };
let maxRel = 0; const omitted = [], nParts = [];
for (let i = 0; i < ug.length; i++) {
  const parts = P.tauContributions(ug[i], cells, { period, cut: th.kernel_cut_b }), tot = parts.reduce((s, p) => s + p.tau, 0);
  maxRel = Math.max(maxRel, Math.abs(tot - tau[i]) / Math.max(tau[i], 1e-300));
  omitted.push(parts.filter(p => p.tau <= th.cell_min_fraction * tot).reduce((s, p) => s + p.tau, 0) / tot); nParts.push(parts.length);
}
const r = P.rng(5); let maxRelOff = 0;
for (let k = 0; k < 500; k++) {   // colours between pixels: compare with tauFromCells on a one-point grid
  const u = r() * period, t1 = P.tauFromCells([u], cells, { period, profile: 'gauss', cut: th.kernel_cut_b })[0], tot = P.tauContributions(u, cells, { period, cut: th.kernel_cut_b }).reduce((s, p) => s + p.tau, 0);
  maxRelOff = Math.max(maxRelOff, Math.abs(tot - t1) / Math.max(t1, 1e-300));
}
const sorted = omitted.slice().sort((a, b) => a - b), median = sorted[Math.floor(sorted.length / 2)];
const rep = { pixels: ug.length, max_rel_closure: maxRel, max_rel_closure_between_pixels: maxRelOff, omitted_fraction: { median, max: sorted[sorted.length - 1] }, contributing_cells: { median: nParts.slice().sort((a, b) => a - b)[nParts.length >> 1], max: Math.max(...nParts) }, thresholds: th, checks };
check('Σ contributions = spectrum τ at every pixel (relative < 1e-12)', maxRel < 1e-12, maxRel.toExponential(1));
check('Σ contributions = τ at 500 colours between pixels (relative < 1e-12)', maxRelOff < 1e-12, maxRelOff.toExponential(1));
console.log(`     measured: τ in cells under the ${100 * th.cell_min_fraction} % display cut (kept in “rest”, not traced): median ${(100 * median).toFixed(1)} %, max ${(100 * rep.omitted_fraction.max).toFixed(1)} % of a pixel’s τ`);
rep.pass = checks.every(c => c.ok);
fs.mkdirSync(path.join(__dirname, '../validation/inverse'), { recursive: true });
fs.writeFileSync(path.join(__dirname, '../validation/inverse/report.json'), JSON.stringify(rep, null, 1));
console.log('PASS', rep.pass);
process.exit(rep.pass ? 0 : 1);
