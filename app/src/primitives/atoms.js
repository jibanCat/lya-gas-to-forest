/* Representative atoms (SCI-REP-001): drawn only where atomic physics is the subject, always "not to scale".
 * Their motion is the physics (temperature is motion), so it runs — and freezes under reduced motion (arrows carry speed). */
import { TK } from '../design/tokens.js';
import { Ink } from '../design/ink.js';
import { motionOK } from '../core/app.js';
import { SC, sigmaLOS } from '../data/scene-data.js';

/** where atom a is now inside the parcel (straight-line cartoon motion, wrapped), and its line-of-sight speed [km/s] */
export function atomPos(a, cx, cy, R, T, t, speedPx = 2.2) {
  const s = sigmaLOS(T), tt = motionOK() ? t : 0, vx = a.gx * s, vy = a.gy * s;
  const px = ((a.x0 * R + vx * speedPx * tt) % (2 * R) + 3 * R) % (2 * R) - R, py = ((a.y0 * R + vy * speedPx * tt) % (2 * R) + 3 * R) % (2 * R) - R;
  return [cx + px, cy + py, vx];
}
export function drawAtoms(g, cx, cy, R, T, t, { arrows = true, follow = -1, speedPx = 2.2, alpha = 1, arrowPx = 1.4 } = {}) {
  g.save(); g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.clip();
  for (const a of SC.atoms) {
    const [X, Y, vx] = atomPos(a, cx, cy, R, T, t, speedPx), isF = a.i === follow;
    Ink.dot(g, X, Y, isF ? 3.4 : 2, { c: isF ? TK.accent : TK.ink, a: (isF ? 1 : 0.85) * alpha });
    if (arrows && Math.abs(vx) > 0.4) Ink.arrow(g, X, Y, X + vx * arrowPx, Y, { w: isF ? 1.3 : 0.7, c: isF ? TK.accent : TK.graphite, a: 0.8 * alpha, head: isF ? 5 : 3 });
  }
  g.restore();
}
/** a short wave packet from (x, y) along direction ang (photons) */
export function wave(g, x, y, ang, c, a) {
  const ux = Math.cos(ang), uy = Math.sin(ang), pts = [];
  for (let i = 0; i <= 24; i++) { const s = i / 24 * 26, o = 4 * Math.sin(s * 0.7); pts.push([x + s * ux - o * uy, y + s * uy + o * ux]); }
  Ink.line(g, pts, { w: 1.2, c, a });
}
