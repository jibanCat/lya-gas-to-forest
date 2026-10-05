/* Beat 1 · Same gas, different scale. Four nested frames — volume, parcel, particles, neutral atoms — and the chosen
 * scale large. Representations are labelled where they first appear (SCI-REP-006); the ionised majority appears only
 * here (later beats draw only the neutral atoms that absorb); the parcel's own neutral fraction is computed, not typed (SCI-ION-001/002, SCI-CTX-004). */
import { TK } from '../design/tokens.js';
import { Ink } from '../design/ink.js';
import { clamp, lerp, ease, rgba, fmtA } from '../core/util.js';
import { App, motionOK } from '../core/app.js';
import { META } from '../core/meta.js';
import { P } from '../physics/lya.js';
import { SC } from '../data/scene-data.js';
import { drawSlab, slabGeom } from '../primitives/slab.js';
import { drawAtoms } from '../primitives/atoms.js';

const B1F = { y: 70, w: 226, h: 148, xs: [36, 298, 560, 822] }, B1L = { cx: 400, cy: 490, R: 205 }, B1SLAB = [110, 262, 620, 300];
function b1stage(z) { return clamp(Math.round(z * 3), 0, 3); }
/** the zoom as drawn: after a slideshow tap it eases to the next scale over 0.8 s; the ruler and keys are shown at once */
function b1shown(S) {
  if (S._zT0 == null || !motionOK()) return S.zoom;
  const u = clamp((App.t - S._zT0) / 0.8, 0, 1); if (u >= 1) { S._zT0 = null; return S.zoom; }
  return lerp(S._zFrom, S.zoom, ease(u));
}
const B1KEY = [['wash', 'smooth wash', 'gas — its density (Beats 0, 7–8, 11–12)'], ['stip', 'faint stipple', 'protons and electrons (here only)'], ['dot', 'dark dots', 'neutral atoms, representative (1–4, 6)'], ['smudge', 'smudge', 'a teaching parcel (Beats 6–8); a “cloud” in 13'], ['cells', 'ruled cells', 'the sightline sampled (8–12)']];
function b1stipple(g, cx, cy, R, n, t, { alpha = 1, neutral = 5, seed = 5 } = {}) {
  const r = P.rng(seed), tt = App.rm || App.shoot ? 0 : t;
  g.save(); g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.clip();
  for (let i = 0; i < n; i++) { const a = r() * 2 * Math.PI, rr = Math.sqrt(r()) * R, jx = Math.sin(tt * 1.3 + i) * 1.2, jy = Math.cos(tt * 1.1 + 2 * i) * 1.2; Ink.dot(g, cx + rr * Math.cos(a) + jx, cy + rr * Math.sin(a) + jy, i % 2 ? 0.75 : 1.05, { c: TK.pencil, a: 0.55 * alpha }); }
  for (let i = 0; i < neutral; i++) { const a = r() * 2 * Math.PI, rr = Math.sqrt(r()) * R * 0.85; Ink.dot(g, cx + rr * Math.cos(a), cy + rr * Math.sin(a), 3, { c: TK.ink, a: alpha }); Ink.ring(g, cx + rr * Math.cos(a), cy + rr * Math.sin(a), 6, { c: TK.ink, w: 0.6, a: 0.6 * alpha }); }
  g.restore();
}
/** the parcel at ~1 Mpc/h: a crop of the central slice around the probe — still smooth gas */
function b1parcel(g, x, y, w, h, px, alpha = 1) {
  const sl = SC.slab, img = SC.slices[Math.floor(sl.nz / 2)], spanX = 1.2, spanY = spanX * h / w;
  const sx = (px - spanX / 2) / sl.lx * sl.nx, sy = (1 - (sl.ray_y + spanY / 2) / sl.ly) * sl.ny;
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.fillStyle = TK.light; g.fillRect(x, y, w, h); g.imageSmoothingEnabled = true; g.globalAlpha = 0.9 * alpha;
  g.drawImage(img, sx, sy, spanX / sl.lx * sl.nx, spanY / sl.ly * sl.ny, x, y, w, h); g.restore();
  Ink.seg(g, x, y + h / 2, x + w, y + h / 2, { w: 1, c: TK.ink, a: 0.6 * alpha });
}
/** this parcel's neutral fraction with the measured UV background: x = α_A(T) n_e n_H / Γ (SCI-ION-001/002, SCI-CTX-004) */
function b1oneIn(px) { const i = clamp(Math.round(px / SC.sk.dx_mpch - 0.5), 0, SC.sk.x.length - 1); const x = P.neutralFraction(SC.sk.Delta[i], SC.sk.T[i], SC.sk.nH_bar, P.C.gamma12_measured_z3, SC.sk.cosmo.Yp); return Math.round(1 / x / 1e4) * 1e4; }

