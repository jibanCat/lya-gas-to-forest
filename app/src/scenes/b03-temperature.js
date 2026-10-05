/* Beat 3 · Temperature becomes line width — a live physical system (SCI-THERM-001/002, SCI-TAU-001, SCI-REP-001).
 * The reader changes the temperature; the atoms' random motion, their line-of-sight arrows, the marks on the speed ruler,
 * the census, the Doppler width and the line all follow in the same frame — one physical state, several views. Every mark
 * is one representative atom's own v = g·σ(T); the curve is the expected count per bin; the line is τ0(N, b)·e^(−Δv²/b²).
 * First encounter: a ~3.5 s formation (atoms → marks → census → line), then control is the reader's; "replay how this
 * forms" plays it slowly (~9 s). Touch the census or the line: the atoms in that speed bin light up (INT-THERM-BIN-001).
 * The formation only moves marks between representations: landing positions and widths are the exact v and b(T) in
 * every frame (VT-THERM-*). Steps remain URL states for stills (stage=1…4). Microscope: why a Gaussian. */
import { TK } from '../design/tokens.js';
import { Ink } from '../design/ink.js';
import { clamp, lerp, ease, scl, logTicks, fmtT } from '../core/util.js';
import { App } from '../core/app.js';
import { META, metaEqs, interaction } from '../core/meta.js';
import { ovTex, learned } from '../core/runtime.js';
import { P } from '../physics/lya.js';
import { onboarded, markOnboarded, hintUsed } from '../primitives/affordance.js';
import { holdLaw, holdBegin, holdDrag, holdT, holdResult } from '../primitives/hold.js';
import { SC, sigmaLOS } from '../data/scene-data.js';
import { drawAtoms, atomPos } from '../primitives/atoms.js';
import { fibre, deposit } from '../primitives/material.js';

export const B3 = {
  cx: 600, cy: 150, R: 118, follow: 17, arrowPx: 1.4,
  X0: 190, X1: 1010, vmax: 80,                 // one velocity axis for the census and the line
  yC: 470, bw: 2.5, hMark: 2.6,                // census ruler; bin width [km/s]; one atom = one 2.6 px mark
  yP: 732, hP: 168, N: 3e13,                   // the parcel's line: baseline, height, column [cm⁻²]
};
/** formation timings [s]: write = [start, lead, spread, flight, followed flight]; census and line start times; display only */
export const B3T = {
  fast: { write: [0, 0.25, 0.85, 0.32, 0.6], census: 1.25, line: 2.15, rise: 0.65, curveAt: 0.45, drop: 0.85 },
  slow: { write: [0, 0.9, 1.9, 0.55, 1.2], census: 4.15, line: 6.25, rise: 1.2, curveAt: 1.1, drop: 1.5 },
};
const b3mv = scl(-B3.vmax, B3.vmax, B3.X0, B3.X1);
/** the gesture → temperature control law (pedagogical, not physics; INT-TEMP-001 gesture). Three alternatives were prototyped:
 * hold (chosen: holding still explores warmer gas, moving vertically while holding refines both ways), scrub (press and drag
 * up/down only) and stir (path length adds random motion; rejected — it implies rubbing heats the gas, and cannot cool). */
/** the control law: the shared hold (primitives/hold.js), read from the manifest (INT-TEMP-001 gesture params). The rejected stir
 * prototype's rate (dex per px of stirring) is local to this file. */
