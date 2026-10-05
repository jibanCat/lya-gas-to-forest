// VAL-TOY-002: the app's toy spectrum, exactly as the app computes it, vs the generating code's own τ
// (exact Voigt via scipy.special.wofz, written into skewer.json by science/data/toy/zeldovich3d.py — an independent code path).
const fs = require('fs'), path = require('path'), P = require('../js/lyaphys.js');
const sk = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/toy/skewer.json'), 'utf8'));
const ref = sk.reference, period = P.hubblePerMpch(sk.z, sk.cosmo) * sk.L_mpch;
const ug = Array.from({ length: ref.n }, (_, k) => k * ref.du);
const cells = P.cellsFromSkewer({ z: sk.z, cosmo: sk.cosmo, dx_mpch: sk.dx_mpch, x: sk.x, nHI: sk.nHI, T: sk.T, v: sk.v });
const tg = P.tauFromCells(ug, cells, { period, profile: 'gauss', cut: 6 });       // as drawn in the prototype (scene.js)
const tv = P.tauFromCells(ug, cells, { period, profile: 'voigt' });
const dF = t => Math.max(...ug.map((_, i) => Math.abs(Math.exp(-t[i]) - Math.exp(-ref.tau[i]))));
const mean = t => t.reduce((s, v) => s + Math.exp(-v), 0) / t.length;
const checks = []; const check = (name, ok, detail) => { checks.push({ name, ok, detail }); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}  ${detail}`); };
const rep = { max_abs_dF_gauss: dF(tg), max_abs_dF_voigt: dF(tv), mean_F_browser: mean(tg), mean_F_reference: mean(ref.tau), period_kms: period, n: ref.n, du: ref.du, method_reference: ref.method, checks };
check('cosmology of the toy is Planck 2018', sk.cosmo.Om === 0.3153 && sk.cosmo.h === 0.6736, `Ωm ${sk.cosmo.Om}, h ${sk.cosmo.h}`);
check('browser as drawn (Gaussian kernels) vs reference: max |ΔF| < 1e-3', rep.max_abs_dF_gauss < 1e-3, rep.max_abs_dF_gauss.toExponential(1));
check('browser Voigt kernels vs reference: max |ΔF| < 1e-4', rep.max_abs_dF_voigt < 1e-4, rep.max_abs_dF_voigt.toExponential(1));
check('mean flux agrees to 1e-3', Math.abs(rep.mean_F_browser - rep.mean_F_reference) < 1e-3, `${rep.mean_F_browser.toFixed(4)} vs ${rep.mean_F_reference.toFixed(4)}`);
rep.pass = checks.every(c => c.ok);
fs.writeFileSync(path.join(__dirname, '../validation/toy_reference/report.json'), JSON.stringify(rep, null, 1));
console.log('PASS', rep.pass);
