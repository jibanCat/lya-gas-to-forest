/* Beat 12 · Who ate this colour? — a continuous instrument. The first time (per viewer) a click traces one colour back:
 * a cinnabar thread rises from the spectrum into the optical depth (the sightline ordered by velocity, Beer–Lambert ink
 * over light), splits by contribution and lands on the gas that absorbed it, which develops like ink; then the shares and
 * the ledger appear and the threads fade. After that the cursor is the reader's: drag (or arrow-key) along the spectrum
 * and, every frame, the same validated decomposition (lyaphys tauContributions, VAL-INV-001) moves the threads, develops
 * and fades the contributing gas and rewrites the shares — including where the decomposition is messy; nothing snaps to a
 * clean example. Touch the gas instead: its own optical depth across the whole spectrum (lyaphys tauFromCells on just
 * its cells) and the light it removes. τ as a sum, F as a product (SCI-TAU-002/003, SCI-FLUX-002, SCI-MAP-001). */
import { TK } from '../design/tokens.js';
import { Ink } from '../design/ink.js';
import { clamp, ease, hexRGB, memo } from '../core/util.js';
import { App } from '../core/app.js';
import { metaEqs } from '../core/meta.js';
import { DPR } from '../core/runtime.js';
import { P } from '../physics/lya.js';
import { onboarded, markOnboarded } from '../primitives/affordance.js';
import { SC } from '../data/scene-data.js';
import { drawSlab } from '../primitives/slab.js';
import { drawStrip } from '../primitives/sightline.js';
import { FX, fmx, fmu, lamTicks, provenanceAt, invTh } from '../primitives/forest.js';
import { fibre, develop } from '../primitives/material.js';

export const B12 = { yR: 262, yV: 392, hV: 7, f1: 450, f0: 630, ly: 715, linger: 1.2,
  t: { cursor: 0.35, rise: [0.25, 0.85], branch: [0.85, 1.8], develop: 1.55, values: [2.7, 3.3], fade: [3.9, 4.9] } };
