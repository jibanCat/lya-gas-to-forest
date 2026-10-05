/* The material grammar shared by the transformations (design/VISUAL_LANGUAGE.md §4, "material").
 * - A fibre is a causal mapping: a thin thread from where something is to where it lands (an atom → its speed, gas → its
 *   velocity, a pixel → the gas that absorbed it). It leaves and arrives vertically, so it hangs like thread.
 * - A deposit is ink arriving: darker at its rim while wet, then dry.
 * - Paper fibres show only where light passes through paper.
 * These functions only draw. Every endpoint comes from the scene's validated numbers (design/canonical/BEATS.yaml,
 * visual_transforms). */
import { TK } from '../design/tokens.js';
import { clamp, rgba } from '../core/util.js';
import { P } from '../physics/lya.js';

/** one cubic from (x0, y0) to (x1, y1) with vertical tangents; p ∈ (0, 1] draws the first part (de Casteljau split) */
function fibrePath(g, x0, y0, x1, y1, p) {
  const my = (y0 + y1) / 2;
  let a = [x0, y0], b = [x0, my], c = [x1, my], d = [x1, y1];
  if (p < 1) {
    const L = (u, v) => [u[0] + (v[0] - u[0]) * p, u[1] + (v[1] - u[1]) * p];
    const ab = L(a, b), bc = L(b, c), cd = L(c, d), abc = L(ab, bc), bcd = L(bc, cd), m = L(abc, bcd);
    b = ab; c = abc; d = m;
  }
  g.moveTo(a[0], a[1]); g.bezierCurveTo(b[0], b[1], c[0], c[1], d[0], d[1]);
}
export function fibre(g, x0, y0, x1, y1, { w = 0.6, c = TK.graphite, a = 0.5, p = 1 } = {}) {
  if (p <= 0.001 || a <= 0.003) return;
  g.save(); g.strokeStyle = rgba(c, a); g.lineWidth = w; g.lineCap = 'round';
  g.beginPath(); fibrePath(g, x0, y0, x1, y1, Math.min(1, p)); g.stroke(); g.restore();
}
/** many fibres of one colour in a single stroke per alpha level (cheap enough for hundreds per frame) */
export function fibres(g, list, { w = 0.55, c = TK.graphite } = {}) {
  const byA = new Map();
  for (const f of list) { if (f.a <= 0.003 || (f.p ?? 1) <= 0.001) continue; const k = Math.round(f.a * 40) / 40; if (!byA.has(k)) byA.set(k, []); byA.get(k).push(f); }
  for (const [a, fs] of byA) { g.save(); g.strokeStyle = rgba(c, a); g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); for (const f of fs) fibrePath(g, f.x0, f.y0, f.x1, f.y1, Math.min(1, f.p ?? 1)); g.stroke(); g.restore(); }
}
/** where a fibre is at parameter s (for placing a travelling mark on it) */
export function fibreAt(x0, y0, x1, y1, s) { const my = (y0 + y1) / 2, u = 1 - s; return [u * u * u * x0 + 3 * u * u * s * x0 + 3 * u * s * s * x1 + s * s * s * x1, u * u * u * y0 + 3 * u * u * s * my + 3 * u * s * s * my + s * s * s * y1]; }

/** ink arriving: a rectangle that is darker at its rim while wet (age in s since it landed; dries over ~0.6 s) */
export function deposit(g, x, y, w, h, age, { c = TK.ink, a = 0.8 } = {}) {
  if (age < 0) return;
  const wet = Math.exp(-age / 0.35), arrive = clamp(age / 0.12, 0, 1);
  g.save();
  if (w < 3) { g.fillStyle = rgba(c, Math.min(1, a * arrive * (1 + 1.2 * wet))); g.fillRect(x, y, w, h); }   // a thin mark: darker while wet
  else { g.fillStyle = rgba(c, a * arrive * (1 - 0.25 * wet)); g.fillRect(x, y, w, h); if (wet > 0.03) { g.strokeStyle = rgba(c, a * 0.9 * wet); g.lineWidth = 0.8; g.strokeRect(x - 0.4, y - 0.4, w + 0.8, h + 0.8); } }
  g.restore();
}
/** a soft developing stain (gas revealed as if by ink): radius grows, the rim is dark while wet, then it settles */
export function develop(g, x, y, rx, ry, age, { c = TK.ink, a = 0.35 } = {}) {
  if (age <= 0) return;
  const grow = 1 - Math.exp(-age / 0.25), wet = Math.exp(-age / 0.6), R = Math.max(1, rx * grow), Ry = Math.max(1, ry * grow);
  g.save(); g.translate(x, y); g.scale(1, Ry / R);
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, R);
  gr.addColorStop(0, rgba(c, a * (0.55 + 0.25 * wet))); gr.addColorStop(0.72, rgba(c, a * (0.45 + 0.55 * wet))); gr.addColorStop(1, rgba(c, 0));
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.fill(); g.restore();
}

/** a seeded sheet of paper fibres (short soft strokes), drawn once; shown only where light passes through paper */
const _pf = {};
export function paperFibres(w, h, col, seed = 9) {
  const key = `${w}x${h}:${col}:${seed}`; if (_pf[key]) return _pf[key];
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const x = cv.getContext('2d'), r = P.rng(seed), n = Math.round(w * h / 260);
  x.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const x0 = r() * w, y0 = r() * h, L = 4 + 14 * r(), an = (r() - 0.5) * 1.1 + (r() < 0.5 ? 0 : Math.PI), bend = (r() - 0.5) * 0.9;
    x.strokeStyle = rgba(col, 0.12 + 0.16 * r()); x.lineWidth = 0.4 + 0.5 * r();
    x.beginPath(); x.moveTo(x0, y0); x.quadraticCurveTo(x0 + Math.cos(an + bend) * L / 2, y0 + Math.sin(an + bend) * L / 2, x0 + Math.cos(an) * L, y0 + Math.sin(an) * L); x.stroke();
  }
  return (_pf[key] = cv);
}
