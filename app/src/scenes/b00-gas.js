/* Beat 0 · Gas occupies real space. The volume in shallow perspective; one slow lateral drift on entry gives parallax
 * and then holds (Visual_LyA: nothing loops); the beam runs through it; a cross-section shows gas all around the beam.
 * The gas dissolves into paper at the sample's edges; "show the physics" draws the sample's boundary, labelled.
 * The beam is the surface (INT-PROBE-001): move along it — hover near it, or press and slide — and the probe follows the
 * hand; the cut through the volume, the cross-section, the stretch of the strip it crosses and the density reading follow.
 * Dragging the gas elsewhere turns the volume (INT-VIEW-001, display only). No standing instructions: one first-use verb
 * beside the beam, once per session; then a second for turning. Continuous gas, sampled by a line — never beads. */
import { TK } from '../design/tokens.js';
import { Ink } from '../design/ink.js';
import { clamp, scl, ease } from '../core/util.js';
import { App, motionOK } from '../core/app.js';
import { interaction } from '../core/meta.js';
import { learned } from '../core/runtime.js';
import { hintUsed } from '../primitives/affordance.js';
import { SC, densityWord } from '../data/scene-data.js';
import { drawSlab, slabGeom, crossSection } from '../primitives/slab.js';
import { drawStrip } from '../primitives/sightline.js';

const B0 = { box: [110, 34, 700, 390], inset: [872, 262, 178], swayFrom: 0.7, swayTo: 0.3, drift: 7 };
/** one drift on entry, then hold; the reader can turn the volume themselves */
function b0sway(S) { if (S._held) return S.yaw; if (!motionOK()) return B0.swayTo; return B0.swayFrom + (B0.swayTo - B0.swayFrom) * ease(clamp((App.t - (App.anim.entered || 0)) / B0.drift, 0, 1)); }
/** the beam on screen: its ends, its height and the band the hand finds it in (INT-PROBE-001 gesture params) */
function b0beam(S) { const [rx0, ry] = S._g3.ray(0), [rx1] = S._g3.ray(SC.L), q = (interaction(0, 'INT-PROBE-001').gesture || {}).params || {}; return { rx0, rx1, ry, band: q.band_px ?? 22, learnPx: q.learned_px ?? 30 }; }
/** where along the beam the toy's gas is densest ('max') or emptiest ('min'), away from the ends — for the tour */
function b0along(kind) { const D = SC.sk.Delta, dx = SC.sk.dx_mpch; let k = -1; for (let i = Math.ceil(1 / dx); i < D.length - 1 / dx; i++) if (k < 0 || (kind === 'max' ? D[i] > D[k] : D[i] < D[k])) k = i; return +((k + 0.5) * dx).toFixed(2); }
function b0density(x) { const i = clamp(Math.round(x / SC.sk.dx_mpch - 0.5), 0, SC.sk.x.length - 1); return SC.sk.Delta[i]; }