function b12seen() { return onboarded('b12.traced'); }   // once per session
function b12mark() { markOnboarded('b12.traced'); }
/** seconds into the causal reveal (99: done; at once in stills and under reduced motion) */
/** for the tour: the deepest line, a shallow single line, and the ends of the scan */
function b12at(kind) {
  const ug = SC.ug, tau = SC.tau, P0 = SC.period; let k = -1;
  for (let i = 1; i < ug.length - 1; i++) { if (ug[i] < 150 || ug[i] > P0 - 150) continue;
    if (kind === 'deep' && (k < 0 || tau[i] > tau[k])) k = i;
    if (kind === 'shallow' && tau[i] > 0.25 && tau[i] < 0.6 && tau[i] >= tau[i - 1] && tau[i] >= tau[i + 1] && (k < 0 || Math.abs(tau[i] - 0.4) < Math.abs(tau[k] - 0.4))) k = i; }
  if (kind === 'start') return 120; if (kind === 'end') return P0 - 120;
  return ug[k < 0 ? ug.length >> 1 : k];
}
function b12since(S) { return (App.shoot || App.rm || S._traceT == null) ? 99 : App.t - S._traceT; }
const ramp = (t, [a, b]) => clamp((t - a) / (b - a), 0, 1);
const uOfX = x => ((x - FX.x0) / (FX.x1 - FX.x0) * SC.period + SC.period) % SC.period;
let _b12band = null;
/** the sightline's optical depth by velocity, as ink over light: colour = light·e^−τ + ink·(1 − e^−τ) (Beer–Lambert, as Beat 10) */
function b12band(W2) {
  if (_b12band && _b12band.width === W2) return _b12band;
  const img = new ImageData(W2, 1), ink = hexRGB(TK.ink), light = hexRGB(TK.light), n = SC.ug.length;
  for (let x = 0; x < W2; x++) { const i = Math.round((x + 0.5) / W2 * n) % n, T = SC.F[i]; img.data.set([0, 1, 2].map(q => light[q] * T + ink[q] * (1 - T)).concat(255), x * 4); }
  const c = document.createElement('canvas'); c.width = W2; c.height = 1; c.getContext('2d').putImageData(img, 0, 0);
  return (_b12band = c);
}
/** a stretch of real-space gas: the cells within ±group_gap of x (the inverse lookup's own contiguity scale) */
function b12region(x) { const g = invTh().group_gap_mpch, L = SC.L, d = c => { let q = c.x - x; q -= L * Math.round(q / L); return Math.abs(q); }; return SC.cells.filter(c => d(c) <= g); }
/** that gas's own optical depth across the spectrum: the validated tauFromCells on just its cells (memoised per region) */
const _regTau = memo((cells) => P.tauFromCells(SC.ug, cells, { period: SC.period, profile: 'gauss', cut: SC.tauCut }), 16);
function b12regionTau(x) { const cells = b12region(x); return { cells, tau: _regTau(cells.map(c => c.j).join(','), cells) }; }
/** the trace: one thread from the pixel into the optical depth, branches (width ∝ share) to each region that absorbed it */
export function b12trace(g, S, pv, { cur = 1, rise = 1, br = 1, a = 1 } = {}) {
  const { yR, yV, hV, f0 } = B12, th = invTh(), x = fmu(S.pu), yF = B12.f0 - Math.exp(-pv.tot) * (B12.f0 - B12.f1);
  Ink.seg(g, x, f0 + 8, x, f0 + 8 - (f0 + 8 - yF) * cur, { w: 1, c: TK.accent, dash: [2, 3] });
  const traced = pv.groups.filter(gr => gr.share >= th.traced_min_share);
  if (rise > 0 && a > 0) Ink.seg(g, x, yF, x, yF - (yF - yV - hV) * rise, { w: 1.6, c: TK.accent, a });
  if (br > 0 && a > 0) for (const gr of traced) fibre(g, x, yV - hV, fmx(gr.xc), yR + 12, { w: 0.6 + 2.4 * gr.share, c: TK.accent, a: 0.85 * a, p: br });
  return traced;
}
/** the developed gas, eased in opacity only (the regions themselves are recomputed exactly every frame) */
function b12stains(S, traced, show) {
  const now = App.t, dt = Math.min(0.1, now - (S._st0 ?? now)); S._st0 = now; S._stains = S._stains || [];
  for (const st of S._stains) st.target = 0;
  if (show) for (const gr of traced) {
    const target = 0.12 + 0.55 * Math.sqrt(gr.share), m = S._stains.find(st => Math.abs(st.xc - gr.xc) < 0.3);
    if (m) Object.assign(m, { xc: gr.xc, x0: gr.x0, x1: gr.x1, target }); else S._stains.push({ xc: gr.xc, x0: gr.x0, x1: gr.x1, target, a: 0, born: now });
  }
  for (const st of S._stains) st.a = (App.shoot || App.rm) ? st.target : st.a + (st.target - st.a) * Math.min(1, dt * 7);
  S._stains = S._stains.filter(st => st.a > 0.005 || st.target > 0);
  return S._stains;
}

