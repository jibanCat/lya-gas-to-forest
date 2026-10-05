// Validation of LyaPhys.tauFromCells / tau0 / σ_v against the exact-Voigt τ oracle (SCI-TAU-001/002/003, SCI-SAT-001).
const fs = require('fs'), path = require('path');
const P = require('../js/lyaphys.js');
const O = JSON.parse(fs.readFileSync(path.join(__dirname, '../validation/tau/oracle.json')));
const rep = { cases: [], checks: [] }; let ok = true;
const check = (name, pass, detail) => { rep.checks.push({ name, pass, detail }); if (!pass) ok = false; console.log((pass ? 'ok   ' : 'FAIL ') + name + (detail ? '  ' + detail : '')); };
check('σ_v matches oracle', Math.abs(P.C.sigma_v / O.sigma_v - 1) < 1e-12, P.C.sigma_v.toExponential(6));
check('γ_v (natural HWHM) matches oracle', Math.abs(P.C.gamma_kms / O.gamma_v - 1) < 1e-12, P.C.gamma_kms.toFixed(6) + ' km/s');
for (const c of O.cases) {
  const cells = c.lines.map(l => ({ u: l.u, N: l.N, b: l.b }));
  for (const mode of ['point', 'bin']) {
    const ref = mode === 'point' ? c.tau_point : c.tau_bin;
    const js = P.tauFromCells(c.ugrid, cells, { period: c.period, sample: mode, nsub: mode === 'bin' ? 16 : 1, tauFloor: 1e-8 });
    let maxRelTau = 0, maxDF = 0;
    ref.forEach((r, i) => { if (r > 1e-6 && r < 1e4) maxRelTau = Math.max(maxRelTau, Math.abs(js[i] - r) / r); maxDF = Math.max(maxDF, Math.abs(Math.exp(-js[i]) - Math.exp(-r))); });
    rep.cases.push({ name: c.name, mode, max_rel_tau: maxRelTau, max_abs_dF: maxDF });
    console.log(`      ${c.name.padEnd(42)} ${mode.padEnd(5)} max rel τ ${maxRelTau.toExponential(1)}  max |ΔF| ${maxDF.toExponential(1)}`);
  }
}
const pts = rep.cases.filter(c => c.mode === 'point');
check('point sampling: max rel τ < 1e-3 and |ΔF| < 1e-4 for every case', pts.every(c => c.max_rel_tau < 1e-3 && c.max_abs_dF < 1e-4));
const bins = rep.cases.filter(c => c.mode === 'bin');
check('bin averaging (16 sub-samples) vs exact bin average: |ΔF| < 2e-3', bins.every(c => c.max_abs_dF < 2e-3), 'largest: ' + Math.max(...bins.map(c => c.max_abs_dF)).toExponential(1));
// normalisation and τ0
const ug = P.linspace(-400, 400, 8001), t = P.tauFromCells(ug, [{ u: 0, N: 1e13, b: 20 }]);
const integral = t.reduce((s, v) => s + v, 0) * (ug[1] - ug[0]);
check('∫τ du = N σ_v (equivalent width of optically thin line)', Math.abs(integral / (1e13 * P.C.sigma_v) - 1) < 2e-3, `ratio ${(integral / (1e13 * P.C.sigma_v)).toFixed(5)}`);
check('τ0 = 0.758 (N/1e13)(10/b)', Math.abs(P.tau0(1e13, 10) - 0.758) < 1e-3, P.tau0(1e13, 10).toFixed(5));
// damping-wing τ=1 half-width ≈ sqrt(σ_v γ_v N / π) — derived from the Lorentzian asymptote, independent of b
for (const N of [1e19, 2e20]) {
  const w = Math.sqrt(P.C.sigma_v * P.C.gamma_kms * N / Math.PI);
  const g = P.linspace(0, 5 * w, 20001), tt = P.tauFromCells(g, [{ u: 0, N, b: 25 }]);
  let cross = 0; for (let i = 0; i < g.length; i++) if (tt[i] < 1) { cross = g[i]; break; }
  check(`wing τ=1 at Δu ≈ √(σ_v γ_v N/π) for N=${N.toExponential(0)}`, Math.abs(cross / w - 1) < 0.02, `numeric ${cross.toFixed(1)} vs formula ${w.toFixed(1)} km/s`);
}
rep.b_1e4_kms = P.dopplerB(1e4);   // the thermal width quoted in Beat 3's equation (read by the manifest, never typed)
rep.pass = ok;
fs.writeFileSync(path.join(__dirname, '../validation/tau/report.json'), JSON.stringify(rep, null, 1));
process.exit(ok ? 0 : 1);
