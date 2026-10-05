// Validation of the coordinate convention (SCI-MAP-001/002/003/004) against the distance–redshift oracle.
const fs = require('fs'), path = require('path');
const P = require('../js/lyaphys.js');
const O = JSON.parse(fs.readFileSync(path.join(__dirname, '../validation/mapping/oracle.json')));
const out = { checks: [], cases: [] };
let ok = true;
const check = (name, pass, detail) => { out.checks.push({ name, pass, detail }); if (!pass) ok = false; console.log((pass ? 'ok   ' : 'FAIL ') + name + (detail ? '  ' + detail : '')); };
// 1. per-Mpc/h Hubble velocity equals a H(z) / h, independent of h
for (const c of O.cases) {
  const cosmo = { Om: c.Om, OL: c.OL, h: c.h };
  const js = P.uOfX(c.dx_mpch, 0, c.z0, cosmo);
  out.cases.push({ ...c, u_js: js, rel_vs_map: Math.abs(js - c.u_map) / c.u_map, rel_vs_exact_log: Math.abs(js - c.u_log_exact) / c.u_log_exact, rel_vs_exact_lin: Math.abs(js - c.u_lin_exact) / c.u_lin_exact });
}
const maxRelMap = Math.max(...out.cases.map(c => c.rel_vs_map));
check('JS map equals a·H(z)·Δχ (independent formula)', maxRelMap < 1e-12, `max rel ${maxRelMap.toExponential(1)}`);
const hA = P.uOfX(10, 0, 3, { Om: 0.3, OL: 0.7, h: 0.6 }), hB = P.uOfX(10, 0, 3, { Om: 0.3, OL: 0.7, h: 0.8 });
check('u per Mpc/h independent of h', Math.abs(hA - hB) < 1e-9, `${hA.toFixed(6)} vs ${hB.toFixed(6)} km/s`);
// 2. sign: +v_pec (moving away from observer, toward +x) lands at larger u (redder)
check('v_pec > 0 ⇒ larger u ⇒ longer λ_obs', P.uOfX(2, +50, 3) > P.uOfX(2, 0, 3) && P.lambdaObs(P.uOfX(2, +50, 3), 3) > P.lambdaObs(P.uOfX(2, 0, 3), 3));
// 3. validity of the linear (constant-H) map across a box, vs the exact distance–redshift relation
const rows = {};
for (const c of out.cases) { const k = `${c.dx_mpch}`; rows[k] = Math.max(rows[k] || 0, c.rel_vs_exact_log); }
for (const [dx, r] of Object.entries(rows)) console.log(`      linear map vs exact (log-λ velocity), Δx = ${dx.padStart(5)} Mpc/h: max rel dev ${r.toExponential(2)}`);
out.linear_map_max_rel_dev_by_dx = rows;
check('linear map within 1% of exact over ≤ 20 Mpc/h (z = 2–4)', Object.entries(rows).filter(([d]) => +d <= 20).every(([, r]) => r < 0.01));
// 4. λ_obs: exp(u/c) vs (1+u/c) over a 20 Mpc/h box at z=3
const u20 = P.uOfX(20, 0, 3), dl = Math.abs(Math.exp(u20 / P.C.c_kms) - (1 + u20 / P.C.c_kms));
check('exp(u/c) vs 1+u/c difference over 20 Mpc/h', dl < 1e-4, `${dl.toExponential(2)} (fractional in 1+z)`);
out.pass = ok;
fs.writeFileSync(path.join(__dirname, '../validation/mapping/report.json'), JSON.stringify(out, null, 1));
process.exit(ok ? 0 : 1);
