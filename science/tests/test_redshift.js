// VAL-RED-001: frames and redshift (the stretched-spectrum beat). Browser lyaphys.js vs science/oracle/redshift_oracle.py.
const fs = require('fs'), path = require('path'), P = require('../js/lyaphys.js');
const O = JSON.parse(fs.readFileSync(path.join(__dirname, '../validation/redshift/oracle.json'), 'utf8'));
const checks = []; const check = (name, ok, detail) => { checks.push({ name, ok, detail }); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}  ${detail}`); };
let maxRelChi = 0, maxDz = 0;
for (const c of O.chi) {
  const cosmo = { Om: c.Om, OL: c.OL, h: c.h }, chi = P.comovingDistance(c.z, cosmo);
  maxRelChi = Math.max(maxRelChi, Math.abs(chi / c.chi_mpch - 1));
  maxDz = Math.max(maxDz, Math.abs(P.zOfComoving(c.chi_mpch, cosmo) - c.z_back));
}
check('χ(z) vs scipy quad, z ∈ [0.01, 6], Planck 2018 and toy cosmologies: rel. error < 1e-7', maxRelChi < 1e-7, maxRelChi.toExponential(1));
check('z(χ) inverse vs brentq: |Δz| < 1e-8', maxDz < 1e-8, maxDz.toExponential(1));
let maxL = 0; for (const c of O.chi) maxL = Math.max(maxL, Math.abs(P.lambdaObsOfRest(P.C.lambda_A, c.z) / c.lambda_obs_lya - 1), Math.abs(P.lambdaRestOfObs(c.lambda_obs_lya, c.z) / P.C.lambda_A - 1));
check('λ_obs = λ_rest(1+z) and its reverse λ_rest = λ_obs/(1+z): rel. error < 1e-14', maxL < 1e-14, maxL.toExponential(1));
const blue = O.quasar_frame.every(q => P.lambdaRestOfObs(P.lambdaObsOfRest(P.C.lambda_A, q.z_abs), q.z_q) < P.C.lambda_A && Math.abs(P.lambdaRestOfObs(P.lambdaObsOfRest(P.C.lambda_A, q.z_abs), q.z_q) / q.lambda_qframe - 1) < 1e-14);
check('quasar frame: absorption from z_abs < z_q lies blueward of 1215.67 Å (and matches oracle)', blue, `${O.quasar_frame.length} cases`);
let maxU = 0; for (const c of O.log_shift) { const lam = P.lambdaObsOfRest(P.C.lambda_A, c.z_abs); maxU = Math.max(maxU, Math.abs(P.lambdaObs(c.u, c.z0) / lam - 1)); }
check('log-λ: the stretch to z_abs equals the velocity u = c ln((1+z_abs)/(1+z0)) on the SCI-MAP-004 axis', maxU < 1e-14, maxU.toExponential(1));
let maxF = 0, ordered = true; const fw = O.forest || [];
for (const c of fw) { const le = P.lambdaEmitAbsorbed(c.z_abs, c.z_q); maxF = Math.max(maxF, Math.abs(le / c.lambda_emit - 1), Math.abs(P.lambdaLocal(le, c.z_q, c.z_abs) / P.C.lambda_A - 1), Math.abs(P.lambdaLocal(le, c.z_q, 0) / c.lambda_obs - 1)); }
for (const zq of [3.2, 4.0]) { const obs = fw.filter(c => c.z_q === zq).sort((a, b) => a.z_abs - b.z_abs).map(c => P.lambdaLocal(P.lambdaEmitAbsorbed(c.z_abs, zq), zq, 0)); for (let i = 1; i < obs.length; i++) if (!(obs[i] > obs[i - 1])) ordered = false; }
check('forest written along the way: each absorber takes λ_e = 1215.67(1+z_abs)/(1+z_q), which is exactly 1215.67 Å locally and 1215.67(1+z_abs) Å at us; higher z → redder', fw.length > 0 && maxF < 1e-14 && ordered, `${fw.length} cases, ${maxF.toExponential(1)}`);
const z3 = P.lambdaObsOfRest(P.C.lambda_A, 3), hub3 = P.hubblePerMpch(3);
const rep = { oracle: O.generated,   // no run date: the report must be reproducible (it is embedded in the app)
  max_rel_chi: maxRelChi, max_dz_inverse: maxDz, max_rel_lambda: maxL,
  lambda_obs_lya_z3: z3, hubble_per_mpch_z3: hub3, chi_z3_planck_mpch: P.comovingDistance(3), checks, pass: checks.every(c => c.ok) };
fs.mkdirSync(path.join(__dirname, '../validation/redshift'), { recursive: true });
fs.writeFileSync(path.join(__dirname, '../validation/redshift/report.json'), JSON.stringify(rep, null, 1));
console.log('PASS', rep.pass, ` (Lyα at z = 3 → ${z3.toFixed(2)} Å; χ(3) = ${rep.chi_z3_planck_mpch.toFixed(1)} Mpc/h, Planck 2018)`);