export const B3G = { stir: 0.0022 };
function b3law() { return { ...holdLaw(3, 'INT-TEMP-001'), stir: B3G.stir }; }
const b3mode = S => (['hold', 'scrub', 'stir'].includes(S.t3g) ? S.t3g : 'hold');
function b3T() { const d = interaction(3, 'INT-TEMP-001').domain || [2000, 1e5]; return { type: 'ruler', key: 'T', label: 'temperature of the gas', readout: true, operable: () => hintUsed('b3.warm') || App.adv, title: 'a reading — hold the gas to explore warmer gas', titleOperable: 'a reading; drag it for a precise value', min: d[0], max: d[1], log: true, fmt: fmtT, ticks: logTicks([3e3, 1e4, 3e4, 1e5], v => v >= 1e5 ? '1e5' : v >= 1e4 ? `${v / 1e4}e4` : `${v / 1e3}e3`) }; }
/** flight order: the followed atom first, then a seeded shuffle (fixed, so the census builds the same way every time) */
let _b3rank = null;
function b3rank() {
  if (_b3rank) return _b3rank;
  const r = P.rng(23), ids = SC.atoms.map(a => a.i).filter(i => i !== B3.follow);
  for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
  const rank = new Map([[B3.follow, 0]]); ids.forEach((id, k) => rank.set(id, k + 1));
  return (_b3rank = rank);
}
function b3seen() { return onboarded('b3.formed'); }   // once per session
function b3mark() { markOnboarded('b3.formed'); }
const b3sch = S => (S._form && S._form.slow ? B3T.slow : B3T.fast);
/** seconds into the formation, or 99 once formed (always, in stills and under reduced motion) */
function b3tau(S) {
  if (!S._form || App.shoot || App.rm) return 99;
  const t = App.t - S._form.t0, sch = b3sch(S);
  if (t > sch.line + sch.drop + 0.9) { S._form = null; b3mark(); return 99; }
  return t;
}
/** seconds since layer k (2 marks, 3 census, 4 line) began forming; −1 before; 99 once formed. A still's stage=k shows layer k formed. */
function b3since(S, k) {
  if (S.fixedStage) return S.fixedStage >= k ? 99 : -1;
  const t = b3tau(S); if (t === 99) return 99;
  const sch = b3sch(S), st = k === 2 ? sch.write[0] : k === 3 ? sch.census : sch.line;
  return t < st ? -1 : t - st;
}
/** attention while forming: the layer being made leads; the rest recede (opacity only) */
function b3focus(S) {
  const t = S.fixedStage ? 99 : b3tau(S); if (t === 99) return { atoms: 1, census: 1, line: 1 };
  const sch = b3sch(S), r = (a, b) => clamp((t - a) / (b - a), 0, 1), c = r(sch.census - 0.2, sch.census + 0.2), l = r(sch.line - 0.2, sch.line + 0.2);
  return { atoms: 1 - 0.45 * c, census: 1 - 0.3 * l, line: 1 };
}
/** the census: each atom's speed, its bin and its slot in that bin's stack (by flight order) */
export function b3census(T) {
  const s = sigmaLOS(T), rank = b3rank(), order = SC.atoms.slice().sort((a, b) => rank.get(a.i) - rank.get(b.i)), fill = new Map(), out = [];
  for (const a of order) { const v = a.gx * s, k = Math.round(v / B3.bw), slot = fill.get(k) || 0; fill.set(k, slot + 1); out.push({ a, v, k, slot, r: rank.get(a.i) }); }
  return out;
}
const b3formed = S => b3since(S, 4) >= b3sch(S).drop || (S.fixedStage || 0) >= 3;   // the line has landed: the graphs are live

/** the first-use hint for the parcel: warmer first; once warmer gas has been explored, how to go back */
function b3hint(S) {
  const { cx, cy, R } = B3, m = b3mode(S);
  if (!hintUsed('b3.warm')) return { key: 'b3.warm', text: m === 'scrub' ? 'press and drag up: warmer gas' : m === 'stir' ? 'stir the gas: more random motion' : 'hold the gas to explore warmer gas', at: [cx - R - 18, cy - 40], align: 'right' };
  if (m === 'hold' && !hintUsed('b3.cool') && S.T > 1.5e4) return { key: 'b3.cool', text: 'hold and drag down: cooler gas', at: [cx - R - 18, cy + 50], align: 'right' };
  return null;
}
/** a hold in progress: holding still explores warmer gas at a steady pace; moving vertically while holding refines both ways */
function b3holdStep(S) {
  const h = S._hold; if (!h) return;
  const d = b3T(); S.T = holdT(h, b3law(), [d.min, d.max], App.t);
}
function b3holdPointer(type, p, S) {
  const m = b3mode(S), h = S._hold;
  if (type === 'down' && p.aff === 'parcel') { S._hold = holdBegin(S.T, p, App.t, { refine: m !== 'hold' }); S._vb = null; return true; }
  if (!h) return false;
  if (type === 'drag') {
    const L = b3law();
    if (m === 'stir') { h.logT += L.stir * Math.hypot(p.x - h.lx, p.y - h.ly); h.lx = p.x; h.ly = p.y; return true; }
    holdDrag(h, p, L);   // still, a hold; moving vertically, a refinement
    return true;
  }
  if (type === 'up' || type === 'leave') { const r = holdResult(h, S.T); if (r.warmer) learned('b3.warm'); if (r.cooler) learned('b3.cool'); S._hold = null; return true; }
  return true;
}

