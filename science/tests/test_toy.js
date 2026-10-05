// VAL-TOY-001: the toy skewer used by the canonical prototype — Gaussian vs Voigt kernels, mean flux, tuned Γ.
const fs = require('fs'), path = require('path');
const P = require('../js/lyaphys.js');
const sk = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/toy/skewer.json')));
const cells = P.cellsFromSkewer({ z: sk.z, cosmo: sk.cosmo, dx_mpch: sk.dx_mpch, x: sk.x, nHI: sk.nHI, T: sk.T, v: sk.v });
const period = P.hubblePerMpch(sk.z, sk.cosmo) * sk.L_mpch, ug = P.linspace(0, period, 2049).slice(0, 2048);
const tg = P.tauFromCells(ug, cells, { period, profile: 'gauss', cut: 6 }), tv = P.tauFromCells(ug, cells, { period, profile: 'voigt' });
let maxDF = 0; for (let i = 0; i < ug.length; i++) maxDF = Math.max(maxDF, Math.abs(Math.exp(-tg[i]) - Math.exp(-tv[i])));
const meanF = tg.reduce((s, t) => s + Math.exp(-t), 0) / tg.length;
const maxN = Math.max(...cells.map(c => c.N)), maxTau = Math.max(...tv);
const rep = { max_abs_dF_gauss_vs_voigt: maxDF, mean_flux: meanF, gamma12_tuned: sk.Gamma12, gamma12_measured_z3: 0.8, gamma_ratio: sk.Gamma12 / 0.8, max_cell_column: maxN, max_tau: maxTau, checks: [] };
let ok = true; const check = (n, p, d) => { rep.checks.push({ name: n, pass: p, detail: d }); if (!p) ok = false; console.log((p ? 'ok   ' : 'FAIL ') + n + (d ? '  ' + d : '')); };
check('Gaussian kernels are adequate for the toy forest (max |ΔF| < 1e-3)', maxDF < 1e-3, maxDF.toExponential(2));
const xMean = P.neutralFraction(1, sk.T0, sk.nH_bar, P.C.gamma12_measured_z3);
check('neutral fraction at mean density, T0, measured Γ_HI is ~10⁻⁵ (SCI-ION-002: 0.74×10⁻⁵ at T0 = 10⁴ K, 0.62×10⁻⁵ at 1.3×10⁴ K)', xMean > 5e-6 && xMean < 8e-6, xMean.toExponential(2));
check('mean flux = 0.68 ± 0.01 (a calibration: the normalisation target Γ_HI is tuned to, SCI-CTX-003)', Math.abs(meanF - 0.68) < 0.01, meanF.toFixed(4));
console.log(`      tuned Γ_HI = ${sk.Gamma12.toFixed(2)}e-12 s^-1 = ${(sk.Gamma12 / 0.8).toFixed(1)}× the measured 0.8e-12 (declared toy limitation)`);
{ const w = sk.window, vw = sk.v.slice(w.i0, w.i1), r1 = a => [Math.min(...a), Math.max(...a)].map(v => +v.toFixed(1));   // measured peculiar velocities: the bounds Beat 7's drag is compared with (INT-VPEC-001)
  rep.vpec_window_kms = r1(vw); rep.vpec_sightline_kms = r1(sk.v); }
rep.pass = ok; fs.writeFileSync(path.join(__dirname, '../validation/toy/report.json'), JSON.stringify(rep, null, 1)); process.exit(ok ? 0 : 1);
