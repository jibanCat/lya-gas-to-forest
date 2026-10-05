/* Beat 5 · The same colour, stretched — the forest is written along the way (SCI-RED-001…005, SCI-REP-007, VAL-RED-001).
 * Continuous gas along the line of sight, with structure. The quasar's light is a ribbon on a ruler of wavelength measured
 * where the light is now; Lyα of the gas being passed is a fixed mark at 1215.67 Å. As the light travels the whole ribbon
 * stretches past the mark; every bit of gas writes at the mark (density peaks darkly) and written shadows stretch on with
 * the ribbon. At our telescope the shadows are the observed forest.
 * The quasar's own Lyα rides on the ribbon as a quiet graphite anchor (VT-RED-ANCHOR): it leaves the mark at the quasar and
 * drifts redward ahead of every shadow; the close-up keeps a pencil trail of that drift (and of the selected shadow's).
 * "Show the physics": the recorded spectrum in the selected structure's or the quasar's rest frame; a logarithmic ruler.
 * Review probes 3–4 may squeeze the recorded spectrum toward short wavelengths by hand (VT-RED-UNDO): undoing a stretch is
 * a uniform compression about 0 Å, never past the quasar's own frame. */
import { TK } from '../design/tokens.js';
import { Ink } from '../design/ink.js';
import { clamp, lerp, ease, scl, rgba, fmtA, fmtA2 } from '../core/util.js';
import { App, motionOK } from '../core/app.js';
import { META, stageOpts, interaction } from '../core/meta.js';
import { CV, renderControls, refreshMargin, learned } from '../core/runtime.js';
import { P, LYA } from '../physics/lya.js';
import { SC } from '../data/scene-data.js';

