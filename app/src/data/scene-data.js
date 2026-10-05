/* Canonical teaching data, prepared once: the toy sightline (SCI-SIM-TOY-001, science/data/toy/), its browser-recomputed
 * τ and F, the generating code's own reference spectrum (VAL-TOY-002), the 3D slab, the teaching window and its three
 * data-derived parcels (SCI-REP-003), and the representative atoms (SCI-REP-001). */
import { P } from '../physics/lya.js';
import { clamp, memo } from '../core/util.js';
import { META } from '../core/meta.js';

export const SC = {};
export function prepareData() {
  const D = window.LYA_DATA, sk = D.skewer, sl = D.slab;
  SC.sk = sk; SC.z = sk.z; SC.cosmo = sk.cosmo; SC.L = sk.L_mpch; SC.HUB = P.hubblePerMpch(sk.z, sk.cosmo); SC.period = SC.HUB * SC.L;
  SC.cells = P.cellsFromSkewer({ z: sk.z, cosmo: sk.cosmo, dx_mpch: sk.dx_mpch, x: sk.x, nHI: sk.nHI, T: sk.T, v: sk.v });
  SC.ug = P.linspace(0, SC.period, 2049).slice(0, 2048);
  SC.tauCut = META(12).visual_transforms.find(t => t.id === 'VT-INV-TRACE').thresholds.kernel_cut_b;   // one kernel cut for the spectrum and its inverse lookup
  SC.tau = P.tauFromCells(SC.ug, SC.cells, { period: SC.period, profile: 'gauss', cut: SC.tauCut });
  SC.F = Array.from(SC.tau, t => Math.exp(-t));
  SC.maxN = Math.max(...SC.cells.map(c => c.N));
  if (sk.reference && sk.reference.n === SC.ug.length) { SC.refF = sk.reference.tau.map(t => Math.exp(-t)); SC.refDF = Math.max(...SC.F.map((f, i) => Math.abs(f - SC.refF[i]))); }
  const raw = Uint8Array.from(atob(sl.data), ch => ch.charCodeAt(0));
  SC.slab = { ...sl, raw, at: (i, j, k) => raw[(i * sl.ny + j) * sl.nz + k] / 255 };
  SC.slices = buildSlices(false); SC.slicesFocus = buildSlices(true);
  const w = sk.window;
  SC.win = { x0: w.x0, span: w.span, i0: w.i0, i1: w.i1, blend: w.blend, cells: SC.cells.slice(w.i0, w.i1) };
  SC.parcels = sk.parcels.map((p, k) => ({ ...p, id: 'abc'[k], uLocal: p.u, dvdx: clamp(p.dvdx, -150, 150) }));
  SC.atoms = makeAtoms(260, 7);
  SC.configs = D.sameShadow;
}
const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
/** how the drawing fades toward the sample's edges (a drawing convention — the sample ends, the gas does not; SCI-REP-002) */
export const SLAB_FADE = { x: 0.06, y: 0.2, z: 0.2 };
export function slabEdgeFade(f, frac) { return smooth(Math.min(f, 1 - f) / frac); }
/** per-depth slab slices as images: ink alpha ∝ density, with the focus rule (gas near the beam emphasised, SCI-REP-002),
 * dissolving into paper toward the sample's x and y edges */
function buildSlices(focus) {
  const sl = SC.slab, out = [];
  for (let k = 0; k < sl.nz; k++) {
    const c = document.createElement('canvas'); c.width = sl.nx; c.height = sl.ny;
    const x = c.getContext('2d'), im = x.createImageData(sl.nx, sl.ny);
    for (let j = 0; j < sl.ny; j++) for (let i = 0; i < sl.nx; i++) {
      const v = Math.pow(sl.at(i, j, k), 1.25); let a = v;
      if (focus) { const dy = (j + 0.5) - sl.ny / 2, dz = (k + 0.5) - sl.nz / 2, r = Math.hypot(dy, dz); a = v * (0.3 + 0.7 * Math.exp(-(r * r) / 4.5)); }
      a *= slabEdgeFade((i + 0.5) / sl.nx, SLAB_FADE.x) * slabEdgeFade((j + 0.5) / sl.ny, SLAB_FADE.y);
      const q = ((sl.ny - 1 - j) * sl.nx + i) * 4; im.data[q] = 31; im.data[q + 1] = 39; im.data[q + 2] = 50; im.data[q + 3] = 255 * a;
    }
    x.putImageData(im, 0, 0); out.push(c);
  }
  return out;
}
/** parcel → cells: the validated implementation lives in lyaphys (parcelToCells, SCI-REP-003) */
export function parcelCells(p, { pec = true, therm = true, nsub = 161 } = {}) { return P.parcelToCells(p, SC.HUB, { nsub, pec, therm }); }
const _tauParcel = memo((ug, p, o) => P.parcelTau(ug, p, SC.HUB, { nsub: o.nsub || 161, pec: o.pec !== false, therm: o.therm !== false, profile: o.profile || 'voigt' }), 64);
/** a parcel's τ on a velocity grid (lyaphys parcelTau, the composition VAL-ORTH-001 tests). Memoised on its exact inputs:
 * identical numbers, computed once (performance only). */
export function tauParcel(ug, p, o = {}) {
  const key = [ug.length, ug[0], ug[ug.length - 1], p.x, p.sx, p.N, p.T, p.v || 0, p.dvdx || 0, o.pec !== false, o.therm !== false, o.profile || 'voigt', o.nsub || 161].join('|');
  return _tauParcel(key, ug, p, o);
}
/** representative atoms (SCI-REP-001): fixed seeded positions and Gaussian velocity draws */
function makeAtoms(n, seed) { const r = P.rng(seed), A = []; for (let i = 0; i < n; i++) { const ang = r() * 2 * Math.PI, rr = Math.sqrt(r()); A.push({ x0: Math.cos(ang) * rr, y0: Math.sin(ang) * rr, gx: P.gauss(r), gy: P.gauss(r), i }); } return A; }
/** 1D line-of-sight thermal speed dispersion σ = sqrt(kT/m) = b/√2, km/s (SCI-THERM-002) */
export function sigmaLOS(T) { return P.dopplerB(T) / Math.SQRT2; }
export function densityWord(D) { return D < 0.5 ? 'a void' : D < 2 ? 'ordinary, near-mean gas' : D < 8 ? 'a filament' : 'a dense knot'; }
