/* Beat 6 · One parcel, four physical degrees of freedom — the synthesis (SCI-MAP-001/002/003, SCI-TAU-001, SCI-THERM-002,
 * SCI-ION-001, SCI-REP-001/003/005). The reader acts on one parcel of gas on the beam:
 *   move it along the beam   its place x: the recession from the expansion, aH·x, changes (INT-PLACE-001)
 *   push its motion          its own line-of-sight velocity: Beat 7's instrument, primitives/motion.js (INT-PUSH-001)
 *   hold it                  explore warmer gas: Beat 3's law, primitives/hold.js (INT-WARM-001)
 *   its neutral amount       the one explicit setting, a margin instrument: no gesture is physically honest for "more
 *                            neutral atoms" (touching or squeezing gas does not create them; INT-AMOUNT-001)
 * Moving the parcel changes only its place — the same amount, temperature and motion travel with it (no density evolution).
 * Every frame recomputes from (x, v_pec, T, N_HI): the chained arrows u = aH·x + v_pec, where it lands, its optical depth
 * (lyaphys parcelTau) and the drawing of the gas (its neutral atoms: number ∝ N_HI, random motion ∝ σ(T)). The state before
 * a gesture stays as a pencil ghost, with a comparison measured from the two computed profiles (lyaphys lineMoments): what
 * changed and what did not (VAL-ORTH-001). The line's width is printed as it is drawn: heat alone (thermal b) and the
 * parcel's size (the Hubble flow across it) beside the drawn line's own width and peak, measured on the drawn profile.
 * First encounter (once per session): it lands, as wide as its size spreads it, then heat widens its line.
 * Microscope: what sets the neutral amount (relative to the toy's tuned ultraviolet; the measured value marked). */
import { TK } from '../design/tokens.js';
import { Ink } from '../design/ink.js';
import { clamp, scl, logTicks, fmtT, fmtN } from '../core/util.js';
import { App } from '../core/app.js';
import { META, metaEqs, interaction } from '../core/meta.js';
import { learned } from '../core/runtime.js';
import { P } from '../physics/lya.js';
import { onboarded, markOnboarded, hintUsed } from '../primitives/affordance.js';
import { SC, tauParcel } from '../data/scene-data.js';
import { WX, wmx, wmu, UG_W, xRuler, uRuler, inkTrail } from '../primitives/sightline.js';
import { atomPos } from '../primitives/atoms.js';
import { motionLaw, pushStart, pushTo, drawMotion, beyondMeasured } from '../primitives/motion.js';
import { holdLaw, holdBegin, holdDrag, holdT, holdResult } from '../primitives/hold.js';

export const B6 = { yR: 150, yA: 104, yV: 372, yT: 700, hT: 220, tmax: 10, ry: 18, atomPx: 0.45, atoms0: 36, keyX: 0.05, reveal: [0.9, 0.8] };
const PXMPC = (WX.x1 - WX.x0) / (WX.xb - WX.xa);   // px per Mpc/h on the real-space axis: the gas stays under the hand
const KINDS = [['place', 'where it lands'], ['motion', 'where it lands'], ['width', 'how wide'], ['amount', 'how much ink']];
let LAWV = { px: 0.45, domain: [-200, 200], key: 5 }, LAWT = { rate: 0.3, scrub: 0.008, deadband: 6, onset: 0.25, key: 1.12 };
const domX = () => interaction(6, 'INT-PLACE-001').domain || [0.3, 4.1];
const domT = () => interaction(6, 'INT-WARM-001').domain || [2000, 1e5];
const domN = () => interaction(6, 'INT-AMOUNT-001').domain || [12.5, 14.8];
/** the toy sightline's parcel (b of the teaching stretch, SCI-REP-003): the state the scene starts from and resets to */
export function b6sim() { const p = SC.parcels[1]; return { x: +p.x.toFixed(2), v: Math.round(p.v), T: Math.round(p.T), logN: +Math.log10(p.N).toFixed(2) }; }
/** the physical state as a parcel for lyaphys (no internal velocity gradient in this beat) */
export function b6parcel(st) { return { x: st.x, sx: SC.parcels[1].sx, N: 10 ** st.logN, T: st.T, v: st.v, dvdx: 0 }; }
const snap = S => ({ x: S.x, v: S.v, T: S.T, logN: S.logN });
const same = (a, b) => a && b && a.x === b.x && a.v === b.v && a.T === b.T && a.logN === b.logN;
/** a change begins (or continues): the state before it (the last frame drawn) stays as the ghost; the ledger marks what changed */
function b6change(S, kind) {
  if (!S._ref || S._last !== kind || App.t - (S._lastT ?? -9) > 1.2) S._ref = S._prevFrame || snap(S);
  S._last = kind; S._lastT = App.t; (S._seen || (S._seen = {}))[kind] = true;
}
function b6revealed(S) { if (S._reveal != null) { S._reveal = null; markOnboarded('b6.revealed'); } }
/** seconds into the first-encounter reveal (it lands, as wide as its size spreads it; then heat widens its line), or 99 */
function b6tau(S) { if (S._reveal == null || App.shoot || App.rm) return 99; const t = App.t - S._reveal; if (t > B6.reveal[0] + B6.reveal[1] + 0.3) { b6revealed(S); return 99; } return t; }
const sigPx = () => wmx(SC.parcels[1].sx) - wmx(0);

