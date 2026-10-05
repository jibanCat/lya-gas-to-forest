// The app's own values for every computation that has a Python reproduction (science/COMPUTATION_INVENTORY.yaml), at
// fixed canonical inputs, computed with the browser physics exactly as the scenes call it (science/js/lyaphys.js).
// reproduce/check.py compares each Python reproduction — an independent implementation of the published equation —
// with these values, and the "expected output" shown beside each Python snippet is formatted from them.
// Writes science/validation/computations/app_values.json. Inputs are defined here once; the scripts state the same
// inputs in their own code, and the check confirms they agree.
const fs = require('fs'), path = require('path');
const P = require('../js/lyaphys.js');
const sk = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/toy/skewer.json')));
const C3 = JSON.parse(fs.readFileSync(path.join(__dirname, '../validation/degeneracy/configs.json')));
const out = { generated_by: 'science/tests/test_computations.js', inputs: {}, values: {} };
const put = (id, inputs, values) => { out.inputs[id] = inputs; out.values[id] = values; };

// Beat 1 · neutral fraction at mean density (photoionisation equilibrium, case A, H and He fully ionised)
put('neutral_fraction', { z: sk.z, T_K: [1e4, 1.3e4], gamma12: P.C.gamma12_measured_z3, Yp: sk.cosmo.Yp, Obh2: sk.cosmo.Obh2 },
  { nH_bar_cm3: sk.nH_bar, ne_over_nH: P.neOverNH(sk.cosmo.Yp), x_HI: [1e4, 1.3e4].map(T => P.neutralFraction(1, T, sk.nH_bar, P.C.gamma12_measured_z3, sk.cosmo.Yp)) });

// Beat 3 · thermal Doppler width
put('thermal_width', { T_K: [4e3, 1e4, 4.2e4] }, { b_kms: [4e3, 1e4, 4.2e4].map(T => P.dopplerB(T)) });

// Beat 4 · natural width, damping parameter, Voigt function
{ const b = P.dopplerB(1e4), a = P.aDamp(b), xs = [0, 1, 2, 4, 10, 100];
  put('natural_voigt', { T_K: 1e4, x: xs }, { gamma_kms: P.C.gamma_kms, b_kms: b, a, fwhm_thermal_over_natural: 2 * Math.sqrt(Math.LN2) * b / (2 * P.C.gamma_kms), H: xs.map(x => P.voigtH(a, x)) }); }

// Beat 5 · redshift and distance
{ const z = 3, hub = P.hubblePerMpch(z), u = hub * 4.4;
  put('redshift_mapping', { z, cosmo: P.COSMO_DEFAULT, stretch_mpch: 4.4 }, { lambda_obs_A: P.lambdaObsOfRest(P.C.lambda_A, z), chi_mpch: P.comovingDistance(z), aH_over_h: hub, u_kms: u, dlambda_A: P.lambdaObs(u, z) - P.lambdaObs(0, z) }); }

// Beat 6 · one parcel's line: thermal and size widths (its own gradient switched off, and with it), peak optical depth
{ const hub = P.hubblePerMpch(sk.z, sk.cosmo), p0 = sk.parcels[1];
  const base = { x: +p0.x.toFixed(2), sx: p0.sx, v: Math.round(p0.v), T: Math.round(p0.T), N: 10 ** +Math.log10(p0.N).toFixed(2), dvdx: 0 };   // as the scene starts it (b6sim)
  const w0 = P.parcelWidths(base, hub), w1 = P.parcelWidths({ ...base, dvdx: p0.dvdx }, hub);
  put('parcel_profile', { T_K: base.T, sigma_x_mpch: base.sx, N_cm2: base.N, aH_over_h: hub, own_dvdx: p0.dvdx },
    { b_thermal_kms: w0.bThermal, b_size_kms: w0.bSize, b_kms: w0.bExpected, tau0: P.tau0(base.N, w0.bExpected), b_size_own_gradient_kms: w1.bSize, b_own_gradient_kms: w1.bExpected }); }

// Beat 7 · real space → velocity space for the three parcels (their place, and their own motion as the scene rounds it)
{ const hub = P.hubblePerMpch(sk.z, sk.cosmo), ps = sk.parcels.map(p => ({ x: p.x, v: Math.round(p.v) }));
  put('velocity_mapping', { aH_over_h: hub, x_mpch: ps.map(p => p.x), v_pec_kms: ps.map(p => p.v) }, { u_hubble_kms: ps.map(p => P.uOfX(p.x, 0, sk.z, sk.cosmo)), u_kms: ps.map(p => P.uOfX(p.x, p.v, sk.z, sk.cosmo)) }); }