export const R5 = {
  zq: 3.2,
  path: { x0: 120, x1: 990, y: 120, hh: 9 },
  rib: { x0: 120, x1: 990, y: 322, h: 38 },
  flux: { top: 356, bot: 436 },
  ruler: 454,
  lin: [0, 5600], log: [250, 7000],
  wDraw: 6.0,        // drawn Doppler width of what each bit of gas writes [Å, measured locally] — ~60× a real line (SCI-REP-007)
  mag: { x0: 170, x1: 600, y0: 186, y1: 240, half: 70 },     // close-up around the mark: ±70 Å (×20)
  field: { M: 1400, ell: 7, sigma: 0.9, seed: 4242, peakMin: 2.2, nExp: 2.0, ampExp: 1.6, meanF: 0.74, narr: [[3.00, 12], [2.90, 8], [2.81, 6]] /* the first is moved to b5selZ() */, narrW: 8, quiet: 2.84 },
};
// ---------------------------------------------------------------------------------------------- the path: comoving distance (Planck 2018, SCI-RED-004)
let _b5chi = null;
export function b5chi() {
  if (_b5chi) return _b5chi;
  const zs = P.linspace(0, 4, 401), chi = zs.map(z => P.comovingDistance(z));
  return (_b5chi = { zs, chi, of: z => { const k = clamp(z / 0.01, 0, 399.999), i = Math.floor(k), f = k - i; return chi[i] * (1 - f) + chi[i + 1] * f; },
    zOf: c => { let i = 0; while (i < 399 && chi[i + 1] < c) i++; const f = (c - chi[i]) / (chi[i + 1] - chi[i] || 1); return zs[i] + 0.01 * clamp(f, 0, 1); } });
}
// ---------------------------------------------------------------------------------------------- the gas: a schematic continuous field (SCI-REP-007)
let _b5f = null;
// the selected structure is the toy stretch of Beats 6–12: it sits at the redshift where the stretch's deepest absorption
// falls on the forest's own wavelength scale (z = SC.z at the toy's near edge, u = c ln(λ/λ0(1+z))), so its shadow is read at
// the same wavelength here and in Beats 11–12
export function b5selZ() {
  const u0 = SC.HUB * SC.win.x0, u1 = u0 + SC.HUB * SC.win.span; let best = Infinity, uc = u0;
  for (let i = 0; i < SC.ug.length; i++) if (SC.ug[i] >= u0 && SC.ug[i] <= u1 && SC.F[i] < best) { best = SC.F[i]; uc = SC.ug[i]; }
  return P.lambdaObs(uc, SC.z) / LYA() - 1;
}
export function b5field() {
  if (_b5f) return _b5f;
  const narr = R5.field.narr.map(([zb, D], j) => [j === 0 ? b5selZ() : zb, D]);
  const F = R5.field, C = b5chi(), cq = C.of(R5.zq), dc = cq / F.M, r = P.rng(F.seed), rad = Math.max(1, Math.round(F.ell / dc));
  let g = Float64Array.from({ length: F.M }, () => P.gauss(r));
  const box = a => { const o = new Float64Array(F.M); for (let i = 0; i < F.M; i++) { let s = 0, n = 0; for (let k = -rad; k <= rad; k++) { const j = i + k; if (j >= 0 && j < F.M) { s += a[j]; n++; } } o[i] = s / n; } return o; };
  g = box(box(box(g))); const sd = Math.sqrt(g.reduce((s, v) => s + v * v, 0) / F.M); g = g.map(v => v / sd);
  const cells = [];
  for (let i = 0; i < F.M; i++) {
    const c = (i + 0.5) * dc, z = C.zOf(c);
    let ln = F.sigma * g[i] * (z > F.quiet ? 0.35 : 1) - F.sigma * F.sigma / 2;
    for (const [zb, D] of narr) { const w = Math.exp(-0.5 * ((c - C.of(zb)) / F.narrW) ** 2); ln = (1 - w) * ln + w * Math.log(D); }
    const D = Math.exp(ln);
    cells.push({ i, c, z, D, lamE: P.lambdaEmitAbsorbed(z, R5.zq), wE: R5.wDraw * (1 + z) / (1 + R5.zq), s: Math.pow(D, F.nExp) * Math.pow((1 + z) / 4, F.ampExp) });
  }
  const band = P.linspace(LYA() * 3, LYA() * 4, 600), base = band.map(lo => { let t = 0; for (const s of cells) { const d = (lo - LYA() * (1 + s.z)) / (R5.wDraw * (1 + s.z)); if (d > -4 && d < 4) t += s.s * Math.exp(-d * d); } return t; });
  let lo = 1e-4, hi = 10; for (let k = 0; k < 50; k++) { const m = Math.sqrt(lo * hi), Fm = base.reduce((a, t) => a + Math.exp(-m * t), 0) / base.length; if (Fm > F.meanF) lo = m; else hi = m; }
  const kap = Math.sqrt(lo * hi); cells.forEach(s => { s.tau0 = kap * s.s; });
  const peaks = [];
  for (let i = 1; i < F.M - 1; i++) if (cells[i].D > cells[i - 1].D && cells[i].D >= cells[i + 1].D && cells[i].D > F.peakMin) {
    let a = i, b = i; while (a > 0 && cells[a - 1].D > 1.3) a--; while (b < F.M - 1 && cells[b + 1].D > 1.3) b++;
    peaks.push({ i, a, b, c: cells[i].c, z: cells[i].z, D: cells[i].D, lamE: cells[i].lamE, cNear: cells[a].c - dc / 2, cFar: cells[b].c + dc / 2 });
  }
  peaks.sort((p, q) => q.z - p.z); peaks.forEach((p, k) => { p.k = k; });
  for (const [zb] of narr) { const p = peaks.find(q => Math.abs(q.z - zb) < 0.01); if (p) { p.z = zb; p.lamE = P.lambdaEmitAbsorbed(zb, R5.zq); } }
  return (_b5f = { cells, peaks, dc, kap });
}
export function b5peaks() { return b5field().peaks; }
// ---------------------------------------------------------------------------------------------- the journey clock (slow for three structures, then accelerating)
let _b5s = null;
export function b5sched() {
  if (_b5s) return _b5s;
  const Pk = b5peaks(), cq = b5chi().of(R5.zq), keys = [{ t: 0, c: cq }, { t: 1.0, c: cq }];
  let t = 1.0;
  Pk.forEach((p, k) => { const travel = [1.8, 2.0, 1.4][k] ?? Math.max(0.09, 0.5 * Math.pow(0.86, k - 3)), hold = [1.1, 0.9, 0.45][k] ?? 0; t += travel; keys.push({ t, c: p.cNear }); p.arrive = t; p.hold = hold; t += hold; if (hold) keys.push({ t, c: p.cNear }); });
  t += 1.4; keys.push({ t, c: 0 });
  const tEnd = t, mid = Pk[Math.min(Pk.length - 1, Math.round(Pk.length / 2))];
  return (_b5s = { keys, tEnd, stageT: [0.5, Pk[0].arrive + 0.9, Pk[1].arrive - 0.5, Pk[1].arrive + 0.75, mid.arrive + 0.02, tEnd, tEnd] });
}
export function b5chiAt(t) { const K = b5sched().keys; if (t <= 0) return K[0].c; for (let i = 1; i < K.length; i++) if (t <= K[i].t) { const a = K[i - 1], b = K[i]; return b.t > a.t ? lerp(a.c, b.c, (t - a.t) / (b.t - a.t)) : b.c; } return 0; }
function b5tAt(c) { const K = b5sched().keys; for (let i = 1; i < K.length; i++) if (c >= K[i].c && K[i].c !== K[i - 1].c) { const a = K[i - 1], b = K[i]; return lerp(a.t, b.t, (a.c - c) / (a.c - b.c)); } return b5sched().tEnd; }
export function b5stageT(st) { return b5sched().stageT[clamp(st, 1, 7) - 1]; }
export function b5phase(t) { const Pk = b5peaks(), sch = b5sched(); return t < Pk[0].arrive - 0.3 ? 1 : t < Pk[0].arrive + Pk[0].hold ? 2 : t < Pk[1].arrive - 0.2 ? 3 : t < Pk[3].arrive ? 4 : t < sch.tEnd ? 5 : 6; }
function b5writing(cL, t) { const Pk = b5peaks(); return Pk.findIndex(p => (cL <= p.cFar && cL >= p.cNear - 1) || (t >= p.arrive - 0.02 && t <= p.arrive + Math.max(p.hold, 0.12))); }
/** journey time now: an animation frame (jt), play (continuous, or step by step under reduced motion), a drag, or an eased move to the chosen step */
function b5tau(S) {
  const sch = b5sched();
  if (S.jt != null) return +S.jt;
  if (S._play) {
    const t = App.t - S._t0;
    if (App.rm) { const st = clamp(1 + Math.floor(t / 1.8), 1, 6); if (st !== S.stage) { S.stage = st; setTimeout(() => { renderControls(); refreshMargin(); }, 0); } if (st >= 6) S._play = false; return b5stageT(st); }
    const ph = b5phase(t);
    if (ph !== S.stage && t < sch.tEnd) { S.stage = ph; setTimeout(() => { renderControls(); refreshMargin(); }, 0); }
    if (t < sch.tEnd + 0.01) return t;
    S._play = false; S.stage = 6; S._tFrom = S._tTo = sch.tEnd; setTimeout(() => { renderControls(); refreshMargin(); }, 0);
  }
  if (S._free != null) return S._free;
  const to = S._tTo ?? b5stageT(S.stage), from = S._tFrom ?? to, k = (App.shoot || App.rm) ? 1 : ease(clamp((App.t - (S._since || 0)) / 1.4, 0, 1));
  return lerp(from, to, k);
}
export function b5frameD(S, f) { return f === 'absorber' ? (1 + R5.zq) / (1 + b5peaks()[S.sel].z) : f === 'quasar' ? 1 : 1 + R5.zq; }
export function b5map(S) { const r = R5.rib, [a, b] = S.logr ? R5.log : R5.lin; return S.logr ? (l => r.x0 + (Math.log(Math.max(l, 1)) - Math.log(a)) / (Math.log(b) - Math.log(a)) * (r.x1 - r.x0)) : (l => r.x0 + (l - a) / (b - a) * (r.x1 - r.x0)); }
export function b5inv(S, X) { const r = R5.rib, [a, b] = S.logr ? R5.log : R5.lin, f = (X - r.x0) / (r.x1 - r.x0); return S.logr ? a * Math.pow(b / a, f) : a + f * (b - a); }
/** τ on a row of columns: every cell the light has passed (c ≥ cL) has written its shadow (SCI-RED-005); F = e^−τ (SCI-FLUX-001) */
function b5tauCols(n, lamOf, cL) {
  const tau = new Float64Array(n), cells = b5field().cells, lam = Float64Array.from({ length: n }, (_, i) => lamOf(i)), l0 = lam[0], l1 = lam[n - 1];
  for (const s of cells) {
    if (s.c < cL) continue;
    const lo = s.lamE - 4 * s.wE, hi = s.lamE + 4 * s.wE; if (hi < l0 || lo > l1) continue;
    let a = 0, b = n - 1; while (a < b) { const m = (a + b) >> 1; if (lam[m] < lo) a = m + 1; else b = m; } const i0 = a;
    a = i0; b = n - 1; while (a < b) { const m = (a + b + 1) >> 1; if (lam[m] > hi) b = m - 1; else a = m; } const i1 = a;
    for (let i = i0; i <= i1; i++) { const d = (lam[i] - s.lamE) / s.wE; tau[i] += s.tau0 * Math.exp(-d * d); }
  }
  return tau;
}
function b5cont(lamE) { return 1 + 1.3 * Math.exp(-(((lamE - LYA()) / 9) ** 2)); }      // schematic quasar Lyα emission (SCI-RED-002)
let _b5strip = null;
function b5stripImage() {
  if (_b5strip) return _b5strip;
  const { cells } = b5field(), cv = document.createElement('canvas'), M = cells.length, H = 15; cv.width = M; cv.height = H;
  const x = cv.getContext('2d'), im = x.createImageData(M, H);
  for (let i = 0; i < M; i++) { const a = clamp((Math.log10(cells[i].D) + 0.6) / 1.75, 0.03, 1), core = Math.pow(a, 1.3) * 0.62, hw = 0.32 + 0.28 * a; for (let j = 0; j < H; j++) { const yy = (j + 0.5) / H - 0.5, q = (j * M + i) * 4; im.data[q] = 31; im.data[q + 1] = 39; im.data[q + 2] = 50; im.data[q + 3] = 255 * core * Math.exp(-0.5 * (yy / (hw * 0.5)) ** 2); } }
  x.putImageData(im, 0, 0); return (_b5strip = cv);
}
function b5Xc(c) { const pth = R5.path; return pth.x0 + c / b5chi().of(R5.zq) * (pth.x1 - pth.x0); }
/** the quasar's own Lyα, carried by the ribbon (it stretches with it): a quiet graphite mark, labelled on the ribbon's own scale */
const B5ANCHOR_W = 290;   // the anchor label's width (~51 glyphs of 9 px mono): tick labels keep clear of it
function b5anchor(g, XA, r, dim) {
  if (XA < r.x0 || XA > r.x1) return;
  Ink.seg(g, XA, r.y - r.h / 2 - 1, XA, r.y - r.h / 2 - 7, { w: 1.2, c: TK.graphite, a: dim });
  const right = XA > r.x1 - B5ANCHOR_W;   // near the ribbon's red end the label reads leftward, so it stays on the figure
  Ink.mono(g, 'the quasar’s own Lyα (where its emission line sits)', XA + (right ? -4 : 4), r.y - r.h / 2 - 10, { align: right ? 'right' : 'left', size: 9, c: TK.graphite, a: dim });
}
/** the recorded spectrum can be squeezed by hand: in review probes 3–4, and with "show the physics" at the forest */
function b5canSqueeze(S) { return !!S._arrived && S.stage === 6 && ((S.probeCompress && App.probe && !App.probe.revealed) || (App.adv && !App.probe)); }
function b5go(S, st) { S._tFrom = S._tauNow ?? 0; S._tTo = b5stageT(st); S._since = App.t; S._free = null; S._play = false; S.jt = null; }