/** the gas: a wash where the parcel is, carrying representative neutral atoms (SCI-REP-001) — their number ∝ N_HI (the gas
 * itself is not enlarged), their random motion ∝ σ(T) (slowed for display; frozen under reduced motion) */
function b6body(g, S, t, x, { a = 1 } = {}) {
  const sig = sigPx(), rx = 2 * sig, ry = B6.ry, n = clamp(Math.round(B6.atoms0 * 10 ** (S.logN - Math.log10(SC.parcels[1].N))), 1, 160);
  Ink.smudge(g, x, B6.yR, sig, ry + 4, { c: TK.accent, a: 0.4 * a });
  g.save(); g.beginPath(); g.ellipse(x, B6.yR, rx, ry, 0, 0, Math.PI * 2); g.clip();
  for (let k = 0; k < n; k++) { const [X, Y] = atomPos(SC.atoms[k], 0, 0, rx, S.T, t, B6.atomPx); Ink.dot(g, x + X, B6.yR + Y * ry / rx, 1.5, { c: TK.ink, a: 0.85 * a }); }
  g.restore();
  return n;
}
/** the comparison grid: the drawn stretch extended on each side (VT-PARCEL-BEFORE thresholds, read from the manifest) */
let _ug6 = null;
const b6cmp = () => (META(6).visual_transforms || []).find(t => t.id === 'VT-PARCEL-BEFORE').thresholds;
function UG6() { if (_ug6) return _ug6; const th = b6cmp(), ug = UG_W(); return (_ug6 = P.linspace(ug[0] - th.grid_pad_kms, ug[ug.length - 1] + th.grid_pad_kms, th.grid_points)); }
/** the comparison with the state before the gesture, measured from the two computed profiles (lyaphys lineMoments) */
export function b6compare(now, before) {
  const ug = UG6(), m1 = P.lineMoments(ug, tauParcel(ug, b6parcel(now), { profile: 'voigt' })), m0 = P.lineMoments(ug, tauParcel(ug, b6parcel(before), { profile: 'voigt' })), e = b6cmp().edge_max;
  if (!(m1.edge < e && m0.edge < e)) return null;   // a profile still running off the grid is not measured
  return { dc: m1.centre - m0.centre, w: m1.fwhm / m0.fwhm, a: m1.area / m0.area };
}
/** the line as drawn: its width (b from its FWHM) and peak, measured on the drawn profile (lyaphys lineMoments), beside the
 * two widths it is made of — heat alone and the parcel's size, the Hubble flow across it (lyaphys parcelWidths). Where the
 * line runs past the drawn stretch it is measured on the comparison grid (the same profile, the stretch padded at the same
 * spacing; VT-PARCEL-BEFORE's edge threshold); off that too, it is not measured. VAL-ORTH-001 checks it. */
