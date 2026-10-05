/* Ink primitives: the drawing vocabulary of every scene (design/VISUAL_LANGUAGE.md §4).
 * Guard: text drawn in a non-text token (pencil, wash, faint, hair) is recorded in DESIGN_LINT; app/smoke.mjs fails on it. */
import { TK, FONTS, TEXT_TOKENS } from './tokens.js';
import { rgba } from '../core/util.js';

const TEXT_HEX = new Set(TEXT_TOKENS.map(k => TK[k].toUpperCase()));
export const DESIGN_LINT = { hits: [], scene: '' };
function lintText(s, c) {
  if (!TEXT_HEX.has(String(c).toUpperCase()) && DESIGN_LINT.hits.length < 200) {
    const key = `${DESIGN_LINT.scene}: "${String(s).slice(0, 40)}" in ${Object.keys(TK).find(k => TK[k] === c) || c}`;
    if (!DESIGN_LINT.hits.includes(key)) DESIGN_LINT.hits.push(key);
  }
}

export const Ink = {
  line(g, pts, { w = 1.4, c = TK.ink, a = 1, dash = null } = {}) { if (pts.length < 2) return; g.save(); g.strokeStyle = rgba(c, a); g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round'; if (dash) g.setLineDash(dash); g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.stroke(); g.restore(); },
  seg(g, x0, y0, x1, y1, o) { Ink.line(g, [[x0, y0], [x1, y1]], o); },
  poly(g, pts, { c = TK.wash, a = 0.2 } = {}) { g.save(); g.fillStyle = rgba(c, a); g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); g.fill(); g.restore(); },
  dot(g, x, y, r, { c = TK.ink, a = 1 } = {}) { g.save(); g.fillStyle = rgba(c, a); g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.restore(); },
  ring(g, x, y, r, { c = TK.ink, a = 1, w = 1, dash = null } = {}) { g.save(); g.strokeStyle = rgba(c, a); g.lineWidth = w; if (dash) g.setLineDash(dash); g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke(); g.restore(); },
  arrow(g, x0, y0, x1, y1, { w = 1, c = TK.ink, a = 1, head = 6, bend = 0, dash = null } = {}) {
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, cx = mx - dy / L * bend, cy = my + dx / L * bend;
    g.save(); g.strokeStyle = rgba(c, a); g.lineWidth = w; g.lineCap = 'round'; if (dash) g.setLineDash(dash);
    g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(cx, cy, x1, y1); g.stroke(); g.setLineDash([]);
    if (head > 0 && L > 2) { const an = Math.atan2(y1 - cy, x1 - cx); g.beginPath(); g.moveTo(x1 - head * Math.cos(an - 0.4), y1 - head * Math.sin(an - 0.4)); g.lineTo(x1, y1); g.lineTo(x1 - head * Math.cos(an + 0.4), y1 - head * Math.sin(an + 0.4)); g.stroke(); }
    g.restore();
  },
  text(g, s, x, y, { f = 'sans', size = 13, c = TK.ink, a = 1, align = 'left', italic = false, weight = 300, base = 'alphabetic' } = {}) { lintText(s, c); g.save(); g.font = `${italic ? 'italic ' : ''}${weight} ${size}px ${FONTS[f]}`; g.fillStyle = rgba(c, a); g.textAlign = align; g.textBaseline = base; g.fillText(s, x, y); g.restore(); },
  label(g, s, x, y, o = {}) { Ink.text(g, s, x, y, { f: 'sans', size: 12, c: TK.muted, ...o }); },
  mono(g, s, x, y, o = {}) { Ink.text(g, s, x, y, { f: 'mono', size: 10.5, c: TK.muted, weight: 400, ...o }); },
  note(g, s, x, y, o = {}) { Ink.text(g, s, x, y, { f: 'serif', size: 15, c: TK.graphite, italic: true, ...o }); },
  curve(g, xs, ys, mx, my, o) { Ink.line(g, xs.map((x, i) => [mx(x), my(ys[i])]), o); },
  fillUnder(g, xs, ys, mx, my, yBase, o) { const pts = xs.map((x, i) => [mx(x), my(ys[i])]); pts.push([mx(xs[xs.length - 1]), yBase], [mx(xs[0]), yBase]); Ink.poly(g, pts, o); },
  /** a teaching parcel: horizontal Gaussian smudge */
  smudge(g, cx, cy, sig, halfH, { c = TK.ink, a = 0.6 } = {}) {
    const x0 = cx - 3 * sig, x1 = cx + 3 * sig; if (!(x1 > x0)) return;
    const gr = g.createLinearGradient(x0, 0, x1, 0);
    for (let k = 0; k <= 12; k++) { const s = -3 + 6 * k / 12; gr.addColorStop(k / 12, rgba(c, a * Math.exp(-0.5 * s * s))); }
    g.save(); g.fillStyle = gr; g.beginPath(); g.ellipse(cx, cy, 3 * sig, halfH, 0, 0, Math.PI * 2); g.fill(); g.restore();
  },
  /** soft pigment: a radial falloff of ink (gas, a parcel seen whole) */
  blob(g, x, y, r, { c = TK.ink, a = 0.3 } = {}) { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, rgba(c, a)); gr.addColorStop(0.55, rgba(c, a * 0.5)); gr.addColorStop(1, rgba(c, 0)); g.save(); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.restore(); },
  /** a hairline ruler: graphite line, 4 px ticks, mono labels, the axis label under the right end */
  ruler(g, x0, x1, y, { map, ticks = [], label = '', side = 1, c = TK.graphite, tick = 4, size = 10 } = {}) {
    Ink.seg(g, x0, y, x1, y, { w: 0.8, c });
    for (const t of ticks) { const v = t.v != null ? t.v : t, px = map(v); if (px < x0 - 1 || px > x1 + 1) continue; Ink.seg(g, px, y, px, y + side * tick, { w: 0.8, c }); Ink.mono(g, t.s != null ? t.s : String(v), px, y + side * (tick + 11) + (side < 0 ? 6 : 0), { align: 'center', size }); }
    if (label) Ink.label(g, label, x1, y + side * (tick + 27) + (side < 0 ? 6 : 0), { align: 'right', size: 11.5 });
  },
};