export const sceneWhoAte = {
  n: 12,
  slug: 'who-ate-this-colour',
  keys: 'Left and right arrows scan along the spectrum; Enter traces the colour slowly; [ and ] move along the gas to see where it absorbs; Escape clears.',
  eqs: () => metaEqs(12),
  persist: ['pu'],
  controls: [{ type: 'button', role: 'replay', why: 'the quiet replay of the causal trace (once per session)', label: 'trace this colour slowly ▸', act: S => { S._traceT = App.t; S._scanning = false; } }],
  tour: [
    { say: 'point at a colour: the gas that absorbed it lights up' },
    { say: 'scan along the spectrum: each colour’s absorbers light up in turn', int: 'INT-SCAN-001', do: S => { S._traceT = null; S._scanning = true; S.pu = b12at('start'); }, dissolve: false, to: () => ({ pu: b12at('end') }), end: S => { S._scanning = false; S._scanEnd = App.t; }, dur: 5 },
    { say: 'the deepest line: much neutral hydrogen absorbs this colour', int: 'INT-SCAN-001', do: S => { S._scanning = true; }, dissolve: false, to: () => ({ pu: b12at('deep') }), end: S => { S._scanning = false; S._scanEnd = App.t; }, dur: 2.2 },
    { say: 'a shallow line: only a little gas absorbs here', int: 'INT-SCAN-001', do: S => { S._scanning = true; }, dissolve: false, to: () => ({ pu: b12at('shallow') }), end: S => { S._scanning = false; S._scanEnd = App.t; }, dur: 2.2 },
  ],
  init(S) {   // start on a colour that two separated regions share; the first time, trace it once on arrival
    const th = invTh(); let best = null;
    for (let i = 0; i < SC.ug.length; i += 2) {
      const u = SC.ug[i], tt = SC.tau[i]; if (tt < 0.5 || tt > 6 || u < 150 || u > SC.period - 150) continue;
      const pv = provenanceAt(u), big = pv.groups.filter(gr => gr.share > th.places_min_share); if (big.length < 2) continue;
      const sep = Math.abs(big[0].xc - big[1].xc); if (sep < 0.4) continue;
      const sc = sep * Math.min(big[0].share, big[1].share) * (tt < 3 ? 1.5 : 1); if (!best || sc > best.sc) best = { u, sc };
    }
    S.pu = best ? best.u : SC.ug[1000]; S._traceT = b12seen() ? null : App.t + 0.8; S._scanEnd = -99; S._stains = [];
  },
  draw(g, S) {
    const th = invTh(), { yR, yV, hV, f1, f0, ly, t } = B12, pv = provenanceAt(S.pu), ts = b12since(S); S._pv = pv;
    const revealing = ts < t.fade[1], val = revealing ? ramp(ts, t.values) : 1;
    if (S._traceT != null && !revealing) { S._traceT = null; b12mark(); }
    const scanning = !revealing && (S._scanning || App.t - S._scanEnd < B12.linger);
    const G3 = drawSlab(g, [150, 0, 740, 168], { tilt: 0.55, focus: true, fade: scanning ? 0.55 : 0.75 });
    // real space: the gas the beam crosses
    Ink.label(g, 'the gas the beam crosses', FX.x0, yR - 30);
    drawStrip(g, 0, SC.L, fmx, yR, 10, { alpha: 0.45 });
    Ink.ruler(g, FX.x0, FX.x1, yR + 30, { map: fmx, ticks: [0, 5, 10, 15, 20].map(v => ({ v, s: String(v) })), label: 'distance along the beam [comoving Mpc/h]' });
    // the same gas ordered by velocity: optical depth as ink over light
    Ink.label(g, 'the same gas, ordered by velocity: its optical depth as ink', FX.x0, yV - hV - 10);
    g.save(); g.imageSmoothingEnabled = true; g.drawImage(b12band(Math.round((FX.x1 - FX.x0) * DPR)), FX.x0, yV - hV, FX.x1 - FX.x0, 2 * hV); g.restore();
    // the spectrum
    const mf = f => f0 - f * (f0 - f1);
    Ink.fillUnder(g, SC.ug, SC.F, fmu, mf, mf(1), { c: TK.wash, a: 0.15 }); Ink.curve(g, SC.ug, SC.F, fmu, mf, { w: 1.4 });
    Ink.seg(g, FX.x0, mf(1), FX.x1, mf(1), { w: 0.6, c: TK.faint, dash: [2, 4] });
    Ink.label(g, 'the spectrum, noise-free and at perfect resolution', FX.x0, f1 - 16);   // not what a spectrograph records (Beat 11): the toy's own, as built
    lamTicks(g, f0 + 10);
    // the reverse question: touch the gas — where in the spectrum does it absorb, and how much light does it take
    if (S._rx != null) {
      const { cells, tau } = b12regionTau(S._rx), x0 = Math.min(...cells.map(c => c.x)), x1 = Math.max(...cells.map(c => c.x)), tmax = Math.max(...tau, 1e-9);
      Ink.line(g, [[fmx(x0), yR + 13], [fmx(x0), yR + 16], [fmx(x1), yR + 16], [fmx(x1), yR + 13]], { w: 1.2, c: TK.accent });
      const Fw = SC.F.map((f, i) => Math.exp(-(SC.tau[i] - tau[i])));   // the light without this gas
      g.save(); g.fillStyle = TK.accent; g.globalAlpha = 0.22; g.beginPath(); SC.ug.forEach((u, i) => (i ? g.lineTo : g.moveTo).call(g, fmu(u), mf(Fw[i]))); for (let i = SC.ug.length - 1; i >= 0; i--) g.lineTo(fmu(SC.ug[i]), mf(SC.F[i])); g.closePath(); g.fill(); g.restore();
      { let run = []; const flush = () => { if (run.length > 1) Ink.line(g, run, { w: 1, c: TK.accent }); run = []; };   // its own τ, drawn only where it matters (≥ 1 % of its peak)
        SC.ug.forEach((u, i) => { if (tau[i] >= 0.01 * tmax) run.push([fmu(u), yV - hV - 3 - 26 * tau[i] / tmax]); else flush(); }); flush(); }
      const wide = SC.ug.filter((u, i) => tau[i] > 0.05 * tmax), lo = Math.min(...wide), hi = Math.max(...wide);
      Ink.mono(g, `the gas at x ≈ ${x0.toFixed(1)}–${x1.toFixed(1)} Mpc/h absorbs over ${(hi - lo).toFixed(0)} km/s of colours: its own τ (curve) and the light it removes — what would come back without it (shaded)`, FX.x0, yV + hV + 16, { size: 10.5, c: TK.accent });
    }
    if (S._hx != null && !S._drag12 && Math.abs(S._hx - fmu(S.pu)) > 3) Ink.seg(g, S._hx, yV - hV - 4, S._hx, f0 + 8, { w: 0.7, c: TK.graphite, dash: [2, 3] });   // where a touch would move the cursor
    // the gas that absorbed this colour, then the threads to it (reveal: staged; scanning: live; idle: they fade)
    let traced;
    if (revealing) {
      traced = b12trace(g, S, pv, { cur: clamp(ts / t.cursor, 0, 1), rise: ease(ramp(ts, t.rise)), br: ease(ramp(ts, t.branch)), a: 1 - ramp(ts, t.fade) });
      traced.forEach((gr, k) => { const a = ts - t.develop - 0.12 * k; if (a > 0) develop(g, fmx(gr.xc), yR, Math.max(14, (fmx(gr.x1) - fmx(gr.x0)) / 2 + 14), 19, a, { c: TK.ink, a: 0.12 + 0.55 * Math.sqrt(gr.share) }); });
      S._stains = traced.map(gr => ({ xc: gr.xc, x0: gr.x0, x1: gr.x1, target: 0.12 + 0.55 * Math.sqrt(gr.share), a: ts > t.develop ? 0.12 + 0.55 * Math.sqrt(gr.share) : 0, born: App.t - Math.max(0, ts - t.develop) }));
    } else {
      const a = (App.rm || App.shoot) ? 0.55 : scanning ? 0.85 : 0;
      traced = b12trace(g, S, pv, { a });
      for (const st of b12stains(S, traced, true)) develop(g, fmx(st.xc), yR, Math.max(14, (fmx(st.x1) - fmx(st.x0)) / 2 + 14), 19, App.t - st.born + 2, { c: TK.ink, a: st.a });
      if (S._hg != null && traced[S._hg] && !scanning) fibre(g, fmu(S.pu), yV - hV, fmx(traced[S._hg].xc), yR + 12, { w: 0.6 + 2.4 * traced[S._hg].share, c: TK.accent, a: 0.7 });   // the touched region's own thread
    }
    Ink.dot(g, fmu(S.pu), mf(Math.exp(-pv.tot)), 4.5, { c: TK.accent });
    if (val > 0) {
      const maxT = Math.max(...pv.parts.map(p => p.t), 1e-9);
      for (const p of pv.parts) Ink.seg(g, fmx(p.c.x), yR - 13, fmx(p.c.x), yR - 13 - 45 * Math.sqrt(p.t / maxT) * val, { w: 1.6, c: TK.accent, a: 0.9 });
      for (const gr of traced) { const [rx, ry] = G3.ray(gr.xc); Ink.ring(g, rx, ry, 8, { c: TK.accent, w: 1.3, a: val }); Ink.mono(g, `${Math.round(gr.share * 100)}% of τ`, fmx(gr.xc), yR + 24, { align: 'center', size: 10.5, c: TK.accent, a: val }); }
      const terms = pv.groups.slice(0, th.ledger_terms), rest = pv.tot - terms.reduce((a, gr) => a + gr.t, 0);
      let s = 'τ = '; const prod = [];
      terms.forEach((gr, k) => { s += `${k ? ' + ' : ''}${gr.t.toFixed(2)} (x ≈ ${gr.xc.toFixed(1)})`; prod.push(`${(Math.exp(-gr.t) * 100).toFixed(0)}%`); });
      s += ` + ${rest.toFixed(2)} (rest) = ${pv.tot.toFixed(2)}`;
      Ink.text(g, 'the ledger for this colour:', FX.x0, ly, { f: 'serif', size: 16, c: TK.ink, a: val });
      Ink.mono(g, s, FX.x0 + 230, ly, { size: 11.5, c: TK.ink, a: val });
      Ink.mono(g, `F = ${prod.join(' × ')} × ${(Math.exp(-rest) * 100).toFixed(0)}% = ${(Math.exp(-pv.tot) * 100).toFixed(1)}%`, FX.x0 + 230, ly + 22, { size: 11.5, c: TK.accent, a: val });
      const places = pv.groups.filter(gr => gr.share > th.places_min_share), weak = pv.groups.length >= 4 && (pv.groups[0] || {}).share < 0.4;
      const note = places.length >= 2 ? `this colour was absorbed in ${places.length} places, ${Math.abs(places[0].xc - places[1].xc).toFixed(1)} Mpc/h apart — one feature in the spectrum` : weak ? 'many weak contributions here: no single place dominates' : pv.tot < 0.05 ? 'almost nothing absorbs this colour' : 'here one region dominates';
      Ink.note(g, note, FX.x0, ly + 50, { size: 15, c: places.length >= 2 ? TK.accent : TK.graphite, a: val });
    }
  },
  affordances(S) {
    if (b12since(S) < B12.t.values[0]) return [];
    const { yR, yV, f0, f1 } = B12, x = fmu(S.pu), yF = f0 - Math.exp(-(S._pv ? S._pv.tot : 0)) * (f0 - f1);   // the touched colour is a point on the spectrum, not a thumb on the ruler
    return [{ id: 'scan', kind: 'scan', int: 'INT-SCAN-001', at: [x, yF], hit: { rect: [FX.x0, yV - 20, FX.x1, f0 + 2] }, hint: { key: 'b12.scan', text: 'press the spectrum and slide: who ate each colour?', at: x > 700 ? [x - 30, yF - 26] : [x + 30, yF - 26], align: x > 700 ? 'right' : 'left' } },
      { id: 'gas', name: 'the gas (which colours does it take?)', kind: 'select', int: 'INT-GASREGION-001', at: [fmx(S._rx ?? 10), yR], hit: { rect: [FX.x0, yR - 16, FX.x1, yR + 18] }, bracket: S._rx != null ? null : null }];
  },
  kbTarget: S => (S._rx != null ? 'gas' : 'scan'),
  onPointer(type, p, S) {
    if (!p) { S._hx = null; if (!S._rxPin) S._rx = null; S._hg = null; return; }
    const revealing = b12since(S) < B12.t.fade[1];
    if (type === 'down' && p.aff === 'scan') { S.pu = uOfX(p.x); S._drag12 = true; S._rx = null; if (!b12seen() && S._traceT == null) S._traceT = App.t; else if (revealing) S._traceT = null; S._scanning = true; return; }
    if (type === 'drag' && S._drag12) { S.pu = uOfX(clamp(p.x, FX.x0, FX.x1)); S._traceT = null; S._scanning = true; return; }   // scanning: every frame recomputes the decomposition
    if (type === 'up' && S._drag12) { S._drag12 = false; S._scanning = false; S._scanEnd = App.t; b12mark(); return; }
    S._hx = p.aff === 'scan' ? p.x : null;
    if (p.aff === 'gas' && (type === 'move' || type === 'down')) { S._rx = clamp((p.x - FX.x0) / (FX.x1 - FX.x0) * SC.L, 0, SC.L); if (type === 'down') S._rxPin = !!p.touch; S._hg = null; return; }
    if (type === 'move' && !S._rxPin) S._rx = null;
    if (type === 'down') { S._rxPin = false; S._rx = null; }
    const traced = (S._pv ? S._pv.groups : []).filter(gr => gr.share >= invTh().traced_min_share);   // hovering the developed gas near the cursor's regions: its own thread
    S._hg = null; if (Math.abs(p.y - B12.yR) < 22) traced.forEach((gr, k) => { if (Math.abs(p.x - fmx(gr.xc)) < 16) S._hg = k; });
  },
  onKey(k, S) {
    if (k === 'ArrowRight' || k === 'ArrowLeft') { S.pu = (S.pu + (k === 'ArrowRight' ? 5 : -5) + SC.period) % SC.period; S._traceT = null; S._rx = null; S._scanEnd = App.t; b12mark(); return true; }
    if (k === 'Enter' || k === ' ') { S._traceT = App.t; S._rx = null; return true; }
    if (k === '[' || k === ']') { S._rx = clamp((S._rx ?? 10) + (k === ']' ? 0.5 : -0.5), 0, SC.L); return true; }
    if (k === 'Escape' && S._rx != null) { S._rx = null; S._rxPin = false; return true; }
    return false;
  },
  describe(S) {
    const th = invTh();
    if (S._rx != null) { const { cells, tau } = b12regionTau(S._rx), tmax = Math.max(...tau), wide = SC.ug.filter((u, i) => tau[i] > 0.05 * tmax); return `The gas near ${S._rx.toFixed(1)} Mpc/h (${cells.length} cells) absorbs between ${Math.min(...wide).toFixed(0)} and ${Math.max(...wide).toFixed(0)} km/s; its largest optical depth is ${tmax.toFixed(2)}.`; }
    const pv = S._pv || provenanceAt(S.pu), big = pv.groups.filter(gr => gr.share > th.places_min_share);
    const rest = 1 - big.reduce((s, gr) => s + gr.share, 0);
    return `Tracing one colour back to the gas: at ${S.pu.toFixed(0)} km/s the optical depth is ${pv.tot.toFixed(2)}, so ${(Math.exp(-pv.tot) * 100).toFixed(0)}% of the light gets through. It was absorbed in ${big.length} place${big.length === 1 ? '' : 's'}: ${big.map(gr => `${Math.round(gr.share * 100)}% of the optical depth at ${gr.xc.toFixed(1)} Mpc/h`).join(', ') || 'no single place above 15%'}${big.length && rest > 0.02 ? `, and ${Math.round(rest * 100)}% spread thinly elsewhere` : ''}.`;
  },
  foot: 'traced with the toy’s known gas and noise-free optical depth — an observer must infer this (Beat 13) · the shares sum exactly to the spectrum’s τ (VAL-INV-001) · regions grouped by contiguity, a display choice (VT-INV-TRACE)',
};