export function b6reading(st) {
  const p = b6parcel(st), e = b6cmp().edge_max; let m = P.lineMoments(UG_W(), tauParcel(UG_W(), p, { profile: 'voigt' }));
  if (!(m.edge < e)) m = P.lineMoments(UG6(), tauParcel(UG6(), p, { profile: 'voigt' }));
  return { ...P.parcelWidths(p, SC.HUB), onStretch: m.edge < e, bDrawn: P.bFromFwhm(m.fwhm), peak: m.peak };
}
/** the first-use hint on the gas: move it first; after the push, hold it; then how to go back */
function b6bodyHint(S, x, rx) {
  const right = x < 560, at = right ? [x + rx + 22, B6.yR - 30] : [x - rx - 22, B6.yR - 30], align = right ? 'left' : 'right';
  if (!hintUsed('b6.place')) return { key: 'b6.place', text: 'move the gas along the beam', at, align };
  if (hintUsed('b6.motion') && !hintUsed('b6.warm')) return { key: 'b6.warm', text: 'hold the gas to explore warmer gas', at, align };
  if (hintUsed('b6.warm') && !hintUsed('b6.cool') && !hintUsed('b3.cool')) return { key: 'b6.cool', text: 'hold and drag down: cooler gas', at, align };
  return null;
}
const sgn = v => (v > 0 ? '+' : v < 0 ? '−' : '±');