export const sceneGas = {
  n: 0,
  slug: 'gas-occupies-space',
  keys: 'Left and right arrows move the probe along the beam; up and down arrows tilt the volume.',
  persist: ['px', 'tilt', 'yaw'],
  tour: [   // the slideshow (runtime: advanceStory): each tap acts out one variation with the scene's own state
    { say: 'thin gas fills the space between the quasar and us — denser in filaments, emptier in voids' },
    { say: 'the quasar’s light crosses it along one line, through filaments and voids alike', int: 'INT-PROBE-001', do: S => { S.px = 1; }, dissolve: false, to: { px: 19 }, dur: 4.5 },
    { say: () => `here it crosses ${densityWord(b0density(b0along('min')))}: the light meets whatever gas lies on its line`, int: 'INT-PROBE-001', to: () => ({ px: b0along('min') }), dur: 2.4 },
    { say: 'turn the volume: the gas fills three dimensions, but only the gas on the beam absorbs this light', int: 'INT-VIEW-001', do: S => { S._held = true; }, dissolve: false, to: S => ({ yaw: S.yaw > 0 ? -0.55 : 0.55 }), dur: 2.4 },
  ],
  init(S) { S.px = SC.win.x0 + SC.parcels[1].x; S.tilt = 0.5; S.yaw = B0.swayTo; S._held = false; },
  afterHash(S) { if (S.yaw !== B0.swayTo) S._held = true; },
  draw(g, S) {
    const G3 = drawSlab(g, B0.box, { tilt: S.tilt, sway: b0sway(S), probeX: S.px, cut: true, bounds: App.adv });
    S._g3 = G3;
    const [ix, iy, iw] = B0.inset, sl = SC.slab, img = crossSection(S.px);
    Ink.label(g, 'cross-section at the probe', ix, iy - 30);
    Ink.mono(g, 'looking along the beam', ix, iy - 14, { size: 10 });
    g.save(); g.fillStyle = TK.light; g.fillRect(ix, iy, iw, iw); g.imageSmoothingEnabled = true; g.globalAlpha = 0.85; g.drawImage(img, ix, iy, iw, iw); g.restore();
    Ink.line(g, [[ix, iy], [ix + iw, iy], [ix + iw, iy + iw], [ix, iy + iw], [ix, iy]], { w: 0.8, c: TK.accent, a: 0.7, dash: [3, 3] });
    const cxs = ix + iw * sl.ray_z / sl.lz, cys = iy + iw * (1 - sl.ray_y / sl.ly);
    Ink.ring(g, cxs, cys, 6, { c: TK.accent, w: 1.4 }); Ink.dot(g, cxs, cys, 1.6, { c: TK.accent });
    Ink.seg(g, ix, iy + iw + 12, ix + iw * 2 / sl.lz, iy + iw + 12, { w: 1, c: TK.graphite }); Ink.mono(g, '2 Mpc/h', ix + iw * 2 / sl.lz + 6, iy + iw + 15, { size: 9.5 });
    Ink.note(g, 'the beam, end-on: it samples', ix, iy + iw + 40, { size: 13 }); Ink.note(g, 'one thread of a 3D volume', ix, iy + iw + 58, { size: 13 });
    const [ppx, ppy] = G3.ray(S.px); Ink.seg(g, ppx + 10, ppy, ix - 4, iy + iw / 2, { w: 0.6, c: TK.accent, a: 0.5, dash: [2, 4] });
    const [rx0] = G3.ray(0), [rx1] = G3.ray(SC.L), mx = scl(0, SC.L, rx0, rx1);
    Ink.seg(g, ppx, ppy + 10, mx(S.px), 500 - 18, { w: 0.8, c: TK.accent, dash: [2, 3] });
    Ink.label(g, 'the gas the beam crosses', rx0, 470);
    drawStrip(g, 0, SC.L, mx, 500, 13, { highlight: c => Math.abs(c.x - S.px) <= 0.35 });   // the stretch the probe is in
    const my = D => 655 - Math.log10(D) * 52;
    Ink.seg(g, rx0, my(1), rx1, my(1), { w: 0.6, c: TK.faint, dash: [2, 4] }); Ink.mono(g, 'mean', rx1 + 6, my(1) + 3);
    Ink.curve(g, SC.sk.x, SC.sk.Delta, mx, my, { w: 1.2, c: TK.ink });
    Ink.mono(g, '10×', rx0 - 8, my(10) + 3, { align: 'right' }); Ink.mono(g, '0.1×', rx0 - 8, my(0.1) + 3, { align: 'right' });
    Ink.label(g, 'density, relative to the cosmic mean (log)', rx0, 562);
    Ink.ruler(g, rx0, rx1, 724, { map: mx, ticks: [0, 5, 10, 15, 20].map(v => ({ v, s: String(v) })), label: 'distance along the beam, within the toy sample  [comoving Mpc/h]' });
    const D = b0density(S.px);
    Ink.dot(g, mx(S.px), my(D), 3.5, { c: TK.accent });
    Ink.seg(g, mx(S.px), my(D) - 6, mx(S.px), 588, { w: 0.6, c: TK.accent, dash: [2, 3] });   // the reading sits above the curve, never on it
    Ink.note(g, `here: ${D.toFixed(D < 1 ? 2 : 1)}× the mean density — ${densityWord(D)}`, mx(S.px) + (S.px > 14 ? -6 : 6), 584, { size: 14.5, c: TK.accent, align: S.px > 14 ? 'right' : 'left' });
  },
  affordances(S) {
    if (!S._g3) return [];
    const { rx0, rx1, ry, band } = b0beam(S), [ppx] = S._g3.ray(S.px), [bx, by, bw, bh] = B0.box;
    return [
      { id: 'beam', kind: 'scan', int: 'INT-PROBE-001', at: [ppx, ry], hit: { rect: [rx0 - 10, ry - band, rx1 + 10, ry + band] }, hint: { key: 'b0.beam', text: 'move along the beam', at: [ppx + (S.px > 12 ? -40 : 40), ry - 46], align: S.px > 12 ? 'right' : 'left' } },
      { id: 'volume', name: 'the volume (turn it)', kind: 'grab', int: 'INT-VIEW-001', mark: false, at: [bx + bw - 60, by + 40], hit: { rect: [bx, by, bx + bw, by + bh] }, hint: hintUsed('b0.beam') ? { key: 'b0.turn', text: 'drag the gas to turn it', at: [bx + bw - 20, by + 18], align: 'right' } : null },
    ];
  },
  kbTarget: () => 'beam',
  onPointer(type, p, S) {
    if (!p || !S._g3) return;
    const { rx0, rx1, learnPx } = b0beam(S), toPx = X => clamp((X - rx0) / (rx1 - rx0) * SC.L, 0.05, SC.L - 0.05);
    if (type === 'down') { S._drag = p.aff === 'volume'; S._trace = p.aff === 'beam'; S._p0 = p; S._tilt0 = S.tilt; S._yaw0 = b0sway(S); S._lx = p.x; }
    if (type === 'up') { S._drag = false; S._trace = false; }
    if (type === 'drag' && S._drag) { S._held = true; if (Math.hypot(p.x - S._p0.x, p.y - S._p0.y) > 6) learned('b0.turn'); const q = (interaction(0, 'INT-VIEW-001').gesture || {}).params || {}; S.yaw = clamp(S._yaw0 - (p.x - S._p0.x) * (q.yaw_per_px ?? 0.004), -1, 1); S.tilt = clamp(S._tilt0 + (p.y - S._p0.y) * (q.tilt_per_px ?? 0.004), 0.1, 1.1); return; }
    if ((type === 'drag' && S._trace) || (type === 'move' && p.aff === 'beam') || (type === 'down' && S._trace)) {   // the probe stays under the hand, along the beam
      S.px = toPx(p.x); S._path = (S._path || 0) + Math.abs(p.x - (S._lx ?? p.x)); S._lx = p.x;
      if (S._path > learnPx) learned('b0.beam');
    } else S._lx = null;
  },
  onKey(k, S) {
    if (k === 'ArrowRight' || k === 'ArrowLeft') { S.px = clamp(S.px + (k === 'ArrowRight' ? 0.25 : -0.25), 0.05, SC.L - 0.05); learned('b0.beam'); return true; }
    if (k === 'ArrowUp' || k === 'ArrowDown') { S.tilt = clamp(S.tilt + (k === 'ArrowUp' ? -0.05 : 0.05), 0.1, 1.1); return true; }
    return false;
  },
  kbLearns: true,
  describe(S) { const D = b0density(S.px); return `A block of intergalactic gas, 20 Mpc/h long, denser in filaments and emptier in voids; the quasar's light crosses it along one line toward us. At ${S.px.toFixed(1)} Mpc/h along that line the gas is ${D.toFixed(1)} times the mean density: ${densityWord(D)}.`; },
  foot: 'toy Zel’dovich volume, not a hydro simulation (SCI-SIM-TOY-001) · darker = denser; gas near the beam is also drawn darker, for emphasis (SCI-REP-002) · comoving Mpc/h: distances on today’s scale; 1 Mpc/h ≈ 4.8 million light-years',
};
