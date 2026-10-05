/* Beat 7 · Distance and observed colour are not the same coordinate (SCI-MAP-001…005, SCI-REP-003). The reader holds the
 * gas's motion: grab a parcel's velocity arrow and drag its line-of-sight peculiar velocity; its real-space place stays put.
 * The gas itself is the object — touching it selects the parcel and never changes its motion (in Beat 6, dragging the gas
 * moves its place; one gesture never means two things). Every frame recomputes, from that physical state, the threads from each sub-cell's position x to where
 * it lands, u = aH·x + v_pec (lyaphys parcelToCells — the same cells the parcel's τ comes from), the parcel's optical
 * depth and the flux. Crossing, folding and blending emerge; nothing is canned. Baselines: expansion alone (v_pec = 0,
 * no internal gradient) and the toy's own velocities. Touch velocity space to see which gas lands at that colour.
 * First encounter: expansion alone, then the simulation's velocities grow in (every intermediate is a physical state). */
import { TK } from '../design/tokens.js';
import { Ink } from '../design/ink.js';
import { clamp, ease } from '../core/util.js';
import { App, sinceEnter } from '../core/app.js';
import { metaEqs } from '../core/meta.js';
import { P } from '../physics/lya.js';
import { onboarded, markOnboarded } from '../primitives/affordance.js';
import { AFF } from '../core/runtime.js';
import { motionLaw, measuredVpec, pushStart, pushTo, drawMotion } from '../primitives/motion.js';
import { SC, tauParcel, parcelCells } from '../data/scene-data.js';
import { WX, wmx, wmu, UG_W, contextStrip, xRuler, uRuler } from '../primitives/sightline.js';
import { fibres } from '../primitives/material.js';

let LAW7 = { px: 0.45, domain: [-200, 200], key: 5 }, VS7 = LAW7.px;   // the shared motion law (primitives/motion.js, INT-VPEC-001): one px-per-km/s scale for every velocity arrow here
export const F7 = { every: 4, sMax: 2.75, weave: 1.4, intro: [0.9, 1.6], yR: 150, yV: 400 };   // fibres: every 4th of 161 sub-cells within ±2.75σ; entry weave, intro [delay, duration] [s]
const ID = ['a', 'b', 'c'];
const vDom = () => LAW7.domain;
function b7seen() { return onboarded('b7.revealed'); }   // once per session
function b7mark() { markOnboarded('b7.revealed'); }
/** the physical state now: each parcel's bulk v_pec and whether it carries the simulation's internal velocity gradient.
 * During the first-encounter reveal the simulation's velocities grow in as v = f·v_sim (each frame a physical state). */
export function b7parcels(S) {
  let f = 1;
  if (S._intro && !App.shoot && !App.rm) { const t = App.t - S._intro; f = ease(clamp((t - F7.intro[0]) / F7.intro[1], 0, 1)); if (t > F7.intro[0] + F7.intro[1]) { S._intro = null; b7mark(); } }
  else if (S._intro) { S._intro = null; f = 1; }
  return SC.parcels.map(p => ({ ...p, v: S._introTo ? S['v' + p.id] * (S._intro ? f : 1) : S['v' + p.id], dvdx: (p.dvdx || 0) * (S.grad ? (S._intro ? f : 1) : 0) }));
}
/** the fibres of one parcel: real-space x → landed u for its sub-cells (the cells tauParcel uses), alpha ∝ column share */
export function b7fibres(p) {
  const cells = parcelCells(p), Nmax = Math.max(...cells.map(c => c.N)), out = [];
  cells.forEach((c, k) => { const s = (c.x - p.x) / p.sx; if (k % F7.every === 0 && Math.abs(s) <= F7.sMax) out.push({ x: c.x, u: c.u, w: c.N / Nmax, c }); });
  return out;
}
/** which gas lands at velocity u: each parcel's sub-cells' own optical depth there (thermal kernel, lyaphys tauContributions) */
function b7landingAt(ps, u) {
  const out = [];
  for (const p of ps) { const parts = P.tauContributions(u, parcelCells(p), { cut: 6 }), tot = parts.reduce((s, q) => s + q.tau, 0); if (tot > 1e-4) out.push({ p, tot, x: parts.reduce((s, q) => s + q.cell.x * q.tau, 0) / tot, parts }); }
  const T = out.reduce((s, q) => s + q.tot, 0);
  return out.filter(q => q.tot >= 0.05 * T).sort((a, b) => b.tot - a.tot);   // the parcels carrying ≥ 5 % of the optical depth at u (as Beat 12's traced share)
}
function b7setSim(S) { SC.parcels.forEach(p => { S['v' + p.id] = Math.round(p.v); }); S.grad = 1; }
function b7setExp(S) { SC.parcels.forEach(p => { S['v' + p.id] = 0; }); S.grad = 0; }

