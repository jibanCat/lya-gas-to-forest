// VAL-DEG-001: the browser's same-shadow lines (lyaphys.parcelToCells + tauFromCells, as used by Beat 12) vs the wofz oracle.
const fs = require('fs'), path = require('path');
const P = require('../js/lyaphys.js');
const O = JSON.parse(fs.readFileSync(path.join(__dirname, '../validation/degeneracy/oracle.json')));
const C = JSON.parse(fs.readFileSync(path.join(__dirname, '../validation/degeneracy/configs.json')));
const HUB = P.hubblePerMpch(3), ug = P.linspace(C.u_range_kms[0], C.u_range_kms[1], C.npix);     // Planck 2018; lines are H-independent
const toReal = p => ({ x: p.u / HUB, sx: p.su / HUB, N: p.N, T: p.T, v: p.v, dvdx: p.dv / (p.su / HUB) });
const CONFIGS = Object.fromEntries(Object.entries(C.configs).map(([k, v]) => [k, v.map(toReal)]));
const F = {};
for (const [k, cfg] of Object.entries(CONFIGS)) { const t = new Float64Array(ug.length); for (const p of cfg) { const tt = P.tauFromCells(ug, P.parcelToCells(p, HUB)); for (let i = 0; i < ug.length; i++) t[i] += tt[i]; } F[k] = Array.from(t, v => Math.exp(-v)); }
const rep = { dchi2: {}, max_abs_dF_vs_oracle: {}, checks: [] }; let ok = true;
for (const snr of [20, 50]) { rep.dchi2[snr] = {}; for (const k of Object.keys(F)) rep.dchi2[snr][k] = F[k].reduce((s, f, i) => s + ((f - F.i[i]) * snr) ** 2, 0); }
for (const k of Object.keys(F)) rep.max_abs_dF_vs_oracle[k] = Math.max(...F[k].map((f, i) => Math.abs(f - O.F[k][i])));
for (const snr of ['20', '50']) for (const k of ['ii', 'iii']) {
  const a = rep.dchi2[snr][k], b = O.dchi2[snr][k], rel = Math.abs(a - b) / b, pass = rel < 0.05;
  rep.checks.push({ name: `Δχ²(${k}) at S/N=${snr}: browser ${a.toFixed(2)} vs oracle ${b.toFixed(2)}`, rel, pass }); if (!pass) ok = false;
  console.log((pass ? 'ok   ' : 'FAIL ') + rep.checks[rep.checks.length - 1].name + `  (rel ${rel.toExponential(1)})`);
}
console.log('      max |ΔF| browser vs oracle per config:', Object.entries(rep.max_abs_dF_vs_oracle).map(([k, v]) => `${k} ${v.toExponential(1)}`).join(', '));
rep.pass = ok; fs.writeFileSync(path.join(__dirname, '../validation/degeneracy/report.json'), JSON.stringify(rep, null, 1)); process.exit(ok ? 0 : 1);