export const sceneParcel = {
  n: 6,
  slug: 'one-parcel-lands',
  keys: 'Left and right arrows move the parcel along the beam; [ and ] change its own motion; up and down arrows explore warmer and cooler gas. The amount of neutral hydrogen is a setting in the margin.',
  eqs: S => { const r = b6reading(S); return metaEqs(6, [{ note: `now: u = ${(SC.HUB * S.x).toFixed(0)} ${S.v >= 0 ? '+' : '−'} ${Math.abs(S.v).toFixed(0)} = ${(SC.HUB * S.x + S.v).toFixed(0)} km/s`, ids: ['SCI-MAP-001'] },
    { note: `its width now: heat alone b = ${r.bThermal.toFixed(1)} km/s · its size (the Hubble flow across it) ${r.bSize.toFixed(1)} km/s · together, the drawn line: ` + (r.onStretch ? `b = ${r.bDrawn.toFixed(1)} km/s, peak τ = ${r.peak.toFixed(2)}` : 'not measured here'), ids: ['SCI-THERM-002', 'SCI-REP-003', 'SCI-TAU-001'] }]); },
  persist: ['x', 'v', 'T', 'logN'],
  kbLearns: true,   // the keys say which gesture they stand for (learned() below); the runtime does not guess from the focused object
  get controls() {
    const read = (key, label, dom, fmt, ticks, lk, kind, more = {}) => ({ type: 'ruler', key, label, readout: true, int: { place: 'INT-PLACE-001', motion: 'INT-PUSH-001', width: 'INT-WARM-001' }[kind], operable: () => hintUsed(lk) || App.adv, title: `a reading — ${more.how}`, titleOperable: 'a reading; drag it for a precise value', min: dom[0], max: dom[1], fmt, ticks, onChange: S => b6change(S, kind), ...more });
    return [
      read('x', 'where it is (distance along the beam)', domX(), v => `${v.toFixed(2)} Mpc/h`, [1, 2, 3, 4].map(v => ({ v, s: String(v) })), 'b6.place', 'place', { step: 0.01, how: 'move the gas along the beam' }),
      read('v', 'its own motion along the line of sight', LAWV.domain, v => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)} km/s`, [-200, -100, 0, 100, 200].map(v => ({ v, s: v > 0 ? `+${v}` : v < 0 ? `−${-v}` : '0' })), 'b6.motion', 'motion', { step: 1, how: 'push it: drag its motion arrow' }),
      read('T', 'temperature of the gas', domT(), fmtT, logTicks([3e3, 1e4, 3e4, 1e5], v => v >= 1e5 ? '1e5' : v >= 1e4 ? `${v / 1e4}e4` : `${v / 1e3}e3`), 'b6.warm', 'width', { log: true, how: 'hold the gas to explore warmer gas' }),
      { type: 'ruler', key: 'logN', role: 'instrument', int: 'INT-AMOUNT-001', label: 'how much neutral hydrogen (atoms per cm² along the beam)', caption: 'a setting — its place, motion and temperature stay as they are', why: 'no gesture is physically honest for adding neutral atoms (touching or squeezing gas does not create them; enlarging the gas would change its size, not N_HI); what sets the amount in nature is in the microscope', min: domN()[0], max: domN()[1], step: 0.01, fmt: v => fmtN(10 ** v), ticks: [{ v: 13, s: '10¹³' }, { v: 14, s: '10¹⁴' }], onChange: S => b6change(S, 'amount') },
      { type: 'button', role: 'replay', why: 'the quiet replay of the first-encounter reveal (once per session): it lands, as wide as its size spreads it, then heat widens its line', label: 'replay: it lands, then heat widens its line', act: S => { S._reveal = App.t; } },
      { type: 'button', role: 'reset', why: 'restores the toy’s parcel after the reader has moved, pushed, warmed or re-set it', label: 'back to the toy’s parcel', act: S => { Object.assign(S, b6sim()); S._ref = null; S._last = null; S._prevFrame = null; } },
    ];
  },
  init(S) {
    LAWV = motionLaw(6, 'INT-PUSH-001'); LAWT = holdLaw(6, 'INT-WARM-001');
    Object.assign(S, b6sim()); S._ref = null; S._last = null; S._seen = {}; S._hold = null; S._push = null;
    S._reveal = onboarded('b6.revealed') ? null : App.t + 0.4;
  },
  afterHash(S) {   // stills: ref=sim keeps the simulation's parcel as the ghost; last=<kind> marks what changed; seen=all shows every effect
    const dx = domX(), dt = domT(), dn = domN(), s0 = b6sim();
    S.x = clamp(+S.x || s0.x, dx[0], dx[1]); S.v = clamp(Math.round(+S.v || 0), LAWV.domain[0], LAWV.domain[1]); S.T = clamp(+S.T || s0.T, dt[0], dt[1]); S.logN = clamp(+S.logN || s0.logN, dn[0], dn[1]);
    if (S.ref === 'sim') S._ref = s0;
    if (typeof S.last === 'string') { S._last = S.last; S._seen = { [S.last]: true }; }
    if (S.seen === 'all') S._seen = { place: true, motion: true, width: true, amount: true };
  },
  draw(g, S, t) {
    const { yR, yA, yV, yT, hT, tmax } = B6;
    if (S._hold && !S._hold.move) { const T = holdT(S._hold, LAWT, domT(), App.t); if (T !== S.T) { b6change(S, 'width'); S.T = T; } }   // the hold explores warmer gas
    const rt = b6tau(S), trail = rt === 99 ? 1 : clamp((rt - 0) / B6.reveal[0], 0, 1), spread = rt === 99 ? 1 : clamp((rt - B6.reveal[0]) / B6.reveal[1], 0, 1);
    const x = wmx(S.x), sig = sigPx(), rx = 2 * sig, uH = SC.HUB * S.x, uL = uH + S.v, ref = S._ref && !same(S._ref, snap(S)) ? S._ref : null;
    // real space: the beam, the gas, its own motion
    Ink.label(g, 'real space', WX.x0 - 70, yR + 4);
    Ink.seg(g, WX.x0, yR, WX.x1, yR, { w: 0.6, c: TK.faint });
    if (ref && ref.x !== S.x) { g.save(); g.setLineDash([3, 3]); g.strokeStyle = TK.pencil; g.lineWidth = 0.9; g.beginPath(); g.ellipse(wmx(ref.x), yR, rx, B6.ry, 0, 0, Math.PI * 2); g.stroke(); g.restore(); }
    const nAtoms = b6body(g, S, t, x);
    Ink.note(g, 'one parcel of gas', x, yA - 34, { align: 'center', size: 14, c: TK.accent });
    drawMotion(g, x, yA, S.v, LAWV, { rangeLabel: !!S._push || Math.abs(S.v - b6sim().v) > 0.5 });
    const holding = S._hold && !S._hold.move;
    if ((S._last === 'width' && !(S._hold && S._hold.move)) || holding) Ink.mono(g, `T = ${fmtT(S.T)}`, x + 3 * sig + 8, yR + 4, { size: 10.5, c: holding ? TK.accent : TK.muted });   // the reading travels with the gas
    else if (S._last === 'amount' && ref) Ink.mono(g, `neutral atoms ×${(10 ** (S.logN - ref.logN)).toFixed(2)} · the same gas`, x + 3 * sig + 8, yR + 4, { size: 10.5, c: TK.muted });
    xRuler(g, yR + 34);
    const right = wmu(uL) < x;   // the reading sits on the side the trail does not take
    Ink.seg(g, x, yR + 28, x, yR + 40, { w: 1.4, c: TK.accent }); Ink.mono(g, `${S.x.toFixed(2)} Mpc/h`, x + (right ? 6 : -6), yR + 30, { size: 9.5, c: TK.accent, align: right ? 'left' : 'right' });
    // the mapping: from where it is to where it lands, u = aH·x + v_pec, as two chained arrows
    const X0 = wmu(0), XH = wmu(uH), XL = wmu(uL), on = XL >= WX.x0 && XL <= WX.x1;
    inkTrail(g, x, yR + 22, clamp(XL, 4, 1066), yV - 8, trail);
    Ink.label(g, 'velocity space', WX.x0 - 70, yV + 4); Ink.seg(g, wmx(-0.4), yV, wmx(4.8), yV, { w: 0.6, c: TK.faint });
    g.save(); g.globalAlpha = trail;
    Ink.seg(g, X0, yV - 34, X0, yV - 26, { w: 0.8, c: TK.pencil }); Ink.arrow(g, X0, yV - 30, XH, yV - 30, { w: 1, c: TK.pencil, head: 4 });
    Ink.mono(g, `recession from the expansion: ${Math.round(uH)} km/s`, Math.max(X0, (X0 + XH) / 2), yV - 38, { align: XH - X0 > 220 ? 'center' : 'left', size: 9.5 });
    Ink.seg(g, XH, yV - 30, XH, yV - 10, { w: 0.6, c: TK.pencil, dash: [2, 2] });
    if (Math.abs(S.v) >= 1) Ink.arrow(g, XH, yV - 14, XL, yV - 14, { w: 1.3, c: TK.accent, head: 5 });
    Ink.mono(g, `its own motion ${sgn(S.v)}${Math.abs(S.v)}`, XL + (S.v >= 0 ? 7 : -7), yV - 11, { align: S.v >= 0 ? 'left' : 'right', size: 9.5, c: TK.accent });
    if (on) { Ink.seg(g, XL, yV - 6, XL, yV + 6, { w: 1.6, c: TK.accent }); Ink.mono(g, `lands at ${Math.round(uL)} km/s`, XL, yV + 20, { align: XL > 900 ? 'right' : XL < 200 ? 'left' : 'center', size: 10, c: TK.accent }); }
    else Ink.mono(g, `lands at ${Math.round(uL)} km/s — beyond this stretch ${XL > WX.x1 ? '→' : '←'}`, XL > WX.x1 ? WX.x1 : WX.x0, yV + 20, { align: XL > WX.x1 ? 'right' : 'left', size: 10, c: TK.accent });
    g.restore();
    // place · motion · width · amount: what each changes, revealed as the reader discovers it; and what did not change
    KINDS.forEach(([k, d], i) => {
      const lx = 560 + i * 122, ly = 438, hit = S._last === k;
      Ink.text(g, k, lx, ly, { f: 'serif', size: 16.5, c: hit ? TK.accent : TK.muted });
      if (S._seen && S._seen[k]) Ink.note(g, d, lx, ly + 17, { size: 12.5, c: TK.muted });
      if (S._last) Ink.mono(g, hit ? 'changed' : 'unchanged', lx, ly + 32, { size: 9.5, c: hit ? TK.accent : TK.muted });
    });
    // its ink: the parcel's optical depth (lyaphys parcelTau), and the state before the gesture as a pencil ghost
    const ug = UG_W(), par = b6parcel(S), tau = tauParcel(ug, par, { profile: 'voigt' }), my = v => yT - Math.min(v, tmax) / tmax * hT;
    const cold = spread < 1 ? tauParcel(ug, par, { therm: false, profile: 'voigt' }) : null, show = cold ? tau.map((v, i) => cold[i] + (v - cold[i]) * spread) : tau;
    Ink.label(g, 'its ink: its contribution to optical depth τ — up is more', WX.x0, yT - hT - 14);
    Ink.mono(g, 'its width: heat and its size (the Hubble flow across it)', WX.x0, yT - hT - 30, { size: 10, c: TK.muted });   // a line above the ink label: the place/motion/width/amount status row owns the right of this band
    if (rt !== 99 && trail >= 1) Ink.mono(g, spread <= 0 ? 'as wide as its size spreads it (the Hubble flow across it)' : 'then heat widens its line', WX.x0 + 300, yT - hT - 14, { size: 10, c: TK.accent });   // the reveal says which width is which
    let refTau = null;
    if (ref && spread >= 1) { refTau = tauParcel(ug, b6parcel(ref), { profile: 'voigt' }); Ink.curve(g, ug, refTau, wmu, my, { w: 1, c: TK.pencil, dash: [3, 3] }); }
    g.save(); g.globalAlpha = trail; Ink.fillUnder(g, ug, show, wmu, my, yT, { c: TK.accent, a: 0.22 }); Ink.curve(g, ug, show, wmu, my, { w: 1.6, c: TK.accent }); g.restore();
    Ink.seg(g, wmx(-0.4), yT, wmx(4.8), yT, { w: 0.6, c: TK.faint });
    [0, 2, 4, 6, 8, 10].forEach(v => { Ink.seg(g, WX.x0 - 6, my(v), WX.x0 - 2, my(v), { w: 0.8, c: TK.graphite }); Ink.mono(g, String(v), WX.x0 - 10, my(v) + 3, { align: 'right' }); });
    const pk = Math.max(...tau); if (pk > tmax && on) Ink.mono(g, `↑ τ₀ ≈ ${pk.toFixed(0)}`, XL + 6, yT - hT + 10, { size: 9.5, c: TK.accent });
    uRuler(g, yT + 6);
    if (refTau) {   // measured when the hand pauses (≥ 0.15 s): the drawn profile follows every frame; the comparison is a reading of where it settled
      const key = JSON.stringify([snap(S), ref]);
      if (S._cmpKey !== key && (App.t - (S._lastT ?? -9) > 0.15 || App.shoot)) { S._cmpKey = key; S._cmp = b6compare(snap(S), ref); }
      const c = S._cmpKey === key ? S._cmp : undefined;
      if (c !== undefined) Ink.mono(g, c ? `compared with the grey dashed line (before): where it lands ${sgn(Math.round(c.dc))}${Math.abs(Math.round(c.dc))} km/s · how wide ×${c.w.toFixed(2)} · how much ink ×${c.a.toFixed(2)}` : 'compared with the grey dashed line (before): part of it lands beyond this stretch — not measured', WX.x0, 768, { size: 10.5, c: TK.graphite });
    }
    S._prevFrame = snap(S); S._nAtoms = nAtoms;
  },
  affordances(S) {
    const x = wmx(S.x), rx = 2 * sigPx(), tip = x + S.v * LAWV.px, yA = B6.yA, ready = b6tau(S) === 99;
    const push = { id: 'push', name: 'its motion arrow (push it)', kind: 'grab', int: 'INT-PUSH-001', at: [tip, yA], hit: { rect: [Math.min(x, tip) - 12, yA - 12, Math.max(x, tip) + 12, yA + 8] },
      hint: ready && hintUsed('b6.place') && !hintUsed('b6.motion') ? { key: 'b6.motion', text: 'push it: drag its motion', at: x > 560 ? [Math.min(x, tip) - 26, yA - 20] : [Math.max(x, tip) + 26, yA - 20], align: x > 560 ? 'right' : 'left' } : null };
    const body = { id: 'body', kind: 'hold', int: 'INT-PLACE-001 · INT-WARM-001', cursor: 'grab', at: [x, B6.yR], ellipse: [rx + 6, B6.ry + 7], hit: { rect: [x - rx - 8, B6.yR - B6.ry - 10, x + rx + 8, B6.yR + B6.ry + 10] }, hint: ready ? b6bodyHint(S, x, rx) : null };
    return [push, body];
  },
  kbTarget: S => (S._kb === 'push' ? 'push' : 'body'),
  onPointer(type, p, S) {
    if (!p) return;
    if (type === 'down') b6revealed(S);   // a touch hands the parcel to the reader
    if (type === 'down' && p.aff === 'push') { S._push = pushStart(S.v, p); return; }
    if (type === 'down' && p.aff === 'body') { S._hold = holdBegin(S.T, p, App.t); S._x0 = S.x; return; }
    if (type === 'drag' && S._push) { const v = pushTo(S._push, p, LAWV); if (v !== S.v) { b6change(S, 'motion'); S.v = v; } return; }   // the arrow's tip stays under the hand
    if (type === 'drag' && S._hold) {
      if (holdDrag(S._hold, p, LAWT, { canMove: true }) === 'move') { const d = domX(), nx = +clamp(S._x0 + (p.x - S._hold.x0) / PXMPC, d[0], d[1]).toFixed(3); if (nx !== S.x) { b6change(S, 'place'); S.x = nx; learned('b6.place'); } }   // the gas stays under the hand; moving it is the gesture
      return;
    }
    if (type === 'up') {
      if (S._push && S.v !== S._push.v0) learned('b6.motion');
      if (S._hold) { const h = S._hold, r = holdResult(h, S.T); if (r.warmer) learned('b6.warm'); if (r.cooler) learned('b6.cool'); }
      S._push = null; S._hold = null;
    }
  },
  onKey(k, S) {
    b6revealed(S);
    if (k === 'ArrowLeft' || k === 'ArrowRight') { const d = domX(); b6change(S, 'place'); S.x = +clamp(S.x + (k === 'ArrowRight' ? B6.keyX : -B6.keyX), d[0], d[1]).toFixed(3); S._kb = 'body'; learned('b6.place'); return true; }
    if (k === '[' || k === ']') { b6change(S, 'motion'); S.v = clamp(S.v + (k === ']' ? LAWV.key : -LAWV.key), LAWV.domain[0], LAWV.domain[1]); S._kb = 'push'; learned('b6.motion'); return true; }
    if (k === 'ArrowUp' || k === 'ArrowDown') { const d = domT(), up = k === 'ArrowUp'; b6change(S, 'width'); S.T = clamp(Math.round(S.T * (up ? LAWT.key : 1 / LAWT.key) / 100) * 100, d[0], d[1]); S._kb = 'body'; learned(up ? 'b6.warm' : 'b6.cool'); return true; }
    return false;
  },
  describe(S) {
    const uH = SC.HUB * S.x, r = b6reading(S);
    return `The parcel at ${S.x.toFixed(2)} Mpc/h recedes ${uH.toFixed(0)} km/s with the expansion and moves ${S.v >= 0 ? '+' : '−'}${Math.abs(S.v)} km/s of its own, so it lands at ${(uH + S.v).toFixed(0)} km/s` +
      (r.onStretch ? `; its line is drawn about ±${r.bDrawn.toFixed(0)} km/s wide: heat alone at ${fmtT(S.T)} would give ±${r.bThermal.toFixed(0)}, the Hubble flow across the parcel's size ±${r.bSize.toFixed(0)}, and the two add in quadrature; ${fmtN(10 ** S.logN)} of neutral hydrogen gives a peak optical depth of ${r.peak.toFixed(1)}.` : `; its width is not measured here.`) +
      (beyondMeasured(S.v) ? ` Its own motion is outside the toy's velocities in this stretch.` : '') + (S._last ? ` Last changed: ${S._last}; the other three are unchanged.` : '');
  },
  micro: {
    bleach: {
      ask: 'what sets the neutral amount?', title: 'Ultraviolet light sets how much is neutral',
      text: 'Ultraviolet light from all the galaxies and quasars keeps knocking electrons off hydrogen, and protons and electrons keep finding each other again. The balance sets how many atoms are neutral at any moment.\nBrighter ultraviolet: fewer neutral atoms, less ink. The gas itself — where it is, how dense, how hot — stays put.',
      get controls() { return [{ type: 'ruler', key: 'mG', label: 'ultraviolet background, relative to this toy’s (tuned, not measured)', min: 0.25, max: 4, log: true, fmt: v => `×${v.toFixed(2)} · Γ_HI = ${(SC.sk.Gamma12 * v).toFixed(2)}×10⁻¹² s⁻¹`, ticks: [{ v: P.C.gamma12_measured_z3 / SC.sk.Gamma12, s: 'measured' }, ...logTicks([1, 2, 4], v => `×${v}`)] }]; },   // a getter: the toy's tuned Γ_HI is read once the data are loaded
      init(S) { S.mG = S.mG ?? 1; },
      eqs: () => [{ tex: 'n_{\\rm HI} \\simeq \\dfrac{\\alpha_A(T)\\,n_e\\,n_{\\rm H}}{\\Gamma_{\\rm HI}}', note: 'photoionisation balances recombination; doubling Γ_HI halves the neutral amount', ids: ['SCI-ION-001'] },
        { note: `measured Γ_HI ≈ ${P.C.gamma12_measured_z3}×10⁻¹² s⁻¹ at z ≈ 3, so about one atom in 10⁵ is neutral at mean density · this toy’s ultraviolet (×1) is tuned to ${SC.sk.Gamma12.toFixed(1)}×10⁻¹² s⁻¹, about ${(SC.sk.Gamma12 / P.C.gamma12_measured_z3).toFixed(0)}× the measured value, so that its mean transmitted flux matches the observed one — a calibration, not a measurement · real ultraviolet changes also heat the gas — not shown here`, ids: ['SCI-ION-002', 'SCI-SIM-TOY-001', 'SCI-CTX-004'] }],
      draw(g, S, t) {
        const m = S.mG, cx = 250, cy = 300, rx = 170, ry = 120, r = P.rng(4), nUV = Math.round(10 * Math.sqrt(m)), tt = App.rm ? 0 : t;
        for (let k = 0; k < nUV; k++) { const an = 2 * Math.PI * (k + 0.5 * r()) / nUV, d0 = 260 - ((tt * 60 + k * 37) % 70), x0 = cx + d0 * Math.cos(an) * 1.15, y0 = cy + d0 * Math.sin(an) * 0.85, pts = []; for (let i = 0; i <= 18; i++) { const s_ = i / 18 * 30, o = 3 * Math.sin(s_ * 0.9); pts.push([x0 - s_ * Math.cos(an) - o * Math.sin(an), y0 - s_ * Math.sin(an) + o * Math.cos(an)]); } Ink.line(g, pts, { w: 0.9, c: TK.graphite, a: 0.7 }); }
        g.save(); g.setLineDash([4, 3]); g.strokeStyle = TK.graphite; g.lineWidth = 1; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI); g.stroke(); g.restore();
        Ink.blob(g, cx, cy, ry * 1.2, { c: TK.ink, a: clamp(0.55 / m, 0.03, 0.95) });
        Ink.note(g, 'the gas (outline): unchanged', cx, cy + ry + 30, { align: 'center', size: 14 });
        Ink.note(g, `its neutral hydrogen (the dark fill): ×${(1 / m).toFixed(2)}`, cx, cy + ry + 50, { align: 'center', size: 14, c: TK.accent });
        const p0 = SC.parcels[1], u0 = SC.HUB * p0.x + p0.v, ug = P.linspace(u0 - 150, u0 + 150, 600), mu = scl(ug[0], ug[ug.length - 1], 540, 960);
        const tau = P.tauFromCells(ug, P.parcelToCells({ ...p0, N: p0.N / m, dvdx: 0 }, SC.HUB), { profile: 'voigt' }), ref = P.tauFromCells(ug, P.parcelToCells({ ...p0, dvdx: 0 }, SC.HUB), { profile: 'voigt' });
        const tm = Math.max(...ref) * 3.2, my = v => 470 - Math.min(v, tm * 1.02) / tm * 330;
        Ink.curve(g, ug, ref, mu, my, { w: 0.9, c: TK.pencil, dash: [3, 3] });
        Ink.fillUnder(g, ug, tau, mu, my, 470, { c: TK.accent, a: 0.2 }); Ink.curve(g, ug, tau, mu, my, { w: 1.6, c: TK.accent });
        Ink.label(g, 'its ink — its contribution to optical depth τ: same place, same width', 540, 110);
        Ink.ruler(g, 540, 960, 476, { map: mu, ticks: [-100, 0, 100].map(d => ({ v: u0 + d, s: (d > 0 ? '+' : '') + d })), label: 'velocity, relative to the parcel [km/s]' });
        Ink.mono(g, 'dashed: at this toy’s ultraviolet (×1)', 960, 130, { align: 'right', size: 10 });
      },
    },
  },
  foot: 'teaching parcel summarising one stretch of the toy sightline (SCI-REP-003) · warming here holds the neutral amount fixed — real warmer gas is also less neutral (SCI-ION-001) · representative neutral atoms, ∝ N_HI (SCI-REP-001) · τ from lyaphys.js (validated)',
};
