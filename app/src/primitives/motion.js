/* A parcel's own motion along the line of sight, as one shared physical instrument (Beats 6 and 7; SCI-MAP-001/003,
 * SCI-REP-003). One implementation of: the control law (the arrow's tip stays under the hand), its sandbox domain, the
 * toy sightline's measured range (computed from the data, never typed) and the drawing of the motion — the arrow, its number,
 * a faint band of the measured range inside the sandbox's end ticks, and the note when the motion leaves it.
 * The law's numbers come from the manifest (INT-VPEC-001; Beat 6's record reuses it — build_provenance.py checks they agree).
 * Sign convention: v_pec > 0 is away from us (redder), u = aH·x + v_pec (lyaphys parcelToCells). */
import { TK } from '../design/tokens.js';
import { Ink } from '../design/ink.js';
import { clamp } from '../core/util.js';
import { interaction } from '../core/meta.js';
import { SC } from '../data/scene-data.js';

/** the control law for one beat's motion record: px per km/s, the sandbox domain [km/s] and the arrow-key step [km/s] */
export function motionLaw(n, id) {
  const t = interaction(n, id), q = (t.gesture || {}).params || {};
  return { px: q.px_per_kms ?? 0.45, domain: t.domain || [-200, 200], key: q.key_step_kms ?? 5 };
}
/** the toy sightline's own peculiar velocities in the teaching stretch (measured; computed from the data) */
let _vrange = null;
export function measuredVpec() { if (_vrange) return _vrange; const w = SC.sk.window, v = SC.sk.v.slice(w.i0, w.i1); return (_vrange = [Math.min(...v), Math.max(...v)]); }
export const beyondMeasured = v => { const [lo, hi] = measuredVpec(); return v < lo - 0.5 || v > hi + 0.5; };
/** a push begins: the motion and where the hand was */
export function pushStart(v, p) { return { v0: v, x0: p.x }; }
/** the push now: the arrow's tip stays under the hand, clamped to the sandbox */
export function pushTo(h, p, law) { return Math.round(clamp(h.v0 + (p.x - h.x0) / law.px, law.domain[0], law.domain[1])); }
const fmtV = v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(Math.round(v));
/** the motion's arrow at (x, y): for the selected parcel, the measured band inside the sandbox ticks; then the arrow, its
 * number and — selected and beyond the measured range — a quiet note (a teaching intervention, stated beside the arrow) */
export function drawMotion(g, x, y, v, law, { col = TK.accent, on = true, rangeLabel = false } = {}) {
  const VS = law.px, [vlo, vhi] = measuredVpec();
  if (on) {
    g.save(); g.fillStyle = TK.wash; g.globalAlpha = 0.22; g.fillRect(x + vlo * VS, y - 3, (vhi - vlo) * VS, 6); g.restore();
    for (const d of law.domain) Ink.seg(g, x + d * VS, y - 4, x + d * VS, y + 4, { w: 0.6, c: TK.faint });
    if (rangeLabel && !beyondMeasured(v)) Ink.mono(g, 'the toy’s velocities here',   // beyond it, the note below names the range itself
       x + vhi * VS, y - 12, { align: 'right', size: 8.5, c: TK.muted });
  }
  if (Math.abs(v) >= 1) Ink.arrow(g, x, y, x + v * VS, y, { w: 1.4, c: col, head: 5 }); else Ink.dot(g, x, y, 1.8, { c: col });
  Ink.mono(g, fmtV(v), x + v * VS + (v >= 0 ? 7 : -7), y + 3, { align: v >= 0 ? 'left' : 'right', size: 10, c: col });
  if (on && beyondMeasured(v)) { const t = `outside the toy’s velocities here (${fmtV(vlo)} to ${fmtV(vhi)} km/s)`, w = t.length * 5.5, x0 = x + v * VS + (v >= 0 ? 7 : -7);   // ~5.5 px per 9 px mono glyph
    Ink.mono(g, t, v >= 0 ? Math.min(x0, 1062 - w) : Math.max(x0, 8 + w), y - 9, { align: v >= 0 ? 'left' : 'right', size: 9, c: TK.muted }); }   // kept inside the stage near its edges
}