export const sceneDistance = {
  n: 7,
  slug: 'distance-vs-colour',
  keys: 'a, b, c choose a parcel; left and right arrows change its velocity along the line of sight; 0 sets expansion alone, s the toy’s velocities; [ and ] move along velocity space to see which gas lands there; Escape clears.',
  eqs: () => metaEqs(7),
  persist: ['va', 'vb', 'vc', 'grad', 'pick'],
  controls: [{ type: 'button', role: 'baseline', why: 'a baseline: every parcel without its own motion (expansion only), for comparison', label: 'expansion alone', act: S => { b7setExp(S); S._intro = null; } },
    { type: 'button', role: 'reset', why: 'restores the toy sightline’s own velocities after the reader has pushed the gas', label: 'the toy’s velocities', act: S => { b7setSim(S); S._intro = App.t - F7.intro[0]; S._introTo = true; } }],
  tour: [
    { say: 'three parcels from the same stretch: each lands at its recession plus its own motion' },
    { say: 'expansion alone: farther gas recedes faster, so they land in order of distance', do: (S, H) => H.press('expansion alone') },
    { say: 'push the middle parcel toward us: it lands before its neighbour — colour order is not distance order', int: 'INT-VPEC-001', do: S => { S.pick = 'b'; }, dissolve: false, to: { vb: -180 }, dur: 2.4 },
    { say: 'the toy’s own motions: the two farther parcels land almost on top of each other', do: (S, H) => H.press('the toy’s velocities') },
  ],
  init(S) { LAW7 = motionLaw(7, 'INT-VPEC-001'); VS7 = LAW7.px; S.pick = 'b'; b7setSim(S); S._introTo = true; S._intro = b7seen() ? null : App.t; },
  afterHash(S) {
    if (S.stage != null) { if (+S.stage >= 3) b7setSim(S); else b7setExp(S); S._intro = null; }   // old step URLs and stills
    if (S.mode === 'expansion') b7setExp(S); else if (S.mode === 'sim') b7setSim(S);
    const d = vDom(); for (const id of ID) S['v' + id] = clamp(+S['v' + id] || 0, d[0], d[1]); S.grad = +S.grad ? 1 : 0;
  },
  draw(g, S) {
    const { yR, yV } = F7, ps = b7parcels(S), pick = S.pick || 'b', weave = clamp(sinceEnter() / F7.weave, 0, 1);
    const scan = S._uh != null ? b7landingAt(ps, S._uh) : null, scanIds = scan ? new Set(scan.map(q => q.p.id)) : null, dragging = !!S._dragP;
    Ink.label(g, 'real space', WX.x0 - 70, yR + 4); contextStrip(g, yR, 12, 0.15);
    // the re-weaving: threads from where the gas is to where it lands (behind the gas); while scanning, only the gas landing there
    for (const p of ps) {
      const on = p.id === pick, fade = scan ? (scanIds.has(p.id) ? 1 : 0.25) : dragging && !on ? 0.55 : 1;
      const list = b7fibres(p).map(f => { const w = scan ? Math.exp(-(((f.u - S._uh) / Math.max(f.c.b, 1)) ** 2)) : Math.pow(f.w, 1.6); return { x0: wmx(f.x), y0: yR + 52, x1: wmu(f.u), y1: yV - 13, a: (on || scan ? 0.75 : 0.5) * w * fade, p: ease(weave) }; });
      fibres(g, list, { w: on ? 0.7 : 0.55, c: on || scan ? TK.accent : TK.graphite });
    }
    for (const p of ps) {
      const on = p.id === pick, col = on ? TK.accent : TK.ink, x = wmx(p.x);
      Ink.smudge(g, x, yR, wmx(p.sx) - wmx(0), 12, { c: col, a: 0.65 });
      Ink.note(g, p.id, x, yR - 18, { align: 'center', size: 16, c: col });
      const vh = SC.HUB * p.x, yh = yR - 62 - 9 * ID.indexOf(p.id); Ink.arrow(g, x, yh, x + vh * VS7, yh, { w: 0.9, c: TK.pencil, head: 4 }); Ink.seg(g, x, yh - 3, x, yh + 3, { w: 0.8, c: TK.pencil });
      // the motion (shared instrument): for the selected parcel, the simulation's own range (faint band) inside the sandbox's end ticks
      drawMotion(g, x, yR - 40, p.v, LAW7, { col, on, rangeLabel: S._dragP === p.id || Math.abs(p.v - Math.round(SC.parcels[ID.indexOf(p.id)].v)) > 0.5 });
      if (on && S._selNote != null && App.t - S._selNote < 2) Ink.mono(g, 'its motion is this arrow — drag the arrow', x + p.v * VS7 + (p.v >= 0 ? 40 : -40), yR - 54, { align: p.v >= 0 ? 'left' : 'right', size: 9.5, c: TK.accent });
    }
    Ink.mono(g, 'grey: recession from expansion, from the near edge · solid: each parcel’s own motion — drag its arrow · one scale', WX.x0, yR - 98, { size: 10 });
    Ink.seg(g, WX.x0, yR - 118, WX.x0 + 100 * VS7, yR - 118, { w: 1, c: TK.graphite }); Ink.mono(g, '100 km/s', WX.x0 + 100 * VS7 + 6, yR - 115, { size: 9.5 });
    xRuler(g, yR + 24);
    Ink.label(g, 'velocity space', WX.x0 - 70, yV + 4); Ink.seg(g, wmx(-0.4), yV, wmx(4.8), yV, { w: 0.6, c: TK.faint });
    for (const p of ps) {
      const on = p.id === pick, grad = p.dvdx || 0, uc = SC.HUB * p.x + p.v, su = Math.max(0.02, Math.abs(SC.HUB + grad) * p.sx);
      if (Math.abs(p.v) > 2) { g.save(); g.setLineDash([3, 3]); g.strokeStyle = TK.pencil; g.globalAlpha = 0.9; g.beginPath(); g.ellipse(wmu(SC.HUB * p.x), yV, (wmu(SC.HUB * p.sx) - wmu(0)) * 1.5, 9, 0, 0, Math.PI * 2); g.stroke(); g.restore(); }
      Ink.smudge(g, wmu(uc), yV, wmu(su) - wmu(0), 12, { c: on ? TK.accent : TK.ink, a: 0.65 * clamp(weave * 1.6 - 0.6, 0, 1) });
      Ink.note(g, p.id, wmu(uc), yV - 20, { align: 'center', size: 16, c: on ? TK.accent : TK.ink });
    }
    uRuler(g, yV + 30);
    { const p = ps[ID.indexOf(pick)], u = SC.HUB * p.x + p.v, X = wmu(u);   // the ruler reads where the held gas lands
      if (X > WX.x0 && X < WX.x1) { Ink.seg(g, X, yV + 24, X, yV + 36, { w: 1.4, c: TK.accent }); Ink.mono(g, `${p.id} lands at ${Math.round(u)} km/s`, X, yV + 22, { align: X > 900 ? 'right' : 'center', size: 9.5, c: TK.accent }); }
      else Ink.mono(g, `${p.id} lands at ${Math.round(u)} km/s — beyond this stretch ${X > WX.x1 ? '→' : '←'}`, X > WX.x1 ? WX.x1 : WX.x0, yV + 22, { align: X > WX.x1 ? 'right' : 'left', size: 9.5, c: TK.accent }); }   // as Beat 6
    // the spectrum, recomputed from the physical state (memoised on exact inputs: unchanged parcels are not recomputed)
    const ug = UG_W(), tauT = new Float64Array(ug.length);
    for (const p of ps) { const tp = tauParcel(ug, p, { profile: 'voigt' }); for (let i = 0; i < ug.length; i++) tauT[i] += tp[i]; }
    const F = Array.from(tauT, v => Math.exp(-v)), f1 = 530, f0 = 700, mf = f => f0 - f * (f0 - f1);
    Ink.label(g, 'what reaches us (flux) — down is less light', WX.x0, f1 - 18);
    Ink.fillUnder(g, ug, F, wmu, mf, mf(1), { c: TK.wash, a: 0.18 }); Ink.curve(g, ug, F, wmu, mf, { w: 1.6 });
    Ink.seg(g, wmx(-0.4), mf(1), wmx(4.8), mf(1), { w: 0.6, c: TK.faint, dash: [2, 4] }); Ink.mono(g, '1', WX.x0 - 10, mf(1) + 3, { align: 'right' }); Ink.mono(g, '0', WX.x0 - 10, mf(0) + 3, { align: 'right' });
    // touching velocity space: which gas lands here, and where it is in real space
    if (scan) {
      const X = wmu(S._uh), i = clamp(Math.round((S._uh - ug[0]) / (ug[1] - ug[0])), 0, ug.length - 1);
      Ink.seg(g, X, yV - 14, X, f0, { w: 0.8, c: TK.accent, dash: [2, 3] }); Ink.dot(g, X, mf(F[i]), 3.5, { c: TK.accent });
      for (const q of scan) Ink.seg(g, wmx(q.x), yR + 16, wmx(q.x), yR + 22, { w: 1.6, c: TK.accent });
      const txt = scan.length ? scan.map(q => `${q.p.id} (x ≈ ${q.x.toFixed(2)})`).join(' and ') : 'no parcel';
      Ink.mono(g, `${Math.round(S._uh)} km/s: ${txt} ${scan.length > 1 ? 'land here' : 'lands here'}`, X + (X > 760 ? -8 : 8), yV + 76, { align: X > 760 ? 'right' : 'left', size: 10.5, c: TK.accent });
    }
    // what emerges: b and c in the spectrum (from the state, not a canned step)
    const ub = SC.HUB * ps[1].x + ps[1].v, uc = SC.HUB * ps[2].x + ps[2].v;
    if (!S.conceal && !scan) {
      if (ub > uc + 2) Ink.note(g, 'b now lands redder than c — the reverse of their order in space', wmx(4.8), 752, { size: 15, c: TK.accent, align: 'right' });
      else if (Math.abs(uc - ub) < 25) Ink.note(g, `b and c: ${(ps[2].x - ps[1].x).toFixed(2)} Mpc/h apart in space, ${Math.abs(Math.round(uc) - Math.round(ub))} km/s apart in the spectrum`, wmx(2.1), 752, { size: 15, c: TK.accent });
    }
  },
  affordances(S) {
    const { yR, yV } = F7, ps = b7parcels(S), out = [];
    for (const p of ps) {   // the velocity arrow is the motion control; the gas is the object (touching it selects the parcel)
      const x = wmx(p.x), tip = x + p.v * VS7, sx = Math.max(14, wmx(p.sx) - wmx(0));
      out.push({ id: 'vel:' + p.id, name: `parcel ${p.id}’s velocity arrow (drag it)`, kind: 'grab', int: 'INT-VPEC-001', at: [tip, yR - 40], hit: { rect: [Math.min(x, tip) - 12, yR - 52, Math.max(x, tip) + 12, yR - 30] },
        hint: p.id === 'b' ? { key: 'b7.vpec', text: 'push it: drag its velocity arrow', at: [tip + 46, yR - 58], align: 'left' } : null });
      out.push({ id: 'sel:' + p.id, name: `parcel ${p.id} (select it)`, kind: 'select', int: 'INT-PICK-001', at: [x, yR], bracket: [x - sx, x + sx, yR + 15], hit: { rect: [x - sx, yR - 16, x + sx, yR + 14] } });
    }
    out.push({ id: 'vscan', name: 'velocity space (which gas lands here?)', kind: 'scan', int: 'INT-VSCAN-001', at: [wmu(S._uh ?? SC.HUB * 2.2), yV], hit: { rect: [WX.x0, yV - 24, WX.x1, yV + 44] } });
    return out;
  },
  kbTarget: S => (S._uh != null ? 'vscan' : 'vel:' + (S.pick || 'b')),
  onPointer(type, p, S) {
    if (!p) { if (!S._uhPin) S._uh = null; return; }
    if (type === 'down' && S._intro) { S._intro = null; b7mark(); }   // a touch hands the gas to the reader
    const d = vDom();
    if (type === 'down' && p.aff && p.aff.startsWith('vel:')) { const id = p.aff.slice(4); S.pick = id; S._dragP = id; S._push = pushStart(S['v' + id], p); S._uh = null; S._uhPin = false; return; }
    if (type === 'down' && p.aff && p.aff.startsWith('sel:')) { S.pick = p.aff.slice(4); S._uh = null; S._uhPin = false; S._selX = p.x; return; }   // the gas: select it (its motion is its arrow's)
    if (type === 'drag' && S._selX != null && Math.abs(p.x - S._selX) > 8) { S._selNote = App.t; AFF.nudge = App.t; S._selX = null; return; }   // dragged like the arrow: point to the arrow (the nudge a reading gives)
    if (type === 'drag' && S._dragP) { S['v' + S._dragP] = pushTo(S._push, p, LAW7); return; }   // the physical state; everything else is recomputed from it
    if (type === 'up') { S._dragP = null; S._selX = null; return; }
    if (p.aff === 'vscan') { S._uh = clamp((p.x - WX.x0) / (WX.x1 - WX.x0) * (WX.xb - WX.xa) * SC.HUB + WX.xa * SC.HUB, SC.HUB * WX.xa, SC.HUB * WX.xb); if (type === 'down') S._uhPin = !!p.touch; return; }
    if (type === 'move' && !S._uhPin) S._uh = null;
    if (type === 'down') { S._uhPin = false; S._uh = null; }
  },
  onKey(k, S) {
    if (S._intro) { S._intro = null; b7mark(); }
    const d = vDom();
    if (ID.includes(k)) { S.pick = k; S._uh = null; return true; }
    if (k === 'ArrowRight' || k === 'ArrowLeft') { const key = 'v' + (S.pick || 'b'); S[key] = clamp(S[key] + (k === 'ArrowRight' ? LAW7.key : -LAW7.key), d[0], d[1]); return true; }
    if (k === '0') { b7setExp(S); return true; }
    if (k === 's') { b7setSim(S); return true; }
    if (k === '[' || k === ']') { S._uh = clamp((S._uh ?? SC.HUB * 2.2) + (k === ']' ? 10 : -10), SC.HUB * WX.xa, SC.HUB * WX.xb); return true; }
    if (k === 'Escape' && S._uh != null) { S._uh = null; S._uhPin = false; return true; }
    return false;
  },
  describe(S) {
    const ps = b7parcels(S);
    if (S._uh != null) { const sc = b7landingAt(ps, S._uh); return `At ${Math.round(S._uh)} km/s in velocity space: ${sc.length ? sc.map(q => `parcel ${q.p.id} from ${q.x.toFixed(2)} Mpc/h`).join(', ') : 'no parcel'}.`; }
    return `Parcels a, b, c at ${ps.map(p => p.x.toFixed(2)).join(', ')} Mpc/h move at ${ps.map(p => `${Math.round(p.v)}`).join(', ')} km/s along the line of sight and land at ${ps.map(p => (SC.HUB * p.x + p.v).toFixed(0)).join(', ')} km/s.`;
  },
  foot: 'three-parcel decomposition of the toy sightline; velocities are the toy’s means, weighted by neutral hydrogen, unless moved (SCI-REP-003) · drag range: INT-VPEC-001',
};
