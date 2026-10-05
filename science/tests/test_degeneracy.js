// VAL-DEG-001: the browser's same-shadow lines (lyaphys.parcelToCells + tauFromCells, exactly as Beat 13 draws them, in
// Lyα and Lyβ) vs the wofz oracle, at S/N = 20, 50, 100 and 200 per 2.5 km/s pixel; and the construction of (iii): its
// extra velocity must follow from the matching condition b_tot(iii) = b_tot(i) (science/tools/same_shadow_configs.py).
const fs = require('fs'), path = require('path');
const P = require('../js/lyaphys.js');
const O = JSON.parse(fs.readFileSync(path.join(__dirname, '../validation/degeneracy/oracle.json')));
const C = JSON.parse(fs.readFileSync(path.join(__dirname, '../validation/degeneracy/configs.json')));
const HUB = P.hubblePerMpch(3), ug = P.linspace(C.u_range_kms[0], C.u_range_kms[1], C.npix);     // Planck 2018; lines are H-independent
const R_LYB = P.C.lyb_f * P.C.lyb_lambda_A / (P.C.f * P.C.lambda_A), SNRS = [20, 50, 100, 200];
const toReal = p => ({ x: p.u / HUB, sx: p.su / HUB, N: p.N, T: p.T, v: p.v, dvdx: p.dv / (p.su / HUB) });
const CONFIGS = Object.fromEntries(Object.entries(C.configs).map(([k, v]) => [k, v.map(toReal)]));
const lineF = (cfg, scale) => { const t = new Float64Array(ug.length); for (const p of cfg) { const cells = P.parcelToCells(p, HUB).map(c => ({ ...c, N: c.N * scale })), tt = P.tauFromCells(ug, cells, { profile: 'voigt' }); for (let i = 0; i < ug.length; i++) t[i] += tt[i]; } return Array.from(t, v => Math.exp(-v)); };
const F = { lya: {}, lyb: {} };
for (const [k, cfg] of Object.entries(CONFIGS)) { F.lya[k] = lineF(cfg, 1); F.lyb[k] = lineF(cfg, R_LYB); }
const chi = (line, snr, k) => F[line][k].reduce((s, f, i) => s + ((f - F[line].i[i]) * snr) ** 2, 0);
const rep = { snr: SNRS, dchi2: {}, dchi2_lyb: {}, max_abs_dF_vs_oracle: {}, iii_max_abs_dF: {}, construction: {}, checks: [] }; let ok = true;
const check = (name, pass, extra = {}) => { rep.checks.push({ name, pass, ...extra }); if (!pass) ok = false; console.log((pass ? 'ok   ' : 'FAIL ') + name); };
for (const snr of SNRS) { rep.dchi2[snr] = {}; rep.dchi2_lyb[snr] = {}; for (const k of Object.keys(CONFIGS)) { rep.dchi2[snr][k] = chi('lya', snr, k); rep.dchi2_lyb[snr][k] = chi('lyb', snr, k); } }
// the construction: (iii)'s extra velocity follows from the matching condition, with the browser's own constants
const [ci] = C.configs.i, [c3] = C.configs.iii, bT = T => P.dopplerB(T);
const dvRule = Math.sqrt(ci.su ** 2 + (bT(ci.T) ** 2 - bT(c3.T) ** 2) / 2) - c3.su;
const btot = (p, dv) => Math.sqrt(bT(p.T) ** 2 + 2 * (p.su + dv) ** 2);
Object.assign(rep.construction, { dv_iii_kms: c3.dv, dv_rule_kms: dvRule, b_tot_i_kms: btot(ci, ci.dv), b_tot_iii_kms: btot(c3, c3.dv) });
check(`(iii) is constructed, not tuned: dv = ${c3.dv.toFixed(6)} km/s equals the matching rule's ${dvRule.toFixed(6)}`, Math.abs(c3.dv - dvRule) < 1e-9);
check(`b_tot(iii) = b_tot(i) = ${btot(ci, ci.dv).toFixed(6)} km/s`, Math.abs(btot(c3, c3.dv) / btot(ci, ci.dv) - 1) < 1e-12);
// the blend (ii): measurement-limited — the browser's Δχ² agrees with the oracle's at every S/N, in both lines
for (const [line, key, okey] of [['lya', 'dchi2', 'dchi2'], ['lyb', 'dchi2_lyb', 'dchi2_lyb']]) for (const snr of SNRS) {
  const a = rep[key][snr].ii, b = O[okey][String(snr)].ii, rel = Math.abs(a - b) / b;
  check(`${line} Δχ²(ii) at S/N=${snr}: browser ${a.toPrecision(4)} vs oracle ${b.toPrecision(4)}`, rel < 0.05, { rel });
}
// (iii): information-limited — its H I lines equal (i)'s to numerical precision at every S/N, in both lines, in both paths
rep.dchi2_iii_max = Math.max(...SNRS.flatMap(s => [rep.dchi2[s].iii, rep.dchi2_lyb[s].iii]));
rep.dchi2_iii_max_oracle = Math.max(...SNRS.flatMap(s => [O.dchi2[String(s)].iii, O.dchi2_lyb[String(s)].iii]));
for (const line of ['lya', 'lyb']) rep.iii_max_abs_dF[line] = Math.max(...F[line].iii.map((f, i) => Math.abs(f - F[line].i[i])));
// what remains is numerical: the exact-Voigt oracle leaves only the ±5σ truncation of each clump; the browser adds its Voigt
// approximation's error (W4, VAL-VOIGT-001) — shown by the same lines drawn with Gaussian kernels, which leave the truncation only
const gaussF = k => { const t = new Float64Array(ug.length); for (const p of CONFIGS[k]) { const tt = P.tauFromCells(ug, P.parcelToCells(p, HUB), { profile: 'gauss' }); for (let i = 0; i < ug.length; i++) t[i] += tt[i]; } return Array.from(t, v => Math.exp(-v)); };
const g1 = gaussF('i'), g3 = gaussF('iii');
rep.iii_max_abs_dF_gauss_kernels = Math.max(...g3.map((f, i) => Math.abs(f - g1[i])));
rep.iii_max_abs_dF_oracle = { lya: O.max_abs_dF.iii, lyb: O.max_abs_dF_lyb.iii };
check(`exact path: Δχ²(iii) ≤ ${rep.dchi2_iii_max_oracle.toExponential(1)} at every S/N ≤ 200 in Lyα and Lyβ (bound 1e-4)`, rep.dchi2_iii_max_oracle < 1e-4);
check(`browser: max |F(iii) − F(i)| ${Math.max(rep.iii_max_abs_dF.lya, rep.iii_max_abs_dF.lyb).toExponential(1)} (Voigt-approximation level; ${rep.iii_max_abs_dF_gauss_kernels.toExponential(1)} with Gaussian kernels) < 1e-4; Δχ²(iii) ≤ ${rep.dchi2_iii_max.toExponential(1)} at S/N 200`, Math.max(rep.iii_max_abs_dF.lya, rep.iii_max_abs_dF.lyb) < 1e-4 && rep.dchi2_iii_max < 1e-2);
for (const line of ['lya', 'lyb']) { const of = line === 'lya' ? O.F : O.F_lyb; rep.max_abs_dF_vs_oracle[line] = Math.max(...Object.keys(F[line]).flatMap(k => F[line][k].map((f, i) => Math.abs(f - of[k][i])))); }
check(`browser vs oracle: max |ΔF| Lyα ${rep.max_abs_dF_vs_oracle.lya.toExponential(1)}, Lyβ ${rep.max_abs_dF_vs_oracle.lyb.toExponential(1)}`, Math.max(rep.max_abs_dF_vs_oracle.lya, rep.max_abs_dF_vs_oracle.lyb) < 1e-4);
rep.lyb_over_lya_flambda = R_LYB;
rep.pass = ok; fs.writeFileSync(path.join(__dirname, '../validation/degeneracy/report.json'), JSON.stringify(rep, null, 1)); process.exit(ok ? 0 : 1);
