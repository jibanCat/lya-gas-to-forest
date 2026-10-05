/* Beat 11 · A forest emerges. The same rules along this 20 Mpc/h toy stretch; a spectrograph blurs and adds noise to
 * the record only (SCI-OBS-001/002, SCI-MAP-004). "Show the physics" overlays the generating code's own spectrum, an
 * independent check (SCI-SIM-001, VAL-TOY-002). */
import { TK } from '../design/tokens.js';
import { Ink } from '../design/ink.js';
import { clamp } from '../core/util.js';
import { App } from '../core/app.js';
import { metaEqs } from '../core/meta.js';
import { P } from '../physics/lya.js';
import { SC } from '../data/scene-data.js';
import { drawSlab } from '../primitives/slab.js';
import { drawStrip } from '../primitives/sightline.js';
import { FX, fmx, fmu, lamTicks } from '../primitives/forest.js';

export const sceneForest = {
  n: 11,
  slug: 'real-forest',
  keys: 'Use the controls in the margin to change the spectrograph’s resolution and signal-to-noise.',
  eqs: () => metaEqs(11),
  persist: ['fwhm', 'snr'],
  controls: [
    { type: 'ruler', key: 'fwhm', role: 'instrument', why: 'the spectrograph’s own setting: turning it is the physical act of observing, and it changes the record, not the gas', label: 'spectrograph resolution (FWHM)', min: 0, max: 200, step: 1, fmt: v => v < 1 ? 'perfect' : `${v} km/s`, ticks: [{ v: 0, s: 'perfect' }, { v: 70, s: '70' }, { v: 150, s: '150' }], onChange: S => { S._obs = true; } },
    { type: 'choice', key: 'snr', role: 'instrument', why: 'how long the spectrograph collects light: a setting of the measurement, not of the gas', caption: 'settings of the spectrograph, not of the gas', label: 'signal-to-noise per pixel', options: [{ v: 0, s: 'no noise' }, { v: 50, s: '50' }, { v: 20, s: '20' }, { v: 5, s: '5' }], onChange: S => { S._obs = true; } },
  ],
  init(S) { S.fwhm = 0; S.snr = 0; S._obs = false; },
  draw(g, S) {
    drawSlab(g, [150, 0, 740, 196], { tilt: 0.55, focus: true, fade: 0.9 });
    const yR = 248;
    Ink.label(g, 'the gas the beam crosses', FX.x0, yR - 22); drawStrip(g, 0, SC.L, fmx, yR, 11);
    Ink.ruler(g, FX.x0, FX.x1, yR + 16, { map: fmx, ticks: [0, 5, 10, 15, 20].map(v => ({ v, s: String(v) })), label: 'distance along the beam [comoving Mpc/h] — set above the spectrum by expansion alone (u = aH·x)' });
    if (S._obs) Ink.mono(g, 'unchanged', FX.x1, yR - 22, { align: 'right', size: 10 });
    const yT = 400, mt = v => yT - Math.log10(1 + v) / Math.log10(1 + 60) * 70;
    Ink.label(g, 'optical depth (intrinsic) — up is more', FX.x0, yT - 84); Ink.curve(g, SC.ug, Array.from(SC.tau), fmu, mt, { w: 1, c: TK.graphite });
    Ink.seg(g, FX.x0, yT, FX.x1, yT, { w: 0.6, c: TK.faint });
    if (S._obs) Ink.mono(g, 'unchanged', FX.x1, yT - 84, { align: 'right', size: 10 });
    const du = SC.ug[1] - SC.ug[0], Fc = P.convolveLSF(SC.F, du, S.fwhm, { periodic: true });
    const dp = Math.max(2.5, S.fwhm / 3), upix = P.linspace(dp / 2, SC.period - dp / 2, Math.floor(SC.period / dp));   // detector pixels; S/N per pixel (SCI-OBS-002)
    let Fp = upix.map(u => { const j = u / du, j0 = Math.floor(j), f = j - j0; return Fc[j0 % Fc.length] * (1 - f) + Fc[(j0 + 1) % Fc.length] * f; });
    if (S.snr > 0) Fp = P.addNoise(Fp, S.snr, 7);
    const f1 = 480, f0 = 680, mf = f => f0 - clamp(f, -0.15, 1.2) * (f0 - f1);
    Ink.label(g, `the recorded spectrum: the Lyman-α forest${S.fwhm > 0 || S.snr > 0 ? ` (detector pixels of ${dp.toFixed(1)} km/s)` : ''}`, FX.x0, f1 - 18);
    if (S.snr > 0) Ink.mono(g, 'noise scatters the measured points below 0 and above 1 — not negative light', FX.x1, f1 - 4, { align: 'right', size: 9.5, c: TK.graphite });
    if (S.fwhm > 0 || S.snr > 0) Ink.curve(g, SC.ug, SC.F, fmu, mf, { w: 0.9, c: TK.pencil });
    Ink.fillUnder(g, SC.ug, SC.F, fmu, mf, mf(1), { c: TK.wash, a: 0.15 });
    Ink.curve(g, upix, Fp, fmu, mf, { w: S.snr > 0 ? 0.9 : 1.4 });
    if (App.adv && SC.refF) { Ink.curve(g, SC.ug, SC.refF, fmu, mf, { w: 1.1, c: TK.paper, dash: [3, 5] }); Ink.mono(g, `broken line: the data producer’s own spectrum (exact Voigt, independent code), drawn over the browser’s — max |ΔF| = ${SC.refDF.toExponential(0)}`, FX.x0, f1 - 4, { size: 10, c: TK.graphite }); }
    Ink.seg(g, FX.x0, mf(1), FX.x1, mf(1), { w: 0.6, c: TK.faint, dash: [2, 4] }); Ink.mono(g, '1', FX.x0 - 10, mf(1) + 3, { align: 'right' }); Ink.mono(g, '0', FX.x0 - 10, mf(0) + 3, { align: 'right' });
    if (S._obs) Ink.mono(g, 'changed: only what we record', FX.x1, f1 - 18, { align: 'right', size: 10, c: TK.accent });
    lamTicks(g, f0 + 10);
    Ink.mono(g, `mean transmitted flux ⟨F⟩ = ${(SC.F.reduce((a, b) => a + b, 0) / SC.F.length).toFixed(2)} — normalised to the measured z ≈ 3 value`, FX.x0, 752, { size: 10 });
    Ink.mono(g, `(the toy’s ultraviolet background, Γ_HI, tuned to ${SC.sk.Gamma12.toFixed(1)}×10⁻¹² s⁻¹, ~${(SC.sk.Gamma12 / P.C.gamma12_measured_z3).toFixed(0)}× the measured value: a toy)`, FX.x0, 766, { size: 10 });
  },
  describe(S) { const mF = SC.F.reduce((a, b) => a + b, 0) / SC.F.length; return `The same rules along the toy's full ${SC.L.toFixed(0)} Mpc/h stretch: the gas strip above, its optical depth, and the recorded Lyman-alpha forest below, on observed wavelength; on average ${(mF * 100).toFixed(0)}% of the light gets through. Recorded ${S.fwhm < 1 ? 'with perfect resolution' : `at ${S.fwhm} km/s resolution`}${S.snr ? ` and signal-to-noise ${S.snr} per pixel` : ', without noise'}; the gas and its optical depth are unchanged.`; },
  foot: 'toy sightline (SCI-SIM-TOY-001) · Gaussian line-spread function, white noise per detector pixel (SCI-OBS-001, SCI-OBS-002)',
};