export const sceneScales = {
  n: 1,
  slug: 'continuum-to-atoms',
  keys: 'Left and right arrows zoom from the volume down to the atoms.',
  persist: ['zoom'],
  get controls() { return [{ type: 'ruler', key: 'zoom', role: 'instrument', why: 'a magnification — a viewpoint on the same gas, like a microscope’s, not a physical state; the instrument’s own setting', caption: 'the magnification — the same gas at every scale', label: 'zoom', min: 0, max: 1, step: 0.01, fmt: z => ((META(1).stages || [])[b1stage(z)] || {}).label || '', ticks: [{ v: 0, s: 'volume' }, { v: 1 / 3, s: 'parcel' }, { v: 2 / 3, s: 'particles' }, { v: 1, s: 'atoms' }] }]; },
  tour: [0, 1, 2, 3].map(k => ({   // the slideshow: each tap zooms smoothly to the next scale
    say: () => { const st = (META(1).stages || [])[k] || {}; return `${st.label} — ${st.text}`; },
    sync: S => b1stage(S.zoom) === k,
    ...(k ? { do: S => { S._zFrom = b1shown(S); S._zT0 = App.t; S.zoom = k / 3; }, dissolve: false } : {}),
  })),
  init(S) { S.zoom = 0; S.px = SC.win.x0 + SC.parcels[1].x; },
  draw(g, S, t) {
    const z = b1shown(S), k = b1stage(z), st = META(1).stages || [];
    Ink.note(g, 'same gas, different scale', 535, 36, { align: 'center', size: 17, c: TK.ink });
    const scales = ['20 Mpc/h', '1 Mpc/h', '~10 m', 'not to scale'];
    B1F.xs.forEach((x, j) => {
      const y = B1F.y, w = B1F.w, h = B1F.h, on = j === k;
      if (j === 0) drawSlab(g, [x + 4, y + 8, w - 8, h - 16], { tilt: 0.55, quasar: false, observer: false, probeX: S.px });
      if (j === 1) b1parcel(g, x, y, w, h, S.px);
      if (j === 2) { g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.fillStyle = TK.light; g.fillRect(x, y, w, h); b1stipple(g, x + w / 2, y + h / 2, Math.hypot(w, h) / 2, 420, t, { neutral: 2 }); g.restore(); }
      if (j === 3) { g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); drawAtoms(g, x + w / 2, y + h / 2, h * 0.62, 1.5e4, t, { arrows: false }); g.restore(); }
      Ink.line(g, [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]], { w: on ? 1.3 : 0.7, c: on ? TK.accent : TK.faint });
      Ink.text(g, (st[j] || {}).label || '', x, y + h + 20, { f: 'serif', size: 14, c: on ? TK.accent : TK.graphite });
      Ink.mono(g, scales[j], x + w, y + h + 20, { align: 'right', size: 10, c: on ? TK.accent : TK.muted });
      if (j < 3) {
        let qx = x + w / 2, qy = y + h / 2;
        if (j === 0) { const G3 = slabGeom([x + 4, y + 8, w - 8, h - 16], 0.55); [qx, qy] = G3.ray(S.px); }
        const q = 5; Ink.line(g, [[qx - q, qy - q], [qx + q, qy - q], [qx + q, qy + q], [qx - q, qy + q], [qx - q, qy - q]], { w: 0.9, c: TK.accent });
        const nx = B1F.xs[j + 1]; Ink.seg(g, qx + q, qy - q, nx, y, { w: 0.5, c: TK.pencil, dash: [2, 3] }); Ink.seg(g, qx + q, qy + q, nx, y + h, { w: 0.5, c: TK.pencil, dash: [2, 3] });
      }
    });
    const L = B1L, grow = ease(clamp(z / (1 / 3), 0, 1)), fadeSlab = 1 - clamp(z * 3, 0, 0.92);
    const G3 = drawSlab(g, B1SLAB, { tilt: 0.55, fade: fadeSlab, probeX: grow < 0.05 ? S.px : null });
    const [px, py] = G3.ray(S.px), cx = lerp(px, L.cx, grow), cy = lerp(py, L.cy, grow), R = lerp(10, L.R, grow);
    if (z > 0.01) {
      g.save(); g.fillStyle = rgba(TK.paper, clamp(z * 6, 0, 1)); g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill(); g.restore();
      const wC = 1 - clamp((z - 0.4) / 0.2, 0, 1), wS = clamp((z - 0.42) / 0.2, 0, 1) * (1 - clamp((z - 0.78) / 0.18, 0, 1)), wA = clamp((z - 0.76) / 0.2, 0, 1);
      if (wC > 0) { g.save(); g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.clip(); b1parcel(g, cx - R * 1.4, cy - R, R * 2.8, R * 2, S.px, wC); g.restore(); }
      if (wS > 0) b1stipple(g, cx, cy, R, 1600, t, { alpha: wS, neutral: 6 });
      if (wA > 0) drawAtoms(g, cx, cy, R, 1.5e4, t, { arrows: false, alpha: wA });
      Ink.ring(g, cx, cy, R, { c: TK.accent, w: 1.2 });
      if (grow < 0.9) Ink.seg(g, px, py, cx, cy, { w: 0.7, c: TK.accent, a: 0.6, dash: [2, 3] });
      if (k >= 2) Ink.mono(g, 'representative atoms · not to scale', cx, cy + R + 22, { align: 'center', size: 10.5, c: TK.accent });
    }
    const capX = 690, capY = 300;
    Ink.text(g, (st[k] || {}).text || '', capX, capY, { f: 'serif', size: 16, c: TK.ink, italic: true });
    if (k === 2) { Ink.note(g, `dark dots: neutral atoms — about 1 in ${fmtA(b1oneIn(S.px))} in this filament`, capX, capY + 26, { size: 13.5 }); Ink.note(g, '(1 in ~100 000 at average density); drawn: 1 in 300', capX, capY + 44, { size: 13.5 }); }
    if (k === 3) { Ink.note(g, 'only neutral atoms absorb, so from now on we draw', capX, capY + 26, { size: 13.5 }); Ink.note(g, 'just those, gathered for display (really 1 in ~100 000)', capX, capY + 44, { size: 13.5 }); }
    const ky = 560; Ink.label(g, 'what is drawn, and where', capX, ky);
    B1KEY.forEach(([kind, name, what], j) => {
      const y = ky + 24 + j * 24, gx = capX + 10;
      if (kind === 'wash') Ink.blob(g, gx, y - 4, 9, { c: TK.ink, a: 0.45 });
      if (kind === 'stip') for (let q = 0; q < 9; q++) Ink.dot(g, gx - 7 + (q % 3) * 7, y - 11 + Math.floor(q / 3) * 7, 0.9, { c: TK.pencil, a: 0.8 });
      if (kind === 'dot') Ink.dot(g, gx, y - 4, 3, { c: TK.ink });
      if (kind === 'smudge') Ink.smudge(g, gx, y - 4, 4, 5, { c: TK.ink, a: 0.6 });
      if (kind === 'cells') for (let q = 0; q < 4; q++) { g.save(); g.fillStyle = rgba(TK.ink, 0.25 + 0.15 * q); g.fillRect(gx - 9 + q * 5, y - 10, 4, 12); g.restore(); }
      Ink.text(g, name, capX + 30, y, { f: 'sans', size: 12, c: TK.ink });
      Ink.text(g, what, capX + 120, y, { f: 'sans', size: 12, c: TK.muted });
    });
    Ink.mono(g, 'never drawn: simulation particles', capX + 30, ky + 24 + 5 * 24, { size: 10.5 });
  },
  onPointer(type, p, S) { if (type === 'down' && p && S.zoom < 0.05) { const G3 = slabGeom(B1SLAB, 0.55); const [rx0] = G3.ray(0), [rx1] = G3.ray(SC.L); if (p.x > rx0 && p.x < rx1 && p.y > 262) S.px = (p.x - rx0) / (rx1 - rx0) * SC.L; } },
  onKey(k, S) { if (k === 'ArrowRight' || k === 'ArrowLeft') { S.zoom = clamp(Math.round((S.zoom + (k === 'ArrowRight' ? 1 / 3 : -1 / 3)) * 3) / 3, 0, 1); return true; } return false; },
  describe(S) { const st = (META(1).stages || [])[b1stage(S.zoom)] || {}; return `The same gas at four scales — the volume, one parcel, its particles, its neutral atoms. Now: ${st.label} — ${st.text}.`; },
  foot: 'same gas at four scales · atoms are representative (SCI-REP-001), never simulation particles (SCI-REP-006)',
};
