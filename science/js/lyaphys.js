/* lyaphys.js — candidate browser physics for the Lyα teaching resource.
 *
 * Status: UNDER VALIDATION (science/validation/). Not production; but unlike experiments/lib/phys.js this module
 * is the one the canonical prototype uses and the one the closure tests exercise. Every function names the
 * science-ledger IDs it implements (science/SCIENCE_LEDGER.yaml).
 *
 * Units:  x comoving Mpc/h · u, v, b km/s · T kelvin · n cm^-3 (proper) · N cm^-2 · λ Å.
 * Coordinate convention (SCI-MAP-001, SCI-MAP-002, SCI-MAP-003):
 *   the line of sight runs from the observer (x = 0 side) toward the quasar (+x);
 *   u(x) = a H(z) x_com + v_pec,  v_pec > 0  ⇔  gas moving away from the observer (toward +x)  ⇔  redder.
 *   With x in Mpc/h this is u = 100 E(z)/(1+z) · x  km/s, independent of h.
 *
 * Works in the browser (global `LyaPhys`) and in node (require).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LyaPhys = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ------------------------------------------------------------------------------------------ constants
  // SCI-ATOM-001 (atomic data; values and sources in the ledger)
  const C = {
    c_kms: 299792.458,
    c_cms: 2.99792458e10,
    kB: 1.380649e-16,            // erg/K (exact, SI 2019)
    m_H: 1.6735328e-24,          // g, mass of the ¹H atom: 1.00782503 u (CODATA 2018/2022; corrected from 1.6735575e-24)
    pie2_mec: 2.6540e-2,         // π e² / (m_e c)  [cm² s⁻¹]  (classical oscillator cross-section constant)
    lambda_A: 1215.6701,         // Lyα rest wavelength, vacuum, Å: NIST unresolved 1s–2 multiplet value (2p gf-centre 1215.67004)
    f: 0.4164,                   // absorption oscillator strength, 1s → 2p (both fine-structure components)
    lyb_lambda_A: 1025.72221,    // Lyβ (1s–3p) vacuum Å: f-weighted centre of the two 3p components, NIST ASD Ritz (CONST-LYB-LAMBDA)
    lyb_f: 0.079142,             // f(1s → 3p), NIST ASD = Wiese & Fuhr 2009 Table 6 No. 2 (CONST-LYB-F)
    A21: 6.2649e8,               // s⁻¹, 2p → 1s, Wiese & Fuhr 2009 Table 6 (NIST ASD now lists 6.2648e8 / 6.2647e8 per component)
    gamma12_measured_z3: 0.8,    // Γ_HI at z ≈ 3 in 10⁻¹² s⁻¹ (CONST-GAMMA-HI-Z3; Becker & Bolton 2013)
    Mpc_cm: 3.0856775814913673e24,
  };
  // derived
  C.lambda_cm = C.lambda_A * 1e-8;
  // integrated cross-section per unit velocity: σ_v = (π e²/m_e c) f λ  in cm² km/s   (SCI-TAU-001)
  C.sigma_v = C.pie2_mec * C.f * C.lambda_cm / 1e5;
  // Lorentzian HWHM in velocity units: γ_v = Γ λ / (4π)   (SCI-NAT-001)
  C.gamma_kms = C.A21 * C.lambda_cm / (4 * Math.PI) / 1e5;

  // ------------------------------------------------------------------------------------------ cosmology & mapping
  // SCI-MAP-001: flat ΛCDM, radiation neglected (valid at z ≲ 10 to < 0.1 %)
  const COSMO_DEFAULT = { Om: 0.3153, OL: 0.6847, h: 0.6736 };   // Planck 2018 TT,TE,EE+lowE+lensing (REF-PLANCK18 Table 2)
  function E(z, cosmo = COSMO_DEFAULT) { return Math.sqrt(cosmo.Om * Math.pow(1 + z, 3) + cosmo.OL); }
  /** H(z) in km/s/Mpc */
  function Hz(z, cosmo = COSMO_DEFAULT) { return 100 * cosmo.h * E(z, cosmo); }
  /** Hubble velocity per comoving Mpc/h: a H(z) / h = 100 E(z)/(1+z)  [km/s per Mpc/h]  (SCI-MAP-001/002) */
  function hubblePerMpch(z, cosmo = COSMO_DEFAULT) { return 100 * E(z, cosmo) / (1 + z); }
  /** u = a H(z) x_com + v_pec   (SCI-MAP-001, sign SCI-MAP-003) */
  function uOfX(x_mpch, v_pec, z, cosmo = COSMO_DEFAULT) { return hubblePerMpch(z, cosmo) * x_mpch + v_pec; }
  /** observed wavelength of absorption at velocity u, relative to the redshift z0 of the u = 0 point.
   *  Exact composition (1+z_obs) = (1+z0)·exp(u/c) is the standard small-velocity log-λ convention;
   *  to first order identical to (1+z0)(1+u/c).  (SCI-MAP-004) */
  function lambdaObs(u, z0) { return C.lambda_A * (1 + z0) * Math.exp(u / C.c_kms); }

  // ------------------------------------------------------------------------------------------ redshift: frames (SCI-RED-*)
  /** cosmological stretch between the absorber's frame and ours: 1 + z = λ_obs/λ_rest = a(t_obs)/a(t_abs)  (SCI-RED-001) */
  function stretch(z) { return 1 + z; }
  /** observer-frame wavelength of light that has rest-frame wavelength λ_rest at redshift z  (SCI-RED-001) */
  function lambdaObsOfRest(lambdaRest, z) { return lambdaRest * (1 + z); }
  /** the reverse operation: undo the stretch into the absorber's rest frame  (SCI-RED-001) */
  function lambdaRestOfObs(lambdaObsA, z) { return lambdaObsA / (1 + z); }
  /** wavelength of light emitted at λ_emit by a source at z_emit, as measured by a comoving observer the light is passing
   *  at redshift z_here (z_here ≤ z_emit): λ_local = λ_emit (1 + z_emit)/(1 + z_here)  (SCI-RED-001, SCI-RED-005) */
  function lambdaLocal(lambdaEmit, zEmit, zHere) { return lambdaEmit * (1 + zEmit) / (1 + zHere); }
  /** the part of a source's spectrum (in the source frame) that an absorber at z_abs absorbs: the part that is at the
   *  line's rest wavelength there, λ_emit = λ_line (1 + z_abs)/(1 + z_emit)  (SCI-RED-005) */
  function lambdaEmitAbsorbed(zAbs, zEmit, lambdaLine = C.lambda_A) { return lambdaLine * (1 + zAbs) / (1 + zEmit); }
  /** line-of-sight comoving distance χ(z) = (c/H0) ∫0^z dz'/E(z')  [Mpc/h] (flat; radiation neglected, SCI-RED-004).
   *  Composite Simpson on n panels; validated against scipy quad (VAL-RED-001). */
  function comovingDistance(z, cosmo = COSMO_DEFAULT, n = 512) {
    if (z <= 0) return 0;
    const hstep = z / n; let s = 1 / E(0, cosmo) + 1 / E(z, cosmo);
    for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) / E(i * hstep, cosmo);
    return C.c_kms / 100 * s * hstep / 3;
  }
  /** inverse of comovingDistance by bisection  [Mpc/h → z] */
  function zOfComoving(chi, cosmo = COSMO_DEFAULT, zmax = 20) {
    if (chi <= 0) return 0;
    let lo = 0, hi = zmax;
    for (let k = 0; k < 80; k++) { const m = 0.5 * (lo + hi); if (comovingDistance(m, cosmo) < chi) lo = m; else hi = m; }
    return 0.5 * (lo + hi);
  }

  // ------------------------------------------------------------------------------------------ line profile
  /** thermal Doppler parameter b = sqrt(2 k T / m)  (SCI-THERM-001). b_turb optional, added in quadrature. */
  function dopplerB(T, { mass = C.m_H, bTurb = 0 } = {}) { return Math.sqrt(2 * C.kB * T / mass + bTurb * bTurb * 1e10) / 1e5; }
  /** damping parameter a = Γλ/(4π b)  (SCI-VOIGT-001) */
  function aDamp(b) { return C.gamma_kms / b; }

  /** Voigt–Hjerting H(a,x) = Re w(x + i a); H(0,0) = 1.  (SCI-VOIGT-001, oracle: scipy.special.wofz)
   *  Humlicek (1982) W4 everywhere. Validated domain: a ∈ [1e-6, 1], |x| ≤ 2e4, max relative error 8e-5
   *  (science/validation/voigt/report.json). Tepper-García (2006) was rejected after the oracle showed
   *  2–6 % errors for 2 < |x| < 6. */
  function voigtH(a, x) { return humlicekW4(Math.abs(x), a); }
  const cadd = (p, q) => [p[0] + q[0], p[1] + q[1]];
  const cmul = (p, q) => [p[0] * q[0] - p[1] * q[1], p[0] * q[1] + p[1] * q[0]];
  const cdiv = (p, q) => { const d = q[0] * q[0] + q[1] * q[1]; return [(p[0] * q[0] + p[1] * q[1]) / d, (p[1] * q[0] - p[0] * q[1]) / d]; };
  const csc = (p, k) => [p[0] * k, p[1] * k];
  const cr = k => [k, 0];
  const cexp = p => { const e = Math.exp(p[0]); return [e * Math.cos(p[1]), e * Math.sin(p[1])]; };
  function poly(t, cs) { let r = cr(cs[cs.length - 1]); for (let i = cs.length - 2; i >= 0; i--) r = cadd(cmul(r, t), cr(cs[i])); return r; }
  function humlicekW4(x, y) {
    const t = [y, -x], s = Math.abs(x) + y;
    let w;
    if (s >= 15) w = cdiv(csc(t, 0.5641896), cadd(cr(0.5), cmul(t, t)));
    else if (s >= 5.5) { const u = cmul(t, t); w = cdiv(cmul(t, cadd(cr(1.410474), csc(u, 0.5641896))), cadd(cr(0.75), cmul(u, cadd(cr(3), u)))); }
    else if (y >= 0.195 * Math.abs(x) - 0.176) {
      w = cdiv(poly(t, [16.4955, 20.20933, 11.96482, 3.778987, 0.5642236]), poly(t, [16.4955, 38.82363, 39.27121, 21.69274, 6.699398, 1]));
    } else {
      const u = cmul(t, t);
      const num = cmul(t, poly(u, [36183.31, -3321.9905, 1540.787, -219.0313, 35.76683, -1.320522, 0.56419]));
      const den = poly(u, [32066.6, -24322.84, 9022.228, -2186.181, 364.2191, -61.57037, 1.841439, -1]);
      w = cadd(cexp(u), csc(cdiv(num, den), -1));
    }
    return w[0];
  }
  /** profile per unit velocity, ∫ φ du = 1:  φ(Δu) = H(a, Δu/b) / (√π b)   (SCI-VOIGT-002) */
  function phiV(du, b) { return voigtH(aDamp(b), du / b) / (Math.sqrt(Math.PI) * b); }
  /** line-centre optical depth of a pure Doppler line: τ0 = N σ_v / (√π b)   (SCI-TAU-001) */
  function tau0(N, b) { return N * C.sigma_v / (Math.sqrt(Math.PI) * b); }

  // ------------------------------------------------------------------------------------------ optical depth
  /**
   * τ(u_i) = Σ_j N_j σ_v φ(u_i − u_j; b_j)     (SCI-TAU-002 accumulation, SCI-TAU-003 additivity)
   * cells: [{u, N, b}]; ugrid: ascending array (km/s).
   * opts.period: periodic box velocity length (km/s) or 0.
   * opts.sample: 'point' (profile at pixel centre) | 'bin' (profile averaged over the pixel, nsub sub-samples).
   * opts.cut: kernel support in units of b for the Doppler core (default 8); damping wings extended until τ_wing < opts.tauFloor.
   * ugrid must be uniform (Δu is taken from its endpoints). Periodicity uses the cell-based nearest image, which differs from
   * fake_spectra's particle-based window only in the pixel opposite a strong line (VAL-CLOSURE-FS, source S9).
   */
  function tauFromCells(ugrid, cells, opts = {}) {
    const n = ugrid.length, tau = new Float64Array(n);
    const period = opts.period || 0, cut = opts.cut || 8, tauFloor = opts.tauFloor || 1e-6;
    const du = n > 1 ? (ugrid[n - 1] - ugrid[0]) / (n - 1) : 1;
    const nsub = opts.sample === 'bin' ? (opts.nsub || 8) : 1;
    for (const c of cells) {
      if (!(c.N > 0)) continue;
      const a = aDamp(c.b), pref = c.N * C.sigma_v / (Math.sqrt(Math.PI) * c.b);
      // wing reach: τ_wing(Δu) ≈ pref · a b² / (√π Δu²) = tauFloor
      const wing = Math.sqrt(Math.max(0, pref * a * c.b * c.b / (Math.sqrt(Math.PI) * tauFloor)));
      const half = Math.max(cut * c.b, opts.profile === 'gauss' ? 0 : wing);
      // index range (non-periodic part); periodic handled by wrapping Δu
      for (let i = 0; i < n; i++) {
        let d = ugrid[i] - c.u;
        if (period) d -= period * Math.round(d / period);
        if (d < -half - du || d > half + du) continue;
        let acc = 0;
        for (let s = 0; s < nsub; s++) {
          const ds = nsub === 1 ? d : d + du * ((s + 0.5) / nsub - 0.5);
          const x = ds / c.b;
          acc += opts.profile === 'gauss' ? Math.exp(-x * x) : voigtH(a, x);
        }
        tau[i] += pref * acc / nsub;
      }
    }
    return tau;
  }

  /**
   * The inverse lookup (SCI-TAU-003): each cell's own optical depth at one velocity u, for the thermal (Gaussian) profile —
   * the kernel tauFromCells uses with profile 'gauss' (same prefactor τ0(N, b), same cut in units of b, same periodic wrap).
   * The contributions sum to τ(u) (validated: VAL-INV-001). Returns [{ cell, tau }] for every cell within the cut.
   */
  function tauContributions(u, cells, { period = 0, cut = 8 } = {}) {
    const out = [];
    for (const c of cells) {
      if (!(c.N > 0)) continue;
      let d = u - c.u; if (period) d -= period * Math.round(d / period);
      if (d < -cut * c.b || d > cut * c.b) continue;
      const x = d / c.b, t = tau0(c.N, c.b) * Math.exp(-x * x);
      if (t > 0) out.push({ cell: c, tau: t });
    }
    return out;
  }

  /**
   * Real-space skewer → cells.  (SCI-SKEWER-001)
   * skewer: { z, cosmo, dx_mpch, x[], nHI[] (cm^-3 proper), T[] (K), v[] (km/s, + = away from observer) }
   * N_j = n_HI,j · Δx_proper,  Δx_proper = Δx_com · a / h  (in cm).
   * Validation mode (VAL-CLOSURE-FS): pass mass = 1.00794 × 1.67262178e-24 to reproduce fake_spectra 2.2.4's thermal widths;
   * bTurb (km/s, scalar or per-pixel array) adds unresolved velocity spread in quadrature. Defaults are the physical values.
   * Requirements found by the closure study: real-space pixels with aH·Δx ≤ b_min/2 when cold gas or coarse velocity pixels
   * are possible; one v and one T per pixel is a single-stream (fluid) approximation (SCI-TAU-004).
   */
  function cellsFromSkewer(sk, { nHIScale = 1, bScale = 1, mass = C.m_H, bTurb = 0 } = {}) {
    const cosmo = sk.cosmo || COSMO_DEFAULT, a = 1 / (1 + sk.z);
    const dxProperCm = sk.dx_mpch * a / cosmo.h * C.Mpc_cm;
    const Hpm = hubblePerMpch(sk.z, cosmo);
    const cells = [];
    for (let j = 0; j < sk.x.length; j++) {
      const bt = Array.isArray(bTurb) || ArrayBuffer.isView(bTurb) ? bTurb[j] : bTurb;
      cells.push({ j, x: sk.x[j], u: Hpm * sk.x[j] + sk.v[j], N: sk.nHI[j] * nHIScale * dxProperCm, b: dopplerB(sk.T[j], { mass, bTurb: bt }) * bScale, T: sk.T[j], v: sk.v[j] });
    }
    return cells;
  }

  /**
   * A teaching parcel (SCI-REP-003): a Gaussian clump of neutral column N centred at x (Mpc/h) with width sx, temperature T,
   * bulk velocity v and velocity gradient dvdx (km/s per Mpc/h), cut into nsub sub-cells over ±cut·sx (default ±5σ: a ±3σ cut
   * changed the same-shadow Δχ² by 18 %, VAL-DEG-001) so that the Hubble
   * flow and the gradient act across its extent.  hub = aH(z)/h in km/s per Mpc/h.  Returns cells for tauFromCells.
   */
  function parcelToCells(p, hub, { nsub = 201, cut = 5, pec = true, therm = true, bCold = 1.5, mass = C.m_H } = {}) {
    const out = []; let wsum = 0;
    for (let k = 0; k < nsub; k++) { const s = -cut + 2 * cut * k / (nsub - 1), w = Math.exp(-0.5 * s * s); wsum += w; out.push({ s, w }); }
    return out.map(c => { const x = p.x + c.s * p.sx, v = pec ? (p.v || 0) + (p.dvdx || 0) * c.s * p.sx : 0; return { x, u: hub * x + v, N: p.N * c.w / wsum, b: therm ? dopplerB(p.T, { mass }) : bCold }; });
  }

  /**
   * A teaching parcel's optical depth on a velocity grid: tauFromCells over parcelToCells — the one composition every
   * parcel scene draws (Beats 6–10, memoised in app/src/data/scene-data.js) and VAL-ORTH-001 tests. Adds no physics.
   */
  function parcelTau(ugrid, p, hub, { nsub = 161, pec = true, therm = true, profile = 'voigt' } = {}) { return tauFromCells(ugrid, parcelToCells(p, hub, { nsub, pec, therm }), { profile }); }
  /**
   * The two widths a teaching parcel's line is made of (SCI-THERM-002, SCI-REP-003), as Doppler parameters: its atoms'
   * thermal motion, b_thermal = √(2kT/m), and its size — the Hubble flow (and any internal gradient) across a Gaussian
   * clump of width sx spreads it by b_size = √2·|aH + dv/dx|·sx. Both Gaussian, they add in quadrature: b_expected =
   * √(b_thermal² + b_size²), the Doppler width of the line parcelTau draws (the damping wings aside). Analytic expectations
   * only: what a scene prints as the drawn line's width and peak is measured on the drawn profile (lineMoments, bFromFwhm).
   */
  function parcelWidths(p, hub, { mass = C.m_H } = {}) {
    const bThermal = dopplerB(p.T, { mass }), bSize = Math.SQRT2 * Math.abs(hub + (p.dvdx || 0)) * p.sx;
    return { bThermal, bSize, bExpected: Math.hypot(bThermal, bSize) };
  }
  /** a Gaussian line's Doppler parameter from its FWHM: b = FWHM / (2√ln2) (analysis only) */
  function bFromFwhm(fwhm) { return fwhm / (2 * Math.sqrt(Math.LN2)); }
  /**
   * Measurements of a computed line profile y(u) on a uniform grid (analysis only, no physics): its area ∫y du (trapezoid),
   * centre (y-weighted mean u), FWHM (half-maximum crossings, linearly interpolated, outward from the peak), peak, and how
   * much of the peak remains at the grid's edges (edge: a profile running off the grid is not measurable).
   * Used by VAL-ORTH-001 and by Beat 6's comparison with the state before a gesture.
   */
  function lineMoments(ugrid, y) {
    const n = y.length, du = (ugrid[n - 1] - ugrid[0]) / (n - 1); let area = 0, mom = 0, k = 0;
    for (let i = 0; i < n; i++) { const w = (i === 0 || i === n - 1) ? 0.5 : 1; area += w * y[i] * du; mom += w * y[i] * ugrid[i] * du; if (y[i] > y[k]) k = i; }
    const peak = y[k], h = peak / 2; let lo = k, hi = k;
    while (lo > 0 && y[lo] > h) lo--; while (hi < n - 1 && y[hi] > h) hi++;
    const xl = y[lo] <= h ? ugrid[lo] + (h - y[lo]) / (y[lo + 1] - y[lo]) * du : NaN, xh = y[hi] <= h ? ugrid[hi - 1] + (y[hi - 1] - h) / (y[hi - 1] - y[hi]) * du : NaN;
    return { area, centre: area > 0 ? mom / area : NaN, fwhm: xh - xl, peak, edge: peak > 0 ? Math.max(y[0], y[n - 1]) / peak : 0 };
  }

  // ------------------------------------------------------------------------------------------ observation
  /** Beer–Lambert: F = exp(−τ)  (SCI-FLUX-001) */
  function fluxFromTau(tau) { return Array.from(tau, t => Math.exp(-t)); }
  /** instrument line-spread function: Gaussian of FWHM (km/s), applied to F (not to τ)  (SCI-OBS-001) */
  function convolveLSF(F, du, fwhm, { periodic = true } = {}) {
    if (!(fwhm > 0)) return F.slice();
    const sig = fwhm / (2 * Math.sqrt(2 * Math.log(2))), h = Math.ceil(5 * sig / du), w = [];
    let s = 0; for (let k = -h; k <= h; k++) { const v = Math.exp(-0.5 * (k * du / sig) ** 2); w.push(v); s += v; }
    const n = F.length, out = new Array(n);
    for (let i = 0; i < n; i++) {
      let acc = 0;
      for (let k = -h; k <= h; k++) { let j = i + k; if (periodic) j = ((j % n) + n) % n; else j = Math.min(n - 1, Math.max(0, j)); acc += F[j] * w[k + h]; }
      out[i] = acc / s;
    }
    return out;
  }
  /** Gaussian noise with constant σ = 1/SNR per pixel (continuum-normalised)  (SCI-OBS-002) */
  function addNoise(F, snr, seed = 1) { const r = rng(seed); return F.map(f => f + gauss(r) / snr); }

  // ------------------------------------------------------------------------------------------ neutral fraction (teaching scaling)
  /** case-A recombination coefficient, cm³/s: α_A ≈ 4.2×10⁻¹³ (T/10⁴ K)^−0.7 (SCI-ION-001 ledger equation; cf. Hui & Gnedin 1997 Eq. 12 ≈ 4×10⁻¹³, Draine 2011 Eq. 14.3: 4.13×10⁻¹³ at 10⁴ K) */
  function alphaA(T) { return 4.2e-13 * Math.pow(T / 1e4, -0.7); }
  /** electrons per hydrogen nucleus with H and He fully ionised: 1 + 2Y/(4(1−Y)) (SCI-ION-001) */
  function neOverNH(Yp = 0.2454) { return 1 + 2 * Yp / (4 * (1 - Yp)); }
  /** neutral fraction in photoionisation equilibrium, x_HI = α_A(T) n_e n_H / Γ_HI, n_H = n̄_H Δ (SCI-ION-001/002) */
  function neutralFraction(Delta, T, nHbar, gamma12, Yp = 0.2454) { return alphaA(T) * neOverNH(Yp) * nHbar * Delta / (gamma12 * 1e-12); }
  /** relative n_HI in photoionisation equilibrium, highly ionised limit: ∝ Δ² T^-0.7 / Γ  (SCI-ION-001) */
  function nHIRelative(Delta, T, gamma12 = 1) { return Delta * Delta * Math.pow(T / 1e4, -0.7) / gamma12; }

  // ------------------------------------------------------------------------------------------ utils
  function rng(seed = 1) { let t = seed >>> 0; return () => { t += 0x6D2B79F5; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; }; }
  function gauss(r) { let u = 0; while (u === 0) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); }
  function linspace(a, b, n) { return Array.from({ length: n }, (_, i) => a + (b - a) * i / (n - 1)); }

  return { C, COSMO_DEFAULT, E, Hz, hubblePerMpch, uOfX, lambdaObs, stretch, lambdaObsOfRest, lambdaRestOfObs, lambdaLocal, lambdaEmitAbsorbed, comovingDistance, zOfComoving, dopplerB, aDamp, voigtH, humlicekW4, phiV, tau0,
    tauFromCells, tauContributions, cellsFromSkewer, parcelToCells, parcelTau, parcelWidths, bFromFwhm, lineMoments, fluxFromTau, convolveLSF, addNoise, nHIRelative, alphaA, neOverNH, neutralFraction, rng, gauss, linspace };
});
