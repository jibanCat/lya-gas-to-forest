/* The sightline seen flat: the n_HI strip, the 4.4 Mpc/h teaching window with its real-space and velocity rulers, ink
 * trails from a place to where it lands, and the window re-binned into cells (Beats 6–10). */
import { TK } from '../design/tokens.js';
import { Ink } from '../design/ink.js';
import { clamp, lerp, rgba } from '../core/util.js';
import { P } from '../physics/lya.js';
import { SC } from '../data/scene-data.js';

/** real-space strip of n_HI along [xa, xb] (absolute Mpc/h), drawn at y with half-height hh */
export function drawStrip(g, xa, xb, mx, y, hh, { ruled = 0, alpha = 1, highlight = null } = {}) {
  const cells = SC.cells.filter(c => c.x >= xa - 0.02 && c.x <= xb + 0.02), w = Math.max(0.6, mx(SC.sk.dx_mpch) - mx(0));
  const toneOf = c => clamp((Math.log10(c.N / SC.maxN) + 2.6) / 2.6, 0.02, 1);
  for (const c of cells) { const col = highlight && highlight(c) ? TK.accent : TK.ink; g.save(); g.fillStyle = rgba(col, 0.9 * toneOf(c) * alpha); g.fillRect(mx(c.x) - w / 2, y - hh, w + 0.5, 2 * hh); g.restore(); }
  if (ruled > 0) { const step = (xb - xa) / ruled; for (let k = 0; k <= ruled; k++) Ink.seg(g, mx(xa + k * step), y - hh - 3, mx(xa + k * step), y + hh + 3, { w: 0.6, c: TK.graphite, a: 0.6 }); }
}
// ---------------------------------------------------------------------------------------------- the teaching window (window-local x; u from its near edge)
export const WX = { x0: 90, x1: 1040, xa: -0.45, xb: 4.85 };
export function wmx(x) { return WX.x0 + (x - WX.xa) / (WX.xb - WX.xa) * (WX.x1 - WX.x0); }
export function wmu(u) { return wmx(u / SC.HUB); }
let _ugw = null;
/** the window's velocity grid (fixed, so per-parcel τ can be memoised) */
export function UG_W() { return _ugw || (_ugw = P.linspace(SC.HUB * WX.xa, SC.HUB * WX.xb, 1100)); }
export function contextStrip(g, y, hh, alpha = 0.35) {
  const x0 = SC.win.x0;
  for (const c of SC.win.cells) { const tn = clamp((Math.log10(c.N / SC.maxN) + 2.6) / 2.6, 0.02, 1); g.save(); g.fillStyle = rgba(TK.ink, 0.9 * tn * alpha); const xl = c.x - x0; g.fillRect(wmx(xl - SC.sk.dx_mpch / 2), y - hh, wmx(SC.sk.dx_mpch) - wmx(0) + 0.6, 2 * hh); g.restore(); }
}
export function xRuler(g, y, lab = 'distance along the beam, from the near edge of this stretch  [comoving Mpc/h]') { Ink.ruler(g, wmx(0), wmx(4.4), y, { map: wmx, ticks: [0, 1, 2, 3, 4].map(v => ({ v, s: String(v) })), label: lab }); }
export function uRuler(g, y, lab = 'velocity, from the same edge  [km/s]  →  observed colour') { Ink.ruler(g, wmx(0), wmx(4.4), y, { map: wmu, ticks: [0, 100, 200, 300, 400].map(v => ({ v, s: String(v) })), label: lab }); }
/** ink-trail grammar: a tapering stroke from a place to where it lands; p ∈ [0,1] is how far it has travelled */
export function inkTrail(g, xs, ys, xe, ye, p, { c = TK.accent, a = 1 } = {}) {
  const n = 28, L = clamp(p, 0, 1); if (L <= 0) return; let prev = null;
  for (let k = 0; k <= n; k++) { const s = k / n * L, x = lerp(xs, xe, s), y = lerp(ys, ye, s * s * 0.35 + s * 0.65); if (prev) Ink.seg(g, prev[0], prev[1], x, y, { w: lerp(2.4, 0.7, k / n), c, a: a * 0.85 }); prev = [x, y]; }
}
/** the window's full sampling: every toy cell's τ on the window grid (computed once; Beats 8–9 compare a coarser cut with it) */
let _wfull = null;
export function windowFull() { return _wfull || (_wfull = P.tauFromCells(UG_W(), SC.win.cells.map(c => ({ u: SC.HUB * (c.x - SC.win.x0) + c.v, N: c.N, b: c.b })), { profile: 'gauss' })); }
/** the largest difference in transmitted flux between two τ arrays on one grid */
export function maxDF(a, b) { let m = 0; for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(Math.exp(-a[i]) - Math.exp(-b[i]))); return m; }
/** each of n window cells' own τ on the window grid, and their sum (fixed inputs → computed once; Beats 9–10) */
const _wk = {};
export function windowKernels(n = 24) { if (_wk[n]) return _wk[n]; const ug = UG_W(), kern = binCells(n).map(c => P.tauFromCells(ug, [{ u: c.u, N: c.N, b: c.b }], { profile: 'gauss' })), tot = new Float64Array(ug.length); kern.forEach(k => k.forEach((v, i) => tot[i] += v)); return (_wk[n] = { kern, tot }); }
/** the window re-binned into n cells (N-weighted x, T, v; b from ⟨b²⟩); n = 3 means "the three parcels" (null) */
const _bins = {};
export function binCells(n) {
  if (n === 3) return null; if (_bins[n]) return _bins[n];
  const cells = SC.win.cells, x0 = SC.win.x0, out = [], per = cells.length / n;
  for (let k = 0; k < n; k++) {
    const grp = cells.slice(Math.round(k * per), Math.round((k + 1) * per)); let N = 0, xs = 0, T = 0, v = 0, bb = 0;
    for (const c of grp) { N += c.N; xs += c.N * c.x; T += c.N * c.T; v += c.N * c.v; bb += c.N * c.b * c.b; }
    const x = xs / N - x0; out.push({ x, xlo: grp[0].x - x0 - SC.sk.dx_mpch / 2, xhi: grp[grp.length - 1].x - x0 + SC.sk.dx_mpch / 2, N, T: T / N, v: v / N, u: SC.HUB * x + v / N, b: Math.sqrt(bb / N) });
  }
  return (_bins[n] = out);
}