// Beats 9–10 · optical depths add; transmission multiplies
{ const cells = [{ u: -20, N: 5e13, b: 15 }, { u: 0, N: 1e14, b: 20 }, { u: 25, N: 3e13, b: 12 }], ug = [0, 20], tot = P.tauFromCells(ug, cells, { profile: 'voigt' });
  const each = cells.map(c => Array.from(P.tauFromCells(ug, [c], { profile: 'voigt' })));
  put('optical_depth', { cells, u_kms: ug }, { tau_each: each, tau_total: Array.from(tot), F_total: Array.from(tot, t => Math.exp(-t)), F_product: ug.map((_, i) => each.reduce((f, t) => f * Math.exp(-t[i]), 1)) }); }
{ const taus = [1.73, 11.9, 0.37], N = 1e15, b = 25;
  put('transmission', { tau: taus, N_cm2: N, b_kms: b }, { F: P.fluxFromTau(taus), tau0: P.tau0(N, b), F_core: Math.exp(-P.tau0(N, b)) }); }

// Beat 11 · the instrument acts on the transmitted flux: a Gaussian line-spread function, then (not here) the noise
{ const du = 2.5, ug = P.linspace(-300, 300, 241), tau = P.tauFromCells(ug, [{ u: 0, N: 2e14, b: 25 }], { profile: 'voigt' }), F = P.fluxFromTau(tau), Fo = P.convolveLSF(F, du, 70, { periodic: false });
  const W = f => f.reduce((s, x) => s + (1 - x) * du, 0);
  put('instrument', { du_kms: du, u_range_kms: [-300, 300], N_cm2: 2e14, b_kms: 25, fwhm_kms: 70 }, { F_min_intrinsic: Math.min(...F), F_min_observed: Math.min(...Fo), EW_intrinsic_kms: W(F), EW_observed_kms: W(Fo) }); }

// Beat 13 · the constructed "same shadow": (iii) from the matching rule, and Δχ² in Lyα and Lyβ, as the scene draws them
{ const HUB = P.hubblePerMpch(3), ug = P.linspace(C3.u_range_kms[0], C3.u_range_kms[1], C3.npix), r = P.C.lyb_f * P.C.lyb_lambda_A / (P.C.f * P.C.lambda_A), snrs = [20, 50, 100, 200];
  const toReal = p => ({ x: p.u / HUB, sx: p.su / HUB, N: p.N, T: p.T, v: p.v, dvdx: p.dv / (p.su / HUB) });
  const line = (k, s) => { const t = new Float64Array(ug.length); for (const p of C3.configs[k].map(toReal)) { const tt = P.tauFromCells(ug, P.parcelToCells(p, HUB).map(c => ({ ...c, N: c.N * s })), { profile: 'voigt' }); for (let i = 0; i < ug.length; i++) t[i] += tt[i]; } return Array.from(t, v => Math.exp(-v)); };
  const F = { lya: {}, lyb: {} }; for (const k of ['i', 'ii', 'iii']) { F.lya[k] = line(k, 1); F.lyb[k] = line(k, r); }
  const chi = (l, k, snr) => F[l][k].reduce((s, f, i) => s + ((f - F[l].i[i]) * snr) ** 2, 0);
  put('same_shadow', { configs: C3.configs, pixel_kms: C3.pixel_kms, u_range_kms: C3.u_range_kms, snr: snrs },
    { dv_iii_kms: C3.configs.iii[0].dv, b_tot_kms: Math.sqrt(P.dopplerB(C3.configs.i[0].T) ** 2 + 2 * C3.configs.i[0].su ** 2),
      dchi2_lya: { ii: snrs.map(s => chi('lya', 'ii', s)), iii: snrs.map(s => chi('lya', 'iii', s)) }, dchi2_lyb: { ii: snrs.map(s => chi('lyb', 'ii', s)), iii: snrs.map(s => chi('lyb', 'iii', s)) } }); }

const finite = JSON.stringify(out.values).match(/null|NaN|Infinity/) === null;
out.pass = finite;
fs.mkdirSync(path.join(__dirname, '../validation/computations'), { recursive: true });
fs.writeFileSync(path.join(__dirname, '../validation/computations/app_values.json'), JSON.stringify(out, null, 1));
console.log(`${finite ? 'ok  ' : 'FAIL'} the app's own values for ${Object.keys(out.values).length} computations (science/validation/computations/app_values.json)`);
process.exit(finite ? 0 : 1);