export const sceneStretched = {
  n: 5,
  slug: 'same-colour-stretched',
  keys: 'Left and right arrows move the light along its path; [ and ] select the previous or next structure; space plays the journey. In review questions 3 and 4, down and up arrows squeeze and release the recorded spectrum; Enter answers.',
  eqs: S => {
    const has = (e, id) => (e.ids || []).includes(id), fm = S.stage >= 6 && S.frame;
    const base = (META(5).equations || []).filter(e => (!has(e, 'SCI-RED-002') || fm === 'quasar') && (!has(e, 'SCI-RED-003') || S.logr));
    const p = b5peaks()[S.sel], lo = P.lambdaObsOfRest(LYA(), p.z);
    return [...base, { note: `selected structure, z ≈ ${p.z.toFixed(2)}: written where the light was 1215.67 Å locally; we receive it at λ_obs = 1215.67 Å × (1 + z) ≈ ${lo.toFixed(1)} Å; in the quasar’s frame (z_q = ${R5.zq}) it is at ≈ ${(lo / (1 + R5.zq)).toFixed(1)} Å`, ids: ['SCI-RED-005'] }];
  },
  persist: ['stage', 'sel', 'frame', 'logr'],
  get controls() {
    const ctl = [
      { type: 'choice', key: 'stage', role: 'step', why: 'bookmarks along the journey of the light (the drag of the light is primary)', label: 'step', caption: 'a “structure” is a denser part of the continuous gas, not a separate object', options: stageOpts(5), onChange: S => b5go(S, S.stage) },
      { type: 'button', role: 'replay', why: 'plays the journey of the light end to end', label: 'play the whole journey ▸', act: S => { S._play = true; S._t0 = App.t; S._free = null; S.jt = null; } },
    ];
    // in a review question the frame switch appears only after the reveal (it would otherwise give the answer away)
    if (App.adv || (App.state.probeFrames && (!App.probe || App.probe.revealed))) ctl.push({ type: 'choice', key: 'frame', role: 'advanced', why: 'the frame selector for exact repeats; the squeeze is the gesture (show the physics)', label: 'express the recorded spectrum in', show: S => S.stage >= 6, options: [{ v: 'obs', s: 'our frame' }, { v: 'absorber', s: 'the selected structure’s rest frame' }, { v: 'quasar', s: 'the quasar’s rest frame' }], onChange: S => { S._fD0 = S._DNow ?? b5frameD(S, 'obs'); S._fSince = App.t; S._Dsq = null; } });
    if (App.adv) ctl.push({ type: 'toggle', key: 'logr', role: 'advanced', why: 'a choice of representation for the ruler (show the physics)', label: 'logarithmic ruler' });
    return ctl;
  },
  init(S) { S.stage = 1; S.sel = 0; S.frame = 'obs'; S.logr = false; S._tFrom = 0; S._tTo = b5stageT(1); S._since = App.t; S._free = null; S._play = false; S._hintT = App.t; },
  afterHash(S) { S.stage = clamp(+S.stage || 1, 1, 7); S.sel = clamp(+S.sel || 0, 0, b5peaks().length - 1); if (S.frame === 'cloud') S.frame = 'absorber'; S._tFrom = S._tTo = b5stageT(S.stage); if (!App.adv && !S.probeFrames) { S.frame = 'obs'; S.logr = false; } },
  draw(g, S, t) {
    const Pk = b5peaks(), sch = b5sched(), C = b5chi(), pth = R5.path, r = R5.rib;
    const tau = b5tau(S); S._tauNow = tau;
    const cL = b5chiAt(tau), zL = C.zOf(cL), arrived = tau >= sch.tEnd - 1e-6, zoom = S.stage === 7 && arrived && S.jt == null && !S._play;
    const frameMode = (App.adv || S.probeFrames) && arrived && S.stage >= 6 && !zoom, showEm = App.adv || S.showEmission;
    let D = (1 + R5.zq) / (1 + zL);
    if (frameMode) { const D1 = b5frameD(S, S.frame), k = (App.shoot || App.rm) ? 1 : ease(clamp((App.t - (S._fSince || 0)) / 1.4, 0, 1)); D = lerp(S._fD0 ?? D1, D1, k); }
    const squeezing = S._Dsq != null && arrived && !zoom; if (squeezing) D = S._Dsq;   // the reader's own compression (review probes 3–4)
    S._DNow = D; S._zL = zL; S._arrived = arrived;
    const writing = arrived ? -1 : b5writing(cL, tau), sel = Pk[S.sel], dim = zoom ? 0.35 : 1, selWritten = cL <= sel.cNear + 1;
    // real space: quasar → continuous gas → us
    const Xc = b5Xc;
    g.save(); g.globalAlpha = dim; g.imageSmoothingEnabled = true; g.drawImage(b5stripImage(), pth.x0, pth.y - pth.hh, pth.x1 - pth.x0, 2 * pth.hh); g.restore();
    for (const zz of [0.5, 1, 2, 3]) { const X = Xc(C.of(zz)); Ink.seg(g, X, pth.y + pth.hh + 3, X, pth.y + pth.hh + 7, { w: 0.6, c: TK.pencil, a: dim }); Ink.mono(g, `z = ${zz}`, X, pth.y + pth.hh + 19, { align: 'center', size: 9.5, c: TK.muted, a: dim }); }
    Ink.ring(g, pth.x0 - 12, pth.y, 6, { c: TK.ink, w: 1.1, a: dim }); Ink.dot(g, pth.x0 - 12, pth.y, 2, { a: dim }); Ink.note(g, 'us', pth.x0 - 24, pth.y + 5, { size: 14, align: 'right', a: dim });
    const qx = pth.x1 + 12; Ink.dot(g, qx, pth.y, 5, { a: dim }); for (let k = 0; k < 8; k++) { const an = k * Math.PI / 4; Ink.seg(g, qx + 8 * Math.cos(an), pth.y + 8 * Math.sin(an), qx + 13 * Math.cos(an), pth.y + 13 * Math.sin(an), { w: 0.8, a: dim }); }
    Ink.note(g, 'quasar', qx + 20, pth.y + 5, { size: 14, a: dim });
    const bracket = (p, col, a) => { const x0 = Xc(p.cNear), x1 = Xc(p.cFar); Ink.line(g, [[x0, pth.y - pth.hh - 3], [x0, pth.y - pth.hh - 6], [x1, pth.y - pth.hh - 6], [x1, pth.y - pth.hh - 3]], { w: 1.1, c: col, a }); Ink.line(g, [[x0, pth.y + pth.hh + 1], [x1, pth.y + pth.hh + 1]], { w: 1.1, c: col, a }); };
    bracket(sel, TK.accent, 1);
    const xs = Xc(sel.c);
    Ink.note(g, `selected · z ≈ ${sel.z.toFixed(2)}`, xs, pth.y - pth.hh - 14, { align: xs > 760 ? 'right' : 'center', size: 13, c: TK.accent });
    if (writing >= 0 && writing !== S.sel && !zoom) bracket(Pk[writing], TK.accent, 0.75);
    Ink.mono(g, 'gas along the line of sight (schematic) · comoving distance, Planck 2018 · z: redshift — light from there reaches us stretched 1 + z times', pth.x0, pth.y + pth.hh + 36, { size: 9.5, c: TK.muted, a: dim });
    const xl = Xc(cL), showLight = !arrived || S.jt != null;
    if (showLight) {
      const wl = 6.5 * (1 + R5.zq) / (1 + zL), pts = [];
      for (let i = 0; i <= 60; i++) { const s_ = i / 60 * 3 * wl; pts.push([xl + s_ - 1.5 * wl, pth.y - 46 + 5 * Math.sin(2 * Math.PI * s_ / wl)]); }
      Ink.line(g, pts, { w: 1.3, c: TK.ink });
      Ink.ring(g, xl, pth.y - 46, 14, { c: TK.graphite, w: 0.6, a: 0.7 });
      Ink.seg(g, xl, pth.y - 32, xl, pth.y - pth.hh - 1, { w: 0.6, c: TK.graphite, a: 0.6, dash: [2, 3] });
      Ink.mono(g, `z = ${zL.toFixed(2)} · stretched ×${((1 + R5.zq) / (1 + zL)).toFixed(2)}`, xl, pth.y - 68, { align: xl > 760 ? 'right' : xl < 300 ? 'left' : 'center', size: 10.5, c: TK.ink });
    }
    // the ribbon on the ruler of "here"
    const map = b5map(S), at = lE => map(lE * D), W = r.x1 - r.x0, tcol = b5tauCols(W + 1, i => b5inv(S, r.x0 + i) / D, cL);
    g.save(); g.globalAlpha = dim; g.fillStyle = TK.light; g.fillRect(r.x0, r.y - r.h / 2, W, r.h);
    for (let i = 0; i <= W; i++) { const a = 1 - Math.exp(-tcol[i]); if (a < 0.01) continue; g.fillStyle = rgba(TK.ink, 0.9 * a); g.fillRect(r.x0 + i, r.y - r.h / 2, 1.05, r.h); }
    g.restore();
    Ink.seg(g, r.x0, r.y - r.h / 2, r.x1, r.y - r.h / 2, { w: 0.6, c: TK.graphite, a: dim }); Ink.seg(g, r.x0, r.y + r.h / 2, r.x1, r.y + r.h / 2, { w: 0.6, c: TK.graphite, a: dim });
    Ink.label(g, 'the quasar’s light · its own labels: the wavelength it left with (Å)', r.x1, r.y - r.h / 2 - 30, { a: dim, align: 'right' });
    let lastLab = -1e9;
    const XA = at(LYA());
    for (let lE = 100; lE <= 1600; lE += 100) { const X = at(lE); if (X < r.x0 - 1 || X > r.x1 + 1) continue; Ink.seg(g, X, r.y - r.h / 2, X, r.y - r.h / 2 - (lE % 400 ? 3 : 6), { w: 0.7, c: TK.pencil, a: dim }); if (lE % 400 === 0 && X - lastLab > 46 && (XA > r.x1 - B5ANCHOR_W ? (X < XA - B5ANCHOR_W || X > XA + 22) : (X < XA - 22 || X > XA + B5ANCHOR_W))) { Ink.mono(g, String(lE), X, r.y - r.h / 2 - 9, { align: 'center', size: 9, c: TK.muted, a: dim }); lastLab = X; } }
    b5anchor(g, XA, r, dim);
    if (selWritten) { const X = at(sel.lamE); Ink.seg(g, X, r.y - r.h / 2 - 2, X, r.y - r.h / 2 - 14, { w: 1.4, c: TK.accent }); }
    const fl = R5.flux, Fmax = showEm ? 2.45 : 1.08, myF = f => fl.bot - f / Fmax * (fl.bot - fl.top), pts = [];
    for (let i = 0; i <= W; i++) { const lE = b5inv(S, r.x0 + i) / D; pts.push([r.x0 + i, myF(Math.exp(-tcol[i]) * (showEm ? b5cont(lE) : 1))]); }
    Ink.seg(g, r.x0, myF(1), r.x1, myF(1), { w: 0.5, c: TK.faint, dash: [2, 4], a: dim }); Ink.seg(g, r.x0, myF(0), r.x1, myF(0), { w: 0.5, c: TK.hair, a: dim });
    Ink.line(g, pts, { w: 1.1, c: TK.graphite, a: dim });
    Ink.mono(g, '1', r.x0 - 8, myF(1) + 3, { align: 'right', a: dim }); Ink.mono(g, '0', r.x0 - 8, myF(0) + 3, { align: 'right', a: dim });
    if (showEm) { const Xq = at(LYA()); if (Xq > r.x0 && Xq < r.x1) Ink.mono(g, 'the quasar’s own Lyα', Xq, myF(2.3) - 4, { align: 'center', size: 9.5, c: TK.graphite, a: dim }); }
    // the ruler and Lyα on it
    const ry = R5.ruler, ticks = S.logr ? [300, 500, 1000, 1500, 2000, 3000, 5000, 7000].map(v => ({ v, s: fmtA(v) })) : [0, 1000, 2000, 3000, 4000, 5000].map(v => ({ v, s: fmtA(v) }));
    const zf = (1 + R5.zq) / D - 1, where = squeezing ? (App.probe ? `after undoing a stretch of ×${((1 + R5.zq) / D).toFixed(2)}` : `in the rest frame of gas at z ≈ ${zf.toFixed(2)}: λ_obs / (1 + z)`) : frameMode ? (S.frame === 'absorber' ? `in the selected structure’s rest frame (z ≈ ${sel.z.toFixed(2)}): λ_obs / (1 + z)` : S.frame === 'quasar' ? `in the quasar’s rest frame: λ_obs / (1 + ${R5.zq.toFixed(2)})` : 'observed, at our telescope') : arrived ? 'measured at our telescope' : `measured where the light is now (z ≈ ${zL.toFixed(2)})`;
    Ink.ruler(g, r.x0, r.x1, ry, { map, ticks, label: `wavelength ${where} [Å]` + (S.logr ? ' · logarithmic' : '') });
    if (!S.logr) for (let l = 200; l < 5600; l += 200) if (l % 1000) Ink.seg(g, map(l), ry, map(l), ry + 2.5, { w: 0.6, c: TK.pencil });
    const XL = map(LYA()), penOn = writing >= 0;
    Ink.seg(g, XL, r.y - r.h / 2 - 4, XL, ry + 26, { w: penOn ? 1.8 : 1.1, c: penOn ? TK.accent : TK.graphite, a: dim });
    if (!S.conceal) {
      Ink.text(g, 'Lyα · 1215.67 Å', XL, ry + 42, { f: 'sans', size: 12, c: penOn || frameMode ? TK.accent : TK.ink, align: 'center', weight: 400, a: dim });
      Ink.mono(g, frameMode ? 'Lyα in this frame' : arrived ? 'every shadow lies redward of 1215.67 Å: written at Lyα, then stretched' : 'Lyα of the gas the light is passing, in its own frame', XL - 6, ry + 56, { align: 'left', size: 9.5, c: TK.muted, a: dim });
    }
    if (penOn && showLight) Ink.seg(g, xl, pth.y + pth.hh + 2, XL, r.y - r.h / 2 - 6, { w: 0.7, c: TK.accent, a: 0.5, dash: [2, 3] });
    // close-up of the mark (the early steps)
    const magA = frameMode || S.logr || zoom ? 0 : 1 - clamp((tau - Pk[4].arrive) / 1.2, 0, 1);
    if (magA > 0.02) {
      const M = R5.mag, n = M.x1 - M.x0 + 1, tm = b5tauCols(n, i => (LYA() - M.half + i / (n - 1) * 2 * M.half) / D, cL), mlam = l => M.x0 + (l - (LYA() - M.half)) / (2 * M.half) * (M.x1 - M.x0);
      g.save(); g.globalAlpha = magA; g.fillStyle = TK.light; g.fillRect(M.x0, M.y0, M.x1 - M.x0, M.y1 - M.y0);
      for (let i = 0; i < n; i++) { const a = 1 - Math.exp(-tm[i]); if (a > 0.01) { g.fillStyle = rgba(TK.ink, 0.9 * a); g.fillRect(M.x0 + i, M.y0, 1.05, M.y1 - M.y0); } }
      g.restore();
      Ink.line(g, [[M.x0, M.y0], [M.x1, M.y0], [M.x1, M.y1], [M.x0, M.y1], [M.x0, M.y0]], { w: 0.6, c: TK.graphite, a: magA });
      Ink.seg(g, mlam(LYA()), M.y0 - 4, mlam(LYA()), M.y1 + 4, { w: penOn ? 1.6 : 1, c: penOn ? TK.accent : TK.graphite, a: magA });
      for (const l of [1150, 1200, 1250]) { Ink.seg(g, mlam(l), M.y1, mlam(l), M.y1 + 3, { w: 0.6, c: TK.pencil, a: magA }); Ink.mono(g, String(l), mlam(l), M.y1 + 13, { align: 'center', size: 9, c: TK.muted, a: magA }); }
      Ink.mono(g, 'close-up around 1215.67 Å (×20)', M.x1 + 8, M.y0 + 9, { size: 9.5, c: TK.muted, a: magA });
      Ink.seg(g, M.x0, M.y1, map(LYA() - M.half), r.y - r.h / 2, { w: 0.5, c: TK.pencil, dash: [2, 3], a: magA }); Ink.seg(g, M.x1, M.y1, map(LYA() + M.half), r.y - r.h / 2, { w: 0.5, c: TK.pencil, dash: [2, 3], a: magA });
      if (selWritten) { const Xs = mlam(sel.lamE * D); if (Xs > M.x0 + 2) { const Xe = Math.min(Xs, M.x1); if (Xe - mlam(LYA()) > 4) Ink.arrow(g, mlam(LYA()), M.y0 - 6, Xe, M.y0 - 6, { w: 0.7, c: TK.accent, a: 0.55 * magA, head: Xs < M.x1 ? 0 : 4, dash: [2, 3] }); if (Xs < M.x1) Ink.seg(g, Xs, M.y0 - 2, Xs, M.y0 - 10, { w: 1.3, c: TK.accent, a: magA }); } }
      { const Xa = mlam(LYA() * D), Xe = Math.min(Xa, M.x1), y = M.y1 + 22;   // the quasar's own Lyα: it left the mark at the quasar and drifts redward (memory: a pencil trail)
        if (Xe - mlam(LYA()) > 3) Ink.arrow(g, mlam(LYA()), y, Xe, y, { w: 0.7, c: TK.pencil, a: magA, head: 4 });
        if (Xa <= M.x1) { Ink.seg(g, Xa, M.y1, Xa, M.y1 + 6, { w: 1.2, c: TK.graphite, a: magA }); Ink.mono(g, 'quasar’s own Lyα', Xa + 4, y + 12, { align: Xa > M.x1 - 60 ? 'right' : 'left', size: 9, c: TK.graphite, a: magA }); }
        else Ink.mono(g, 'quasar’s own Lyα →', M.x1, y + 12, { align: 'right', size: 9, c: TK.graphite, a: magA }); }
    }
    // after arrival: read two shadows (formulas only with "show the physics")
    if (arrived && !zoom) {
      const Xs = at(sel.lamE), lo = sel.lamE * D, ly = ry + 80, fg = Pk.reduce((a, p) => Math.abs(p.z - 1.2) < Math.abs(a.z - 1.2) ? p : a, Pk[0]), Xf = at(fg.lamE);
      const lab = squeezing && !App.probe ? `selected: ${fmtA2(lo)} Å` : frameMode && S.frame === 'absorber' ? `selected: ${fmtA2(lo)} Å — back at Lyα` : frameMode && S.frame === 'quasar' ? `selected: ${fmtA2(lo)} Å — blueward of the quasar’s Lyα` : `selected: ${fmtA(lo)} Å (z ≈ ${sel.z.toFixed(2)})` + (App.adv ? ` = 1215.67 × (1 + ${sel.z.toFixed(2)})` : '');
      Ink.seg(g, Xs, R5.flux.bot + 2, Xs, ly + 4, { w: 0.7, c: TK.accent, dash: [2, 3] });
      if (!(S.conceal && frameMode)) Ink.mono(g, lab, Xs, ly + 16, { align: Xs > 700 ? 'right' : 'left', size: 10.5, c: TK.accent });
      if (!frameMode || S.frame === 'obs') { Ink.seg(g, Xf, R5.flux.bot + 2, Xf, ly - 12, { w: 0.7, c: TK.graphite, dash: [2, 3] }); Ink.mono(g, `a nearer structure: ${fmtA(fg.lamE * D)} Å (z ≈ ${fg.z.toFixed(2)})` + (App.adv ? ` = 1215.67 Å × (1 + z)` : ''), Xf, ly, { align: 'center', size: 10.5, c: TK.graphite }); }
    }
    // one short line; the precise frame language lives in "show the physics"
    let l1 = ''; const nWritten = Pk.filter(p => cL <= p.cNear + 1).length;
    if (zoom) l1 = 'One shadow, magnified: under expansion alone, 4.4 Mpc/h of gas spans about 500 km/s — from here on, km/s.';
    else if (squeezing && !App.probe) l1 = `Every shadow and the quasar’s Lyα move together: this is the spectrum as gas at z = ${((1 + R5.zq) / D - 1).toFixed(2)} would measure it.`;
    else if (frameMode && !squeezing && S.frame === 'absorber') l1 = 'In the selected structure’s rest frame its shadow is back at exactly 1215.67 Å.';
    else if (frameMode && !squeezing && S.frame === 'quasar') l1 = 'In the quasar’s rest frame the whole forest lies blueward of the quasar’s own Lyα.';
    else if (nWritten >= 2 || arrived) l1 = 'Different structures write the same Lyα shadow at different redshifts.';
    else if (nWritten >= 1 && writing !== 0) l1 = 'The shadow then stretches with the travelling light.';
    else if (writing === 0 || nWritten >= 1) l1 = 'Hydrogen absorbs at Lyα in its own frame, scattering that colour out of the beam: a shadow.';
    if (l1 && !S.hideLine) Ink.text(g, l1, 60, zoom ? 744 : 612, { f: 'serif', size: 18.5, c: TK.ink });
    if (S.logr && !zoom) Ink.mono(g, 'on a logarithmic ruler a stretch is a slide: every label moves by ln(1 + z) — in km/s, that slide is the velocity axis of the next beats', 60, 640, { size: 10, c: TK.muted });
    if (zoom) b5zoom(g, at(sel.lamE));
    if (S._hx != null && S._hx > r.x0 && S._hx < r.x1 && !zoom && !S.conceal && !S._sq) {
      const lam = b5inv(S, S._hx);
      Ink.seg(g, S._hx, r.y - r.h / 2 - 2, S._hx, ry + 4, { w: 0.8, c: TK.graphite });
      const rt = S._hx > r.x1 - 170, hx = rt ? S._hx - 6 : S._hx + 6, al = rt ? 'right' : 'left';   // keep the readout on the figure
      Ink.mono(g, `here: ${fmtA(lam)} Å`, hx, ry - 8, { size: 10.5, c: TK.ink, align: al });
      Ink.mono(g, `left the quasar at ${fmtA(lam / D)} Å`, hx, r.y + 4, { size: 10.5, c: TK.ink, align: al });
    }
  },
  affordances(S) {
    const pth = R5.path, Pk = b5peaks(), cL = b5chiAt(S._tauNow ?? 0), xl = b5Xc(cL), arrived = !!S._arrived, zoom = S.stage === 7 && arrived;
    if (zoom) return [];
    const out = [];
    if (b5canSqueeze(S)) { const X = b5map(S)(Pk[S.sel].lamE * (S._DNow || 1)); out.push({ id: 'squeeze', kind: 'grab', int: 'INT-SQUEEZE-001', at: [X, R5.rib.y - R5.rib.h / 2 - 8], hit: { rect: [R5.rib.x0, R5.rib.y - R5.rib.h / 2 - 4, R5.rib.x1, R5.flux.bot + 4] },
      hint: App.probe ? null : { key: 'b5.squeeze', text: 'hold a shadow and pull it back toward Lyα', at: [X - 20, R5.rib.y - R5.rib.h / 2 - 44], align: 'right' } }); }
    if (!arrived || S._drag5) out.push({ id: 'light', kind: 'grab', int: 'INT-LIGHT-001', at: [xl, pth.y - 46], hit: { rect: [xl - 26, pth.y - 72, xl + 26, pth.y - 22] }, hint: App.probe ? null : { key: 'b5.light', text: 'drag the light', at: [xl - 52, pth.y - 41], align: 'right' } });
    const selWritten = cL <= Pk[S.sel].cNear + 1;
    Pk.forEach(q => { const x0 = b5Xc(q.cNear), x1 = b5Xc(q.cFar), xc = b5Xc(q.c); out.push({ id: 'struct:' + q.k, kind: 'select', int: 'INT-STRUCT-001', at: [xc, pth.y], hit: { rect: [Math.min(x0, xc - 6) - 2, pth.y - pth.hh - 8, Math.max(x1, xc + 6) + 2, pth.y + pth.hh + 8] }, bracket: [x0, x1, pth.y + pth.hh + 4],
      hint: !App.probe && selWritten && q.k === (Pk.find(p => p.k !== S.sel && cL <= p.cNear) || Pk[1]).k ? { key: 'b5.select', text: 'select another structure', at: [xc, pth.y + pth.hh + 54], align: 'center' } : null }); });
    return out;
  },
  kbTarget: () => 'light',
  onPointer(type, p, S) {
    if (!p) { S._hx = null; return; }
    const pth = R5.path, Pk = b5peaks(), cq = b5chi().of(R5.zq), xl = b5Xc(b5chiAt(S._tauNow ?? 0));
    const onLight = Math.abs(p.x - xl) < 22 && Math.abs(p.y - (pth.y - 46)) < 22, onGas = Math.abs(p.y - pth.y) < pth.hh + 6 && p.x > pth.x0 && p.x < pth.x1;
    const onRuler = p.y > R5.ruler - 16 && p.y < R5.ruler + 34 && p.x > R5.rib.x0 && p.x < R5.rib.x1, onSpectrum = p.y > R5.rib.y - R5.rib.h / 2 && p.y < R5.flux.bot + 4 && p.x > R5.rib.x0 && p.x < R5.rib.x1;
    if (type === 'down' && App.probe && onRuler && App.hooks.probeAnswer) { App.hooks.probeAnswer({ lambda: b5inv(S, p.x) }); return; }
    const canSqueeze = b5canSqueeze(S);
    if (type === 'down' && onSpectrum && S._arrived) {   // choose a shadow: the structure whose shadow is nearest
      const D = S._DNow, map = b5map(S), hit = Pk.reduce((a, q) => Math.abs(map(q.lamE * D) - p.x) < Math.abs(map(a.lamE * D) - p.x) ? q : a, Pk[0]);
      if (Math.abs(map(hit.lamE * D) - p.x) < 14) { S.sel = hit.k; S._selectedAt = App.t; }
      if (canSqueeze) { S._sq = { x0: p.x, D0: D }; S._hx = null; }   // grab the recorded spectrum (and the chosen shadow with it)
      return;
    }
    if (S._sq && (type === 'drag' || type === 'move')) {
      const r = R5.rib; let D = clamp(S._sq.D0 * (p.x - r.x0) / Math.max(1, S._sq.x0 - r.x0), 1, 1 + R5.zq); S._snap = null;
      if (!App.probe) for (const f of ['absorber', 'quasar', 'obs']) { const Df = b5frameD(S, f); if (Math.abs(b5map(S)(Pk[S.sel].lamE * D) - b5map(S)(Pk[S.sel].lamE * Df)) < (((interaction(5, 'INT-SQUEEZE-001').gesture || {}).params || {}).detent_px ?? 7)) { D = Df; S._snap = f; } }   // detents at the named frames (not in review probes)
      S._Dsq = D; return;
    }   // uniform compression about 0 Å; never past the quasar's frame
    if (type === 'up' && S._sq) {
      S._sq = null; if (S._Dsq != null && S.squeezeAnswers && App.hooks.probeAnswer) App.hooks.probeAnswer({ lambda: Pk[S.sel].lamE * S._Dsq });
      if (!App.probe && S._snap) { S.frame = S._snap; S._fD0 = S._Dsq; S._fSince = App.t; S._Dsq = null; S._snap = null; setTimeout(() => { renderControls(); refreshMargin(); }, 0); }   // landing on a named frame selects it
      if (!App.probe && S._Dsq != null) learned('b5.squeeze');
      return;
    }
    if (type === 'down' && onGas && !onLight) {
      const hit = Pk.reduce((a, q) => Math.abs(b5Xc(q.c) - p.x) < Math.abs(b5Xc(a.c) - p.x) ? q : a, Pk[0]);
      if (Math.abs(b5Xc(hit.c) - p.x) < 12 || p.aff === 'struct:' + hit.k) { if (hit.k !== S.sel) { S.sel = hit.k; S._selectedAt = App.t; } return; }
    }
    if (type === 'down' && (p.aff === 'light' || onLight || Math.abs(p.y - (pth.y - 46)) < 40)) { S._drag5 = true; S._grabDx = p.aff === 'light' || onLight ? p.x - xl : 0; }   // hold the light where it was grabbed
    if (type === 'up') { S._drag5 = false; }
    if (S._drag5 && (type === 'drag' || type === 'down')) {   // continuous in the light's position; redshift and wavelengths follow from it
      S._free = b5tAt(clamp((p.x - (S._grabDx || 0) - pth.x0) / (pth.x1 - pth.x0), 0, 1) * cq); S._play = false; S.jt = null;
      const ph = b5phase(S._free); if (ph !== S.stage && ph < 6) { S.stage = ph; setTimeout(() => { renderControls(); refreshMargin(); }, 0); }   // the margin's step follows the light
      return;
    }
    S._hx = (p.y > R5.rib.y - 40 && p.y < R5.ruler + 10) ? p.x : null;
  },
  onKey(k, S) {
    const cq = b5chi().of(R5.zq), Pk = b5peaks();
    if (S.probeCompress && S._arrived && App.probe && !App.probe.revealed) {   // squeeze by keyboard (review probes 3–4)
      if (k === 'ArrowDown' || k === 'ArrowUp') { S._Dsq = clamp((S._Dsq ?? S._DNow) * (k === 'ArrowDown' ? 0.98 : 1 / 0.98), 1, 1 + R5.zq); return true; }
      if (k === 'Enter' && S.squeezeAnswers && S._Dsq != null && App.hooks.probeAnswer) { App.hooks.probeAnswer({ lambda: Pk[S.sel].lamE * S._Dsq }); return true; }
    }
    if (k === 'ArrowLeft' || k === 'ArrowRight') { const c = clamp(b5chiAt(S._tauNow ?? 0) + (k === 'ArrowLeft' ? -0.015 : 0.015) * cq, 0, cq); S._free = b5tAt(c); S._play = false; S.jt = null; return true; }
    if (k === '[' || k === ']') { S.sel = clamp(S.sel + (k === ']' ? 1 : -1), 0, Pk.length - 1); return true; }
    if (k === ' ') { S._play = true; S._t0 = App.t; S._free = null; S.jt = null; return true; }
    return false;
  },
  describe(S) {
    const Pk = b5peaks(), sel = Pk[S.sel], zL = S._zL ?? R5.zq, n = Pk.filter(p => b5chiAt(S._tauNow ?? 0) <= p.cNear + 1).length;
    if (S._arrived) return `At our telescope: ${Pk.length} drawn structures — denser parts of the continuous gas, far fewer than a real path crosses — have written their Lyα shadows; the selected one (z ≈ ${sel.z.toFixed(2)}) is at ${fmtA(LYA() * (1 + sel.z))} Å.`;
    return `The light is at z = ${zL.toFixed(2)}, stretched ${((1 + R5.zq) / (1 + zL)).toFixed(2)} times since it left the quasar; ${n} drawn structure${n === 1 ? ' has' : 's have'} written a shadow at Lyα, 1215.67 Å in their own frame (a structure is a denser part of the continuous gas).`;
  },
  foot: 'schematic continuous gas and redshift evolution — the low-redshift forest is exaggerated; shadows drawn ~60× wider than real forest lines (SCI-REP-007) · only Lyα drawn · Planck 2018 distances (SCI-RED-004)',
};
/** step 7: the stretch of the toy sightline around the selected structure, read in Å and in km/s — the axis of Beat 6 */
function b5zoom(g, Xshadow) {
  const y0 = 528, sx0 = 140, sx1 = 520, vx0 = 620, vx1 = 1040, span = SC.win.span, uSpan = SC.HUB * span, l0 = P.lambdaObs(SC.HUB * SC.win.x0, SC.z), rb = R5.rib.y + R5.rib.h / 2 + 2;
  Ink.seg(g, Xshadow - 14, rb, Xshadow + 14, rb, { w: 1.4, c: TK.accent });
  Ink.seg(g, Xshadow - 14, rb, vx0, y0 + 26, { w: 0.5, c: TK.accent, dash: [2, 3], a: 0.7 }); Ink.seg(g, Xshadow + 14, rb, vx1, y0 + 26, { w: 0.5, c: TK.accent, dash: [2, 3], a: 0.7 });
  Ink.label(g, 'the gas around the selected structure — 4.4 Mpc/h of the toy sightline (z ≈ 3)', sx0, y0 + 8);
  const mx = scl(0, span, sx0, sx1);
  for (const c of SC.win.cells) { const tn = clamp((Math.log10(c.N / SC.maxN) + 2.6) / 2.6, 0.02, 1), xl = c.x - SC.win.x0; g.save(); g.fillStyle = rgba(TK.ink, 0.85 * tn); g.fillRect(mx(xl - SC.sk.dx_mpch / 2), y0 + 40, mx(SC.sk.dx_mpch) - mx(0) + 0.6, 26); g.restore(); }
  Ink.ruler(g, sx0, sx1, y0 + 74, { map: mx, ticks: [0, 1, 2, 3, 4].map(v => ({ v, s: String(v) })), label: 'distance [comoving Mpc/h]' });
  const u0 = SC.HUB * SC.win.x0, mu = scl(0, uSpan, vx0, vx1), us = [], Fs = [];
  for (let i = 0; i < SC.ug.length; i++) { const u = SC.ug[i] - u0; if (u >= 0 && u <= uSpan) { us.push(u); Fs.push(SC.F[i]); } }
  const fy1 = y0 + 26, fy0 = y0 + 96, mf = f => fy0 - f * (fy0 - fy1);
  Ink.fillUnder(g, us, Fs, mu, mf, mf(1), { c: TK.wash, a: 0.15 }); Ink.curve(g, us, Fs, mu, mf, { w: 1.3, c: TK.graphite });
  Ink.seg(g, vx0, mf(1), vx1, mf(1), { w: 0.5, c: TK.faint, dash: [2, 4] });
  Ink.ruler(g, vx0, vx1, fy0 + 4, { map: mu, ticks: [0, 100, 200, 300, 400, 500].map(v => ({ v, s: String(v) })), label: 'velocity from the near edge [km/s]' });
  const lam = u => l0 * Math.exp(u / P.C.c_kms), uOfL = l => P.C.c_kms * Math.log(l / l0), lt = [];
  for (let l = Math.ceil(l0); l <= lam(uSpan); l += 2) lt.push({ v: uOfL(l), s: fmtA(l) });
  Ink.ruler(g, vx0, vx1, fy0 + 44, { map: mu, ticks: lt, label: 'observed wavelength [Å]' });
  Ink.mono(g, `the same span, under expansion alone: ${span.toFixed(1)} Mpc/h  ↔  ${uSpan.toFixed(0)} km/s  ↔  ${(lam(uSpan) - l0).toFixed(1)} Å`, sx0, y0 + 128, { size: 10.5, c: TK.ink });
  if (App.adv) Ink.mono(g, 'u = aH x + v_pec;  λ = 1215.67 (1 + z) e^(u/c) — the stretch, measured in km/s', sx0, y0 + 146, { size: 10, c: TK.muted });
}