export const sceneTemperature = {
  n: 3,
  slug: 'temperature-is-width',
  keys: 'Up and down (or right and left) arrows explore warmer and cooler gas; [ and ] move along the census to see which atoms are there; Escape clears; space replays how the census forms.',
  eqs: S => metaEqs(3, [{ note: `now: T = ${fmtT(S.T)}  →  b = ${P.dopplerB(S.T).toFixed(2)} km/s`, ids: ['SCI-THERM-002'] }]),
  persist: ['T'],
  get controls() {
    return [b3T(), { type: 'button', role: 'replay', why: 'the quiet replay of the first-encounter formation (once per session)', label: 'replay how this forms (slowly) ▸', act: S => { S._form = { t0: App.t, slow: true }; S.fixedStage = 0; S._vb = null; } }];
  },
  tour: [
    { say: 'temperature is random motion: counted by their speed along the beam, the atoms make the line' },
    { say: 'warmer gas: faster random motion, a wider census — a wider line', int: 'INT-TEMP-001', do: S => { if (S._form) { S._form = null; b3mark(); } }, dissolve: false, to: { T: 4e4 }, log: ['T'], dur: 2.2 },
    { say: 'cooler gas: slower motion, a narrower line', int: 'INT-TEMP-001', to: { T: 3000 }, log: ['T'], dur: 2.2 },
  ],
  init(S) { S.T = 1e4; S._vb = null; S._hold = null; S._form = b3seen() ? null : { t0: App.t + 0.5, slow: false }; },
  afterHash(S) { if (S.stage != null) { S.fixedStage = clamp(Math.round(+S.stage), 1, 4); S._form = null; } const d = b3T(); S.T = clamp(+S.T || 1e4, d.min, d.max); },
  draw(g, S, t) {
    b3holdStep(S);
    const { cx, cy, R, follow, X0, X1, yC, bw, hMark, yP, hP } = B3, mv = b3mv, bpx = mv(bw) - mv(0), b = P.dopplerB(S.T), N = SC.atoms.length;
    const t2 = b3since(S, 2), t3 = b3since(S, 3), t4 = b3since(S, 4), sch = b3sch(S), F = b3focus(S), vb = S._vb, probe = vb != null && b3formed(S);
    const cs = b3census(S.T), inBin = probe ? cs.filter(m => m.k === vb) : [], focusId = probe ? -1 : follow;
    // the parcel: representative atoms, arrows = speed along the beam (horizontal, like the beam)
    drawAtoms(g, cx, cy, R, S.T, t, { arrows: true, follow: focusId, speedPx: 1.6, arrowPx: B3.arrowPx, alpha: F.atoms });
    if (probe) for (const m of inBin) { const [X, Y] = atomPos(m.a, cx, cy, R, S.T, t, 1.6); Ink.ring(g, X, Y, 4.6, { c: TK.accent, w: 1 }); }
    Ink.ring(g, cx, cy, R, { c: TK.pencil, w: 0.8, dash: [2, 4], a: F.atoms });
    Ink.note(g, 'atoms in one parcel', cx + R + 20, cy - 6, { size: 13.5, a: F.atoms }); Ink.mono(g, 'arrow: its speed along the beam', cx + R + 20, cy + 10, { size: 10, a: F.atoms });
    Ink.mono(g, `T = ${fmtT(S.T)}` + (App.adv ? `  ·  b = ${b.toFixed(2)} km/s` : ''), cx + R + 20, cy + 30, { size: 10.5, c: S._hold ? TK.accent : TK.muted });   // the reading travels with the gas (as Beat 5's z with the light)
    // the census ruler: quiet until speeds land on it
    Ink.ruler(g, X0, X1, yC, { map: mv, ticks: [-60, -40, -20, 0, 20, 40, 60].map(v => ({ v, s: String(v) })), label: 'speed along the beam  [km/s]', c: t2 >= 0 ? TK.graphite : TK.pencil });
    const stTxt = (META(3).stages || [])[(S.fixedStage || (t4 >= 0 ? 4 : t3 >= 0 ? 3 : t2 >= 0 ? 2 : 1)) - 1];
    if (stTxt && t4 < 0) Ink.note(g, stTxt.text, X0, yC + 44, { size: 13.5 });
    const flights = [];
    if (t2 >= 0) {
      const [, lead, spread, dur, durF] = sch.write;
      for (const m of cs) {
        const isF = m.a.i === focusId, hit = probe && m.k === vb, fs = m.r === 0 ? 0 : lead + spread * (m.r / N), d = m.r === 0 ? durF : dur, f = clamp((t2 - fs) / d, 0, 1);
        if (f <= 0) continue;
        const age = t2 - fs - d, rise = t3 >= 0 ? ease(clamp((t3 - 0.45 * sch.rise * (m.r / N)) / sch.rise, 0, 1)) : 0;
        if (f < 1) {   // in flight: the arrow travels from the atom to the ruler, tail to zero; a thread joins atom and tip
          const [X, Y] = atomPos(m.a, cx, cy, R, S.T, t, 1.6), e = ease(f), tx = lerp(X, mv(0), e), ty = lerp(Y, yC - 7, e), ppx = lerp(B3.arrowPx, mv(1) - mv(0), e);
          flights.push({ X, Y, tx, ty, tipX: tx + m.v * ppx, e, isF }); continue;
        }
        // landed: a tick at the atom's own speed (the band), rising into its slot in the stack (the census)
        const xT = mv(m.v), xS = mv(m.k * bw) - bpx / 2 + 0.6, yS = yC - 3 - (m.slot + 1) * hMark;
        const x = lerp(xT - 0.5, xS, rise), w = lerp(1, bpx - 1.2, rise), y = lerp(yC - 12, yS, rise), h = lerp(10, hMark - 0.5, rise);
        if (x < X0 - 1 || x + w > X1 + 1) continue;   // the census shows the axis's range (±80 km/s); the few faster atoms of a very hot sample lie beyond it
        deposit(g, x, y, w, h, age, { c: isF || hit ? TK.accent : TK.ink, a: (isF || hit ? 0.95 : lerp(0.3, 0.72, rise)) * (hit ? 1 : F.census) });
        if (age < 0.4 && t3 < 0) Ink.arrow(g, mv(0), yC - 7, xT, yC - 7, { w: 0.6, c: isF ? TK.accent : TK.graphite, a: 0.6 * (1 - age / 0.4), head: 3 });
      }
      for (const fl of flights) {
        fibre(g, fl.X, fl.Y, fl.tipX, fl.ty, { w: fl.isF ? 0.9 : 0.5, c: fl.isF ? TK.accent : TK.pencil, a: (fl.isF ? 0.7 : 0.28) * (1 - fl.e) });
        Ink.arrow(g, fl.tx, fl.ty, fl.tipX, fl.ty, { w: fl.isF ? 1.3 : 0.7, c: fl.isF ? TK.accent : TK.graphite, a: fl.isF ? 1 : 0.75, head: fl.isF ? 5 : 3 });
      }
    }
    // the census settles onto its curve: expected atoms per bin, N·bw·e^(−v²/b²)/(√π b)
    const vs = P.linspace(-B3.vmax, B3.vmax, 401), nOf = v => N * bw / (Math.sqrt(Math.PI) * b) * Math.exp(-((v / b) ** 2)), yCen = v => yC - 3 - nOf(v) * hMark;
    if (t3 >= 0) {
      const ca = clamp((t3 - sch.curveAt) / 0.6, 0, 1) * F.census;
      if (ca > 0) Ink.curve(g, vs, vs, mv, yCen, { w: 1.3, c: TK.ink, a: ca });
      const mean = cs.reduce((s_, m) => s_ + m.v, 0) / N, ma = clamp((t3 - 0.4) / 0.5, 0, 1) * F.census;
      if (ma > 0) { Ink.seg(g, mv(mean), yC + 2, mv(mean), yC + 9, { w: 1.2, c: TK.ink, a: ma }); Ink.mono(g, 'average', mv(mean) + 5, yC + 30, { size: 9.5, a: ma }); }
      if (App.adv && ca > 0.9) {
        const yb = yCen(b); Ink.seg(g, mv(-b), yb, mv(b), yb, { w: 0.8, c: TK.ink }); for (const sg of [-1, 1]) Ink.seg(g, mv(sg * b), yb - 4, mv(sg * b), yb + 4, { w: 0.8, c: TK.ink });
        ovTex(`b=\\sqrt{2kT/m_{\\rm H}}=${b.toFixed(2)}\\ {\\rm km\\,s^{-1}}`, mv(b) + 12, yb, { size: 14 });
      }
    }
    // the census curve drops into the parcel's line: τ(Δv) = τ0(N, b)·e^(−Δv²/b²), the same shape in optical depth
    if (t4 >= 0) {
      const tmax = P.tau0(B3.N, P.dopplerB(2000)) * 1.02, tau0 = P.tau0(B3.N, b), yTau = v => yP - tau0 * Math.exp(-((v / b) ** 2)) / tmax * hP, f = ease(clamp(t4 / sch.drop, 0, 1));
      const ys = vs.map(v => lerp(yCen(v), yTau(v), f)), wa = clamp((t4 - sch.drop + 0.4) / 0.6, 0, 1);
      if (wa > 0) Ink.fillUnder(g, vs, vs.map(yTau), mv, y => y, yP, { c: TK.wash, a: 0.3 * wa });
      if (probe) { const lo = (vb - 0.5) * bw, hi = (vb + 0.5) * bw, band = vs.filter(v => v >= lo && v <= hi); if (band.length > 1) Ink.fillUnder(g, band, band.map(yTau), mv, y => y, yP, { c: TK.accent, a: 0.28 }); }
      Ink.curve(g, vs, ys, mv, y => y, { w: lerp(1.3, 1.6, f), c: TK.ink });
      Ink.ruler(g, X0, X1, yP + 4, { map: mv, ticks: [-60, -40, -20, 0, 20, 40, 60].map(v => ({ v, s: String(v) })), label: 'colour offset = speed along the beam  [km/s]', c: f > 0.5 ? TK.graphite : TK.pencil });
      const la = clamp((t4 - sch.drop) / 0.5, 0, 1);
      if (la > 0) {
        Ink.label(g, 'the parcel’s line: its optical depth τ — how strongly it dims each colour (same hydrogen: hotter is lower but wider)', X0, yP - hP - 14, { a: la });
        if (!probe) for (const sg of [-1, 1]) Ink.seg(g, mv(sg * b), yC + 22, mv(sg * b), yP, { w: 0.7, c: TK.accent, dash: [2, 3], a: 0.8 * la });
        if (!probe) { const fa = SC.atoms.find(a => a.i === follow), fv = fa.gx * sigmaLOS(S.T); Ink.dot(g, mv(fv), yTau(fv), 3.5, { c: TK.accent, a: la }); }
        if (App.adv) ovTex('\\phi(\\Delta v)=\\dfrac{e^{-\\Delta v^2/b^2}}{\\sqrt{\\pi}\\,b}', mv(b) + 30, yP - hP * 0.55, { size: 14 });
      }
    }
    // the census and the line remain connected to the atoms: one speed bin, its atoms, its colours
    if (probe && App.t - (S._vbSince ?? App.t) > (((interaction(3, 'INT-THERM-BIN-001').gesture || {}).params || {}).learned_s ?? 0.6)) learned('b3.census');   // dwelling on a bin is the gesture
    if (probe) {
      const lo = (vb - 0.5) * bw, hi = (vb + 0.5) * bw, xs = mv(vb * bw), top = yC - 3 - Math.max(inBin.length, 1) * hMark;
      Ink.seg(g, xs, top - 6, xs, yC + 12, { w: 0.7, c: TK.accent, dash: [2, 3] });
      if (t4 >= 0) Ink.seg(g, xs, yC + 22, xs, yP, { w: 0.7, c: TK.accent, dash: [2, 3], a: 0.7 });
      Ink.mono(g, inBin.length ? `${inBin.length} atom${inBin.length === 1 ? '' : 's'} moving ${lo.toFixed(1)} to ${hi.toFixed(1)} km/s along the beam` : `no atoms of this sample between ${lo.toFixed(1)} and ${hi.toFixed(1)} km/s`, xs + (xs > 760 ? -8 : 8), top - 10, { align: xs > 760 ? 'right' : 'left', size: 10.5, c: TK.accent });
    }
  },
  affordances(S) {
    const parcel = { id: 'parcel', kind: 'hold', int: 'INT-TEMP-001', at: [B3.cx, B3.cy], ring: B3.R, hit: { r: B3.R + 6 }, hint: b3formed(S) ? b3hint(S) : null };   // the hint waits for the formation
    if (!b3formed(S)) return [parcel];
    const { X0, X1, yC, yP, hP, bw, hMark } = B3, k = S._vb ?? 0, x = b3mv(k * bw), n = b3census(S.T).filter(m => m.k === k).length, top = yC - 3 - n * hMark - 9;   // the ring sits on the bin's stack
    return [parcel, { id: 'census', kind: 'scan', int: 'INT-THERM-BIN-001', at: [x, top], hit: { rect: [X0, yC - 190, X1, yC + 14] }, hint: { key: 'b3.census', text: 'touch the census: which atoms are these?', at: [x + 40, top - 18], align: 'left' } },
      { id: 'line', name: 'the line (which atoms absorb here?)', kind: 'scan', int: 'INT-THERM-BIN-001', at: [x, yP], hit: { rect: [X0, yP - hP - 12, X1, yP + 8] } }];
  },
  kbTarget: S => (S._vb != null ? 'census' : 'parcel'),
  onPointer(type, p, S) {
    if (!p) { if (!S._vbPin) S._vb = null; return; }
    let handed = false;
    if (type === 'down' && S._form) { S._form = null; b3mark(); handed = true; }   // a touch hands the system to the reader — and still counts
    if (b3holdPointer(type, p, S)) return;
    const inGraph = p.x >= B3.X0 && p.x <= B3.X1 && ((p.y >= B3.yC - 190 && p.y <= B3.yC + 14) || (p.y >= B3.yP - B3.hP - 12 && p.y <= B3.yP + 8));
    const onGraph = p.aff === 'census' || p.aff === 'line' || (handed && inGraph), vOf = x => (x - B3.X0) / (B3.X1 - B3.X0) * 2 * B3.vmax - B3.vmax;
    if (onGraph && (type === 'move' || type === 'drag' || type === 'down')) { if (S._vb == null) S._vbSince = App.t; S._vb = Math.round(clamp(vOf(p.x), -B3.vmax, B3.vmax) / B3.bw); if (type === 'down') S._vbPin = !!p.touch; return; }
    if (type === 'down') { S._vbPin = false; S._vb = null; } else if (type === 'move' && !S._vbPin) S._vb = null;
  },
  onKey(k, S) {
    if (S._form && k !== ' ') { S._form = null; b3mark(); }
    const d = b3T();
    if (['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'].includes(k)) { const up = k === 'ArrowRight' || k === 'ArrowUp'; const kf = b3law().key; S.T = clamp(Math.round(S.T * (up ? kf : 1 / kf) / 100) * 100, d.min, d.max); learned(up ? 'b3.warm' : 'b3.cool'); return true; }   // the same physical state as holding
    if (k === '[' || k === ']') { S._vb = clamp((S._vb ?? 0) + (k === ']' ? 1 : -1), -Math.floor(B3.vmax / B3.bw), Math.floor(B3.vmax / B3.bw)); return true; }
    if (k === 'Escape' && S._vb != null) { S._vb = null; S._vbPin = false; return true; }
    if (k === ' ') { S._form = { t0: App.t, slow: true }; S.fixedStage = 0; S._vb = null; return true; }
    return false;
  },
  describe(S) {
    const b = P.dopplerB(S.T), n = SC.atoms.length;
    if (S._vb != null && b3formed(S)) { const m = b3census(S.T).filter(q => q.k === S._vb).length; return `${m} of ${n} representative atoms move between ${((S._vb - 0.5) * B3.bw).toFixed(1)} and ${((S._vb + 0.5) * B3.bw).toFixed(1)} km/s along the beam; they absorb at that colour offset.`; }
    return `Temperature ${fmtT(S.T)}: the speeds of ${n} representative atoms along the beam spread over about ±${b.toFixed(0)} km/s, the line’s width b; the census and the line are that wide — hotter gas, wider and shallower.`;
  },
  micro: {
    gaussian: {
      ask: 'why a Gaussian?', title: 'Why the census is a Gaussian',
      text: 'In a gas at temperature T, each component of an atom’s velocity is normally distributed (Maxwell–Boltzmann), with spread √(kT/m).\nThe beam only cares about one component: the speed along it. Add more atoms and the census settles onto that curve.',
      controls: [{ type: 'ruler', key: 'mN', label: 'atoms counted', min: 10, max: 20000, log: true, step: 1, fmt: v => String(Math.round(v)), ticks: logTicks([10, 100, 1000, 10000], v => String(v)) }],
      init(S) { S.mN = S.mN ?? 200; S.T = S.T || 1e4; },
      eqs: () => [{ tex: 'f(v_\\parallel)\\,dv_\\parallel = \\sqrt{\\dfrac{m}{2\\pi kT}}\\;e^{-m v_\\parallel^2/2kT}\\,dv_\\parallel', note: 'one component of the Maxwell–Boltzmann distribution', ids: ['SCI-THERM-001'] }, { tex: 'b \\equiv \\sqrt{2kT/m}', ids: ['SCI-THERM-002'] }],
      draw(g, S) {
        const n = Math.round(S.mN), s = sigmaLOS(S.T), r = P.rng(11), mv = scl(-60, 60, 80, 940), yB = 520, bw = 2, hist = new Map();
        for (let i = 0; i < n; i++) { const k = Math.round(P.gauss(r) * s / bw); hist.set(k, (hist.get(k) || 0) + 1); }
        const peak = n * bw / (Math.sqrt(2 * Math.PI) * s), scale = 380 / peak;
        for (const [k, c] of hist) { g.save(); g.fillStyle = TK.ink; g.globalAlpha = 0.7; g.fillRect(mv(k * bw) - (mv(bw) - mv(0)) / 2 + 0.5, yB - c * scale, mv(bw) - mv(0) - 1, c * scale); g.restore(); }
        const vs = P.linspace(-60, 60, 400); Ink.curve(g, vs, vs.map(v => peak * Math.exp(-0.5 * (v / s) ** 2)), mv, c => yB - c * scale, { w: 1.6, c: TK.accent });
        Ink.ruler(g, 80, 940, yB + 4, { map: mv, ticks: [-45, -30, -15, 0, 15, 30, 45].map(v => ({ v, s: String(v) })), label: 'speed along the beam [km/s]' });
        Ink.note(g, `${n} atoms at T = ${fmtT(S.T)} · red: Maxwell–Boltzmann, one component`, 80, 60, { size: 15, c: TK.ink });
      },
    },
  },
  foot: 'representative atoms, motion slowed ~10¹³× · each mark is one atom’s own speed · here we isolate thermal motion; larger-scale velocity structure can broaden a real absorber too (Beat 6) (SCI-REP-001, SCI-THERM-002)',
};
