// VAL-ORTH-001 — Beat 6's four teaching dimensions stay separate (SCI-MAP-001/003, SCI-TAU-001, SCI-THERM-002, SCI-REP-003).
// From the simulation's parcel (b of the teaching stretch, as Beat 6 starts: app/src/scenes/b06-parcel.js#b6sim), each of
// place x, own motion v_pec, temperature T and neutral amount N_HI is changed alone, across its control's domain (read from
// the manifest, design/canonical/beats.json — never typed here). Two levels:
//   cells  lyaphys parcelToCells: only the intended cell property changes (u by aH·Δx or Δv; b to dopplerB(T); N by the factor)
//   τ      lyaphys parcelTau — the composition the app draws — measured with lyaphys lineMoments on a fine wide grid:
//          place/motion: the centre moves by aH·Δx or Δv, FWHM and area unchanged; temperature: centre and area unchanged,
//          FWHM² grows by 4 ln2 (b₁² − b₀²) (a Gaussian thermal profile broadening a Gaussian spatial one); amount: τ ∝ N_HI,
//          centre and FWHM unchanged. Then on the scene's own grid: the comparison Beat 6 prints is right to its printed precision.
//   width  what Beat 6 prints about the line's width (b6reading): heat alone (thermal b) and the parcel's size (the Hubble flow
//          across it, b_size = √2·aH·σ_x) are the two parts; the drawn line's own width (b from its FWHM) and peak, measured
//          on the scene's drawn grid (its padded comparison grid where the line runs past the stretch), equal the fine-grid
//          measurement to the printed precision and the quadrature sum
//          √(b_thermal² + b_size²) and N σ_v/(√π b) within 2e-3 — so no printed number describes a line other than the one
//          drawn. At the toy's parcel, heat alone is recorded as not being the drawn width.
// Recorded, not tested: F = e^(−τ) is not linear — the equivalent width W = ∫(1 − F) du of a saturated line grows more slowly
// than N_HI and depends on b at fixed N_HI. Order: build_provenance.py → node science/tests/test_orthogonality.js → build again.
const fs = require('fs'), path = require('path'), P = require('../js/lyaphys.js');
const sk = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/toy/skewer.json'), 'utf8'));
const beats = JSON.parse(fs.readFileSync(path.join(__dirname, '../../design/canonical/beats.json'), 'utf8'));
const b6 = beats.beats.find(b => b.n === 6), dom = id => b6.interactions.find(t => t.id === id).domain;
const SL = fs.readFileSync(path.join(__dirname, '../../app/src/primitives/sightline.js'), 'utf8');
const WX = (() => { const m = SL.match(/export const WX = \{ x0: ([\d.-]+), x1: ([\d.-]+), xa: ([\d.-]+), xb: ([\d.-]+) \}/); return { xa: +m[3], xb: +m[4] }; })();
const NW = +SL.match(/P\.linspace\(SC\.HUB \* WX\.xa, SC\.HUB \* WX\.xb, (\d+)\)/)[1];   // the drawn stretch's grid (UG_W)
const HUB = P.hubblePerMpch(sk.z, sk.cosmo), p0r = sk.parcels[1];
const base = { x: +p0r.x.toFixed(2), sx: p0r.sx, v: Math.round(p0r.v), T: Math.round(p0r.T), N: 10 ** +Math.log10(p0r.N).toFixed(2), dvdx: 0 };   // b6sim
const th = b6.visual_transforms.find(t => t.id === 'VT-PARCEL-BEFORE').thresholds;   // the scene's comparison grid: the drawn stretch (UG_W), padded
const fine = P.linspace(-700, 1400, 21001), app = P.linspace(HUB * WX.xa - th.grid_pad_kms, HUB * WX.xb + th.grid_pad_kms, th.grid_points);   // 0.1 km/s; the scene's grid
const drawn = P.linspace(HUB * WX.xa, HUB * WX.xb, NW);   // the scene's drawn stretch: what b6reading measures
const tauOf = (ug, p) => P.parcelTau(ug, p, HUB), cellsOf = p => P.parcelToCells(p, HUB, { nsub: 161 });
const W = (ug, tau) => P.lineMoments(ug, Array.from(tau, t => 1 - Math.exp(-t))).area;   // equivalent width (km/s)
const checks = [], cases = [], maxErr = { centre_kms: 0, fwhm2_rel: 0, amount_rel: 0, width_rel: 0, peak_rel: 0 };
const check = (name, ok, detail) => { checks.push({ name, ok, detail }); if (!ok) console.log(`FAIL ${name}  ${detail}`); };
const rel = (a, b) => Math.abs(a - b) / Math.max(Math.abs(b), 1e-300);
const c0 = cellsOf(base), t0 = tauOf(fine, base), m0 = P.lineMoments(fine, t0), W0 = W(fine, t0), ta0 = tauOf(app, base);
const grids = (lo, hi, inner) => [lo, ...inner, hi];
const DIMS = [
  { dim: 'place', key: 'x', values: grids(...dom('INT-PLACE-001'), [1.0, 2.0, 3.6]) },
  { dim: 'motion', key: 'v', values: grids(...dom('INT-PUSH-001'), [-50, 0, 150]) },
  { dim: 'width', key: 'T', values: grids(...dom('INT-WARM-001'), [1e4, 5e4]) },
  { dim: 'amount', key: 'N', values: grids(...dom('INT-AMOUNT-001'), [13.5, 14.0]).map(l => 10 ** l) },
];
for (const D of DIMS) for (const val of D.values) {
  const p1 = { ...base, [D.key]: val }, c1 = cellsOf(p1), t1 = tauOf(fine, p1), m1 = P.lineMoments(fine, t1), name = `${D.dim} ${D.key} = ${D.key === 'N' ? Math.log10(val).toFixed(2) + ' (log)' : val}`;
  // cells: the controlled physical variables stay separate
  let du = 0, db = 0, dN = 0;
  const wantU = D.dim === 'place' ? HUB * (val - base.x) : D.dim === 'motion' ? val - base.v : 0, wantB = D.dim === 'width' ? P.dopplerB(val) : null, fN = D.dim === 'amount' ? val / base.N : 1;
  c1.forEach((c, k) => { du = Math.max(du, Math.abs((c.u - c0[k].u) - wantU)); db = Math.max(db, wantB ? rel(c.b, wantB) : rel(c.b, c0[k].b)); dN = Math.max(dN, rel(c.N, c0[k].N * fN)); });
  check(`${name}: cells — only the intended property changes`, du < 1e-9 && db < 1e-12 && dN < 1e-12, `|Δu − expected| ${du.toExponential(1)} km/s, b ${db.toExponential(1)}, N ${dN.toExponential(1)}`);
  // τ on the fine grid
  const dc = m1.centre - m0.centre, cs = { dim: D.dim, value: D.key === 'N' ? Math.log10(val) : val, centre_shift_kms: dc, fwhm_ratio: m1.fwhm / m0.fwhm, area_ratio: m1.area / m0.area, W_ratio: W(fine, t1) / W0, edge: m1.edge };
  if (D.dim === 'place' || D.dim === 'motion') {
    const e = Math.abs(dc - wantU); maxErr.centre_kms = Math.max(maxErr.centre_kms, e);
    check(`${name}: τ moves by ${D.dim === 'place' ? 'aH·Δx' : 'Δv'}; width and ink unchanged`, e < 1e-3 && rel(m1.fwhm, m0.fwhm) < 1e-3 && rel(m1.area, m0.area) < 1e-3, `centre error ${e.toExponential(1)} km/s, FWHM ×${cs.fwhm_ratio.toFixed(5)}, area ×${cs.area_ratio.toFixed(6)}`);
  } else if (D.dim === 'width') {
    const b0 = P.dopplerB(base.T), b1 = P.dopplerB(val), want = 4 * Math.LN2 * (b1 * b1 - b0 * b0), got = m1.fwhm ** 2 - m0.fwhm ** 2, e = want === 0 ? Math.abs(got) / m0.fwhm ** 2 : Math.abs(got - want) / Math.abs(want);
    maxErr.fwhm2_rel = Math.max(maxErr.fwhm2_rel, e); maxErr.centre_kms = Math.max(maxErr.centre_kms, Math.abs(dc)); cs.fwhm2_increment = { got, want };
    check(`${name}: FWHM² grows by 4 ln2 Δ(b²); centre and ink unchanged`, e < 1e-2 && Math.abs(dc) < 1e-3 && rel(m1.area, m0.area) < 1e-3, `FWHM² increment error ${e.toExponential(1)} (relative), centre ${Math.abs(dc).toExponential(1)} km/s, area ×${cs.area_ratio.toFixed(6)}`);
  } else {
    const pk = Math.max(...t0); let e = 0; for (let i = 0; i < fine.length; i++) if (t0[i] > 1e-4 * pk) e = Math.max(e, rel(t1[i] / t0[i], fN));
    maxErr.amount_rel = Math.max(maxErr.amount_rel, e); maxErr.centre_kms = Math.max(maxErr.centre_kms, Math.abs(dc));
    check(`${name}: τ ∝ N_HI; centre and width unchanged`, e < 1e-9 && Math.abs(dc) < 1e-3 && rel(m1.fwhm, m0.fwhm) < 1e-9 && rel(m1.area, m0.area * fN) < 1e-3, `τ ratio error ${e.toExponential(1)}, centre ${Math.abs(dc).toExponential(1)} km/s, FWHM ×${cs.fwhm_ratio.toFixed(9)}, area ×${(cs.area_ratio / fN).toFixed(6)} of N ratio`);
  }
  // the comparison Beat 6 prints (its own grid, b6compare): right to its printed precision, whenever it prints one
  const ma = P.lineMoments(app, tauOf(app, p1)), mb = P.lineMoments(app, ta0);
  if (ma.edge < th.edge_max && mb.edge < th.edge_max) {
    const shown = { dc: Math.round(ma.centre - mb.centre), w: +(ma.fwhm / mb.fwhm).toFixed(2), a: +(ma.area / mb.area).toFixed(2) }, truth = { dc: Math.round(dc), w: +cs.fwhm_ratio.toFixed(2), a: +cs.area_ratio.toFixed(2) };
    cs.scene_prints = shown;
    check(`${name}: the scene's printed comparison`, Math.abs(shown.dc - truth.dc) <= 1 && Math.abs(shown.w - truth.w) <= 0.01 && Math.abs(shown.a - truth.a) <= 0.01, `prints ${shown.dc} km/s · ×${shown.w} · ×${shown.a}; fine grid ${truth.dc} · ×${truth.w} · ×${truth.a}`);
  } else cs.scene_prints = 'not printed (runs off the stretch)';
  // what the scene prints about the width (b6reading): the drawn line's b and peak on its drawn grid, and the two parts
  const w = P.parcelWidths(p1, HUB), md = P.lineMoments(drawn, tauOf(drawn, p1)), bFine = P.bFromFwhm(m1.fwhm);
  cs.width = { b_thermal_kms: w.bThermal, b_size_kms: w.bSize, b_expected_kms: w.bExpected, b_drawn_fine_kms: bFine, peak_fine: m1.peak };
  const eW = rel(bFine, w.bExpected), eP = rel(m1.peak, P.tau0(p1.N, w.bExpected)); maxErr.width_rel = Math.max(maxErr.width_rel, eW); maxErr.peak_rel = Math.max(maxErr.peak_rel, eP);
  check(`${name}: the drawn line's width is heat and size in quadrature, its peak N σ_v/(√π b)`, eW < 2e-3 && eP < 2e-3, `b ${bFine.toFixed(3)} vs √(${w.bThermal.toFixed(2)}² + ${w.bSize.toFixed(2)}²) = ${w.bExpected.toFixed(3)} km/s (${eW.toExponential(1)}); peak ${m1.peak.toFixed(4)} vs ${P.tau0(p1.N, w.bExpected).toFixed(4)} (${eP.toExponential(1)})`);
  const mw = md.edge < th.edge_max ? md : P.lineMoments(app, tauOf(app, p1)), onGrid = md.edge < th.edge_max ? 'drawn stretch' : 'comparison grid';   // as b6reading
  if (mw.edge < th.edge_max) {
    const shown = { b: +P.bFromFwhm(mw.fwhm).toFixed(1), peak: +mw.peak.toFixed(2), measured_on: onGrid }; cs.width.scene_prints = shown;
    check(`${name}: the scene's printed width and peak are the drawn line's`, Math.abs(P.bFromFwhm(mw.fwhm) - bFine) <= 0.05 && Math.abs(mw.peak - m1.peak) <= 0.005, `prints b = ${shown.b} km/s, peak τ = ${shown.peak} (${onGrid}); fine grid ${bFine.toFixed(3)}, ${m1.peak.toFixed(4)}`);
  } else cs.width.scene_prints = 'not measured (runs off the comparison grid)';
  cases.push(cs);
}
const w0 = P.parcelWidths(base, HUB), b0Drawn = P.bFromFwhm(m0.fwhm);
const wOwn = P.parcelWidths({ ...base, dvdx: p0r.dvdx }, HUB);   // the same toy parcel with its own velocity gradient (as Beats 7–8 use it); Beat 6 sets it to zero
check('the toy’s parcel: heat alone is not the drawn width (the size term is printed beside it)', w0.bSize / w0.bThermal > 0.5 && rel(b0Drawn, w0.bThermal) > 0.2, `b_size/b_thermal = ${(w0.bSize / w0.bThermal).toFixed(2)}; drawn b ${b0Drawn.toFixed(2)} vs thermal ${w0.bThermal.toFixed(2)} km/s`);
const fAmt = 2, fT = 2, tA = tauOf(fine, { ...base, N: base.N * fAmt }), tT = tauOf(fine, { ...base, T: base.T * fT });
const rep = {
  base: { x_mpch: base.x, v_kms: base.v, T_K: base.T, log10_N: Math.log10(base.N), sx_mpch: base.sx, b_thermal_kms: w0.bThermal, b_size_kms: w0.bSize, b_drawn_kms: b0Drawn, own_dvdx_kms_per_mpch: p0r.dvdx, b_size_with_own_gradient_kms: wOwn.bSize, b_with_own_gradient_kms: wOwn.bExpected, peak_tau_drawn: m0.peak, hub_kms_per_mpch: HUB },
  domains: Object.fromEntries(['INT-PLACE-001', 'INT-PUSH-001', 'INT-WARM-001', 'INT-AMOUNT-001'].map(id => [id, dom(id)])),
  grids: { fine_kms: [fine[0], fine[fine.length - 1], fine.length], scene_kms: [app[0], app[app.length - 1], app.length], drawn_kms: [drawn[0], drawn[drawn.length - 1], drawn.length] }, scene_prints_for: (n => `${n} of ${cases.length} cases` + (n < cases.length ? ' (the others run off its grid and print "not measured")' : ''))(cases.filter(c => typeof c.scene_prints === 'object').length),
  max_err: maxErr, cases, checks,
  flux_nonlinearity: { tau0_base: Math.max(...t0), amount_factor: fAmt, W_ratio_amount: W(fine, tA) / W0, T_factor: fT, W_ratio_T: W(fine, tT) / W0, note: 'equivalent width of F = e^(−τ); τ itself behaves as tested above' },
};
rep.pass = checks.every(c => c.ok);
console.log(`${checks.filter(c => c.ok).length}/${checks.length} checks · max centre error ${maxErr.centre_kms.toExponential(1)} km/s · FWHM² increment ${maxErr.fwhm2_rel.toExponential(1)} · amount ${maxErr.amount_rel.toExponential(1)} · width ${maxErr.width_rel.toExponential(1)} · peak ${maxErr.peak_rel.toExponential(1)}`);
console.log(`     the toy's parcel: heat alone b = ${w0.bThermal.toFixed(1)} km/s, its size ${w0.bSize.toFixed(1)} km/s, the drawn line b = ${b0Drawn.toFixed(1)} km/s, peak τ = ${m0.peak.toFixed(2)}`);
console.log(`     recorded: N_HI ×${fAmt} → τ area ×${fAmt}, equivalent width ×${rep.flux_nonlinearity.W_ratio_amount.toFixed(3)} (τ₀ = ${rep.flux_nonlinearity.tau0_base.toFixed(2)}); T ×${fT} at fixed N_HI → W ×${rep.flux_nonlinearity.W_ratio_T.toFixed(3)}`);
fs.mkdirSync(path.join(__dirname, '../validation/orthogonality'), { recursive: true });
fs.writeFileSync(path.join(__dirname, '../validation/orthogonality/report.json'), JSON.stringify(rep, null, 1));
console.log('PASS', rep.pass);
process.exit(rep.pass ? 0 : 1);
