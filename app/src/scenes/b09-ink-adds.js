/* Beat 9 · Ink adds. 24 cells lay transparent layers of optical depth; the wrong rule (adding dips) makes negative
 * light (SCI-TAU-002/003, SCI-REP-005). Under reduced motion the stacking resolves at once. */
import { TK } from '../design/tokens.js';
import { Ink } from '../design/ink.js';
import { clamp } from '../core/util.js';
import { App, motionOK } from '../core/app.js';
import { metaEqs } from '../core/meta.js';
import { P } from '../physics/lya.js';
import { WX, wmx, wmu, UG_W, uRuler, windowKernels, windowFull, maxDF } from '../primitives/sightline.js';

const N9 = 24;

export const sceneInkAdds = {
  n: 9,
  slug: 'ink-adds',
  keys: 'Space plays the stacking again; w toggles the wrong rule.',
  eqs: () => metaEqs(9),
  persist: ['wrong'],
  // only "play the stacking again" replays it; the wrong-rule toggle leaves the stack where it is
  controls: [{ type: 'button', role: 'replay', why: 'replays the stacking of the cells’ ink', label: 'play the stacking again', act: S => { S._t0 = App.t; } }, { type: 'toggle', key: 'wrong', role: 'counterfactual', why: 'a deliberately wrong model, to compare with: what if dips added instead of optical depths', label: 'what if dips added instead?' }],
  init(S) { S.wrong = false; S._t0 = App.t; },
  draw(g, S) {
    const ug = UG_W(), yT = 560, { kern, tot } = windowKernels(N9), tmax = Math.max(...tot) * 1.08, my = v => yT - v / tmax * 360;
    const p = motionOK() ? clamp((App.t - (S._t0 ?? 0)) / 3.2, 0, 1) : 1, shown = Math.round(p * N9), acc = new Float64Array(ug.length);
    Ink.label(g, 'each cell’s ink in velocity space, stacking (transparent layers) — τ, up is more', WX.x0, 120);
    kern.forEach((k, j) => {
      if (j >= shown) return;
      const base = Array.from(acc); for (let i = 0; i < ug.length; i++) acc[i] += k[i];
      const pts = ug.map((u, i) => [wmu(u), my(acc[i])]).concat(ug.slice().reverse().map((u, i) => [wmu(u), my(base[ug.length - 1 - i])]));
      Ink.poly(g, pts, { c: j % 2 ? TK.wash : TK.graphite, a: 0.22 });
    });
    Ink.curve(g, ug, Array.from(acc), wmu, my, { w: 1.7 });
    Ink.seg(g, wmx(-0.4), yT, wmx(4.8), yT, { w: 0.6, c: TK.faint });
    [0, 2, 4, 6, 8, 10, 12, 14].filter(v => v < tmax).forEach(v => { Ink.seg(g, WX.x0 - 6, my(v), WX.x0 - 2, my(v), { w: 0.8 }); Ink.mono(g, String(v), WX.x0 - 10, my(v) + 3, { align: 'right' }); });
    Ink.mono(g, 'τ', WX.x0 - 10, my(tmax * 0.95), { align: 'right', size: 12, c: TK.ink });
    uRuler(g, yT + 6);
    if (p >= 1) Ink.text(g, 'Ink adds.', 760, 170, { f: 'serif', size: 30, c: TK.accent });
    if (S.wrong) {
      const dec = new Float64Array(ug.length); kern.forEach(k => k.forEach((v, i) => dec[i] += 1 - Math.exp(-v)));
      const f1 = 610, f0 = 720, mf = f => f0 - f * (f0 - f1);
      Ink.seg(g, wmx(-0.4), mf(0), wmx(4.8), mf(0), { w: 0.8, c: TK.ink });
      Ink.curve(g, ug, ug.map((u, i) => 1 - dec[i]), wmu, f => mf(Math.max(f, -1.2)), { w: 1.3, c: TK.pencil, dash: [4, 3] });
      Ink.curve(g, ug, Array.from(tot, v => Math.exp(-v)), wmu, mf, { w: 1.5 });
      Ink.note(g, 'dashed: adding the dips gives negative light here — impossible. The ink (τ) adds; the light is F = e^(−Στ), always between 0 and 1.', WX.x0, 770, { size: 14, c: TK.accent });
      Ink.mono(g, '1', WX.x0 - 10, mf(1) + 3, { align: 'right' }); Ink.mono(g, '0', WX.x0 - 10, mf(0) + 3, { align: 'right' });
    }
  },
  onKey(k, S) { if (k === ' ') { S._t0 = App.t; return true; } if (k === 'w') { S.wrong = !S.wrong; return true; } return false; },
  describe(S) { const { tot } = windowKernels(N9); let k = 0; tot.forEach((v, i) => { if (v > tot[k]) k = i; }); return `The 4.4 Mpc/h stretch as 24 cells, each laying its optical depth in velocity space; where they overlap they stack, and the total is their sum, highest (τ ≈ ${tot[k].toFixed(0)}) near ${UG_W()[k].toFixed(0)} km/s.${S.wrong ? ' The wrong rule — adding the dips in the light instead — would give negative light there.' : ''}`; },
  foot: () => `24 cells of the toy sightline, each drawn as a transparent layer of optical depth (SCI-REP-005) · against the full sampling, their transmitted flux differs by at most ${maxDF(windowKernels(N9).tot, windowFull()).toFixed(3)}`,
};
