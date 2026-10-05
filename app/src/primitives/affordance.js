/* The affordance grammar (design/VISUAL_LANGUAGE.md §6): how a drawing says "you can touch this", without chrome.
 * A scene lists its physical objects — affordances(S) → [{ id, kind, at, hit, bracket?, hint? }]:
 *   kind 'grab'   a point you drag (the light, a velocity, the inspection loupe): cursor grab; a cinnabar hairline ring
 *   kind 'select' a region you choose (a structure, a parcel): cursor pointer; a cinnabar hairline under it
 *   kind 'hold'   an object you press and hold (a gas parcel to explore warmer gas): its own outline answers — a cinnabar
 *                 hairline ring of radius `ring`, or an ellipse `ellipse: [rx, ry]` (dashed on hover, solid while held); the
 *                 scene runs the hold itself. `cursor` may override the kind's cursor (a parcel that is also moved: grab)
 *   kind 'scan'   a cursor you sweep (a colour): cursor ew-resize; the ring sits on its handle
 * hit: { r } around `at`, or { rect: [x0, y0, x1, y1] } — larger than the visible mark (touch: ×1.5); marks are never thickened.
 * States: idle (nothing) · hover / keyboard focus (ring fades in) · active (ring tightens) · released (ring fades out).
 * A first-use hint (Fraunces italic, graphite, one hairline arrow) shows until the gesture has been used once; then never. */
import { TK } from '../design/tokens.js';
import { Ink } from '../design/ink.js';
import { clamp } from '../core/util.js';

export const CURSOR = { grab: 'grab', select: 'pointer', scan: 'ew-resize', hold: 'pointer' };
/** the cursor for an object: its own (o.cursor), else its kind's; while pressed, a grab becomes grabbing */
export function cursorOf(o, active = false) { const c = o.cursor || CURSOR[o.kind] || ''; return active && c === 'grab' ? 'grabbing' : c; }
export function affHitTest(o, p, k = 1) {
  if (!o.hit || !p) return false;
  if (o.hit.rect) { const [x0, y0, x1, y1] = o.hit.rect, pad = (k - 1) * 12; return p.x >= x0 - pad && p.x <= x1 + pad && p.y >= y0 - pad && p.y <= y1 + pad; }
  return Math.hypot(p.x - o.at[0], p.y - o.at[1]) <= o.hit.r * k;
}
/** the one affordance mark: mode 'hover' | 'focus' | 'active' | 'released'; a is its strength (0–1) */
export function drawAffordance(g, o, mode, a) {
  if (a <= 0.01 || !o.at || o.mark === false) return;   // mark: false — the cursor alone answers (a volume, where a ring would read as a bead)
  const act = mode === 'active';
  if (o.kind === 'select' && o.bracket) {
    let [x0, x1, y] = o.bracket; const xc = (x0 + x1) / 2; x0 = Math.min(x0, xc - 7); x1 = Math.max(x1, xc + 7);   // at least 14 px: a narrow structure still reads
    Ink.line(g, [[x0, y - 3], [x0, y], [x1, y], [x1, y - 3]], { w: act ? 1.2 : 0.8, c: TK.accent, a: 0.85 * a });
    return;
  }
  if (o.kind === 'hold' && o.ellipse) { const [rx, ry] = o.ellipse; g.save(); g.strokeStyle = TK.accent; g.globalAlpha = (act ? 0.9 : 0.75) * a; g.lineWidth = act ? 1.1 : 0.8; if (!act) g.setLineDash([2, 4]); g.beginPath(); g.ellipse(o.at[0], o.at[1], rx, ry, 0, 0, Math.PI * 2); g.stroke(); g.restore(); return; }
  if (o.kind === 'hold' && o.ring) { Ink.ring(g, o.at[0], o.at[1], o.ring, { c: TK.accent, w: act ? 1.1 : 0.8, a: (act ? 0.9 : 0.75) * a, dash: act ? null : [2, 4] }); return; }
  Ink.ring(g, o.at[0], o.at[1], act ? 6 : 9, { c: TK.accent, w: act ? 1.2 : 0.8, a: 0.9 * a });
}
// ---------------------------------------------------------------------------------------------- onboarding state: once per session (a new session sees every first-encounter reveal again)
// First-use hints and first-encounter reveals are remembered for this browser session only (sessionStorage, with an
// in-memory fallback): a new session sees the causal formations again; within a session the interface grows quieter.
const _mem = new Set();
export function onboarded(key) { try { return sessionStorage.getItem('lya.' + key) === '1'; } catch (e) { return _mem.has(key); } }
export function markOnboarded(key) { _mem.add(key); try { sessionStorage.setItem('lya.' + key, '1'); } catch (e) {} }
export function clearOnboarding() { _mem.clear(); try { for (const k of Object.keys(sessionStorage)) if (k.startsWith('lya.')) sessionStorage.removeItem(k); for (const k of Object.keys(localStorage)) if (/^lya\.(hint|b\d+)\./.test(k)) localStorage.removeItem(k); } catch (e) {} }
export function hintUsed(key) { return onboarded('hint.' + key); }
export function markHint(key) { markOnboarded('hint.' + key); }
/** a first-use hint beside its object: text at hint.at, a hairline arrow toward the object; a ∈ [0, 1] */
export function drawHint(g, o, a) {
  const h = o.hint; if (!h || a <= 0.01) return;
  const [tx, ty] = h.at, [ox, oy] = o.at, align = h.align || (tx > ox ? 'left' : 'right');
  Ink.note(g, h.text, tx, ty, { align, size: 13.5, c: TK.graphite, a });
  const sx = align === 'left' ? tx - 6 : tx + 6, sy = ty - 5, L = Math.hypot(ox - sx, oy - sy) || 1, ex = ox - (ox - sx) / L * 14, ey = oy - (oy - sy) / L * 14;
  if (L > 24 && !h.noArrow) Ink.arrow(g, sx, sy, ex, ey, { w: 0.7, c: TK.graphite, a, head: 4 });   // noArrow: a hint that must not point at one option
}
export const affFade = (t0, now, dur) => clamp((now - t0) / dur, 0, 1);
