// Validation of LyaPhys.voigtH against the scipy.special.wofz oracle grid (SCI-VOIGT-001).
// Reports max relative error by region and writes science/validation/voigt/report.json.
const fs = require('fs'), path = require('path');
const P = require('../js/lyaphys.js');
const G = JSON.parse(fs.readFileSync(path.join(__dirname, '../validation/voigt/oracle_grid.json')));
const regions = [
  { name: 'physical a (1e-4 ≤ a ≤ 6.1e-3), core |x| ≤ 4', test: (a, x) => a >= 1e-4 && a <= 6.1e-3 && x <= 4 },
  { name: 'physical a, wings 4 < |x| ≤ 2e4', test: (a, x) => a >= 1e-4 && a <= 6.1e-3 && x > 4 },
  { name: 'tiny a (1e-6 ≤ a < 1e-4), all x', test: (a, x) => a < 1e-4 },
  { name: 'teaching exaggeration (6.1e-3 < a ≤ 1), all x', test: (a, x) => a > 6.1e-3 },
];
const rep = { oracle: G.oracle, scipy: G.scipy_version, numpy: G.numpy_version, n_points: 0, regions: [] };
for (const r of regions) {
  let maxRel = 0, at = null, n = 0, maxAbs = 0;
  G.a.forEach((a, i) => G.x.forEach((x, j) => {
    if (!r.test(a, x)) return;
    const ref = G.H[i][j], js = P.voigtH(a, x);
    if (!(ref > 0)) return;
    const rel = Math.abs(js - ref) / ref; n++;
    if (rel > maxRel) { maxRel = rel; at = { a, x, ref, js }; }
    maxAbs = Math.max(maxAbs, Math.abs(js - ref));
  }));
  rep.regions.push({ region: r.name, n, max_rel_err: maxRel, max_abs_err: maxAbs, worst_at: at });
  rep.n_points += n;
}
rep.pass_criterion = 'max relative error < 1e-3 in every region (the accepted criterion; SCI-VOIGT-001)';
rep.pass = rep.regions.every(r => r.max_rel_err < 1e-3);
fs.writeFileSync(path.join(__dirname, '../validation/voigt/report.json'), JSON.stringify(rep, null, 2));
for (const r of rep.regions) console.log(`${r.region.padEnd(52)} n=${String(r.n).padStart(5)}  max rel ${r.max_rel_err.toExponential(2)}  (a=${r.worst_at && r.worst_at.a.toExponential(2)}, x=${r.worst_at && r.worst_at.x.toPrecision(3)})`);
console.log('PASS', rep.pass);
process.exit(rep.pass ? 0 : 1);
