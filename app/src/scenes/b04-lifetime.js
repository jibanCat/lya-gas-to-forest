/* Beat 4 · The atom's lifetime leaves faint, far wings. Surface in four steps (only the survival curve: the lifetime is the physics); the
 * classical damped oscillator and the Voigt sum are in the microscopes (SCI-NAT-001, SCI-VOIGT-001/002). */
import { TK } from '../design/tokens.js';
import { Ink } from '../design/ink.js';
import { clamp, scl, logTicks, fmtT } from '../core/util.js';
import { App, motionOK } from '../core/app.js';
import { META, metaEqs, stageOpts, report } from '../core/meta.js';
import { P } from '../physics/lya.js';

export const sceneLifetime = {
  n: 4,
  slug: 'lifetime-wings',
  keys: 'Left and right arrows step through the four statements.',
  eqs: S => metaEqs(4, S.stage >= 3 ? [{ note: `now: b = ${P.dopplerB(S.T).toFixed(1)} km/s → a = ${(P.aDamp(P.dopplerB(S.T)) * 1e4).toFixed(1)}×10⁻⁴; FWHM ratio thermal/natural ≈ ${Math.round(2 * Math.sqrt(Math.log(2)) * P.dopplerB(S.T) / (2 * P.C.gamma_kms) / 10) * 10}`, ids: ['SCI-NAT-001', 'SCI-THERM-002'] }] : []),
  persist: ['T', 'stage'],
  get controls() {
    return [{ type: 'choice', key: 'stage', role: 'step', why: 'a chain of reasoning (a short life → a spread of colours → the core is motion → the wings are lifetime), not a physical state', label: 'step', options: stageOpts(4) },
      { type: 'ruler', key: 'T', role: 'advanced', why: 'the claim (lifetime → wings) does not need it; on the surface it would be a second temperature gesture after Beat 3’s hold, so it is a precision control in “show the physics”', label: 'temperature', min: 2000, max: 1e5, log: true, fmt: fmtT, ticks: logTicks([3e3, 1e4, 3e4, 1e5], v => v >= 1e5 ? '1e5' : v >= 1e4 ? `${v / 1e4}e4` : `${v / 1e3}e3`), show: S => S.stage >= 3 && App.adv }];
  },
  init(S) { S.T = 1e4; S.stage = 1; },
  draw(g, S, t) {
    const st = (META(4).stages || [])[S.stage - 1] || {}, on1 = S.stage === 1;
    Ink.blob(g, 90, 120, 22, { c: TK.accent, a: 0.2 }); Ink.dot(g, 90, 120, 6, { c: TK.accent });
    Ink.note(g, 'one atom, excited by a photon at t = 0', 120, 125, { size: 14.5, c: TK.ink });
    const tx0 = 60, tx1 = 450, ty = 300, mt = scl(0, 8, tx0, tx1), tau = 1 / P.C.A21 * 1e9, ts = P.linspace(0, 8, 400);
    Ink.fillUnder(g, ts, ts.map(tt => Math.exp(-tt / tau)), mt, v => ty - 110 * v, ty, { c: TK.accent, a: on1 ? 0.12 : 0.05 });
    Ink.curve(g, ts, ts.map(tt => Math.exp(-tt / tau)), mt, v => ty - 110 * v, { w: on1 ? 1.8 : 1.2, c: on1 ? TK.accent : TK.graphite });
    Ink.ruler(g, tx0, tx1, ty + 4, { map: mt, ticks: [0, 1.6, 4, 8].map(v => ({ v, s: v === 1.6 ? '1.6 ns' : String(v) })), label: 'time [ns]' });
    Ink.note(g, 'chance it is still excited', mt(1.9), ty - 62, { size: 14, c: on1 ? TK.accent : TK.graphite });
    if (on1 && motionOK()) { const ph = t % 8; Ink.dot(g, mt(ph), ty - 110 * Math.exp(-ph / tau), 3.5, { c: TK.accent }); }
    const x0 = 540, x1 = 1040, yB = 600;
    if (S.stage <= 2) {
      const mv = scl(-0.05, 0.05, x0, x1), vs = P.linspace(-0.05, 0.05, 801), gm = P.C.gamma_kms, my = p => yB - 380 * p;
      Ink.seg(g, mv(0), yB, mv(0), yB - 390, { w: 0.9, c: TK.pencil, dash: [3, 3] });
      Ink.note(g, 'if it lasted forever: exactly one colour', mv(0) + 8, yB - 380, { size: 13.5, c: TK.muted });
      if (S.stage === 2) {
        const L = vs.map(v => gm * gm / (v * v + gm * gm));
        Ink.fillUnder(g, vs, L, mv, my, yB, { c: TK.accent, a: 0.15 }); Ink.curve(g, vs, L, mv, my, { w: 1.7, c: TK.accent });
        Ink.seg(g, mv(-gm), my(0.5), mv(gm), my(0.5), { w: 1, c: TK.accent }); Ink.mono(g, `${(2 * gm).toFixed(3)} km/s`, mv(gm) + 8, my(0.5) + 3, { size: 10.5, c: TK.accent });
        Ink.note(g, 'a very narrow natural line', mv(-0.048), my(0.75), { size: 15, c: TK.accent });
      } else Ink.note(g, 'what does a short life do to the colour? →', x0, yB - 200, { size: 15, c: TK.graphite });
      Ink.ruler(g, x0, x1, yB + 4, { map: mv, ticks: [-0.04, -0.02, 0, 0.02, 0.04].map(v => ({ v, s: String(v) })), label: 'Δv [km/s] · magnified ×1200 relative to the next step' });
    } else if (S.stage === 3) {
      const b = P.dopplerB(S.T), mv = scl(-60, 60, x0, x1), vs = P.linspace(-60, 60, 1201), my = p => yB - 330 * p, gm = P.C.gamma_kms;
      Ink.fillUnder(g, vs, vs.map(v => Math.exp(-((v / b) ** 2))), mv, my, yB, { c: TK.wash, a: 0.3 }); Ink.curve(g, vs, vs.map(v => Math.exp(-((v / b) ** 2))), mv, my, { w: 1.6 });
      Ink.seg(g, mv(0), yB, mv(0), yB - 330, { w: 1.1, c: TK.accent });
      Ink.note(g, `motion: FWHM ≈ ${(2 * Math.sqrt(Math.log(2)) * b).toFixed(0)} km/s`, mv(-58), my(0.62), { size: 14 });
      Ink.note(g, 'lifetime: the hairline', mv(2), yB - 340, { size: 14, c: TK.accent });
      const ix = 830, iy = 120, iw = 200, ih = 120, ivs = P.linspace(-0.05, 0.05, 300), imv = scl(-0.05, 0.05, ix, ix + iw);
      Ink.ring(g, mv(0), yB - 230, 9, { c: TK.accent, w: 0.8 }); Ink.seg(g, mv(0) + 9, yB - 232, ix + 20, iy + ih, { w: 0.6, c: TK.pencil, dash: [2, 3] });
      Ink.fillUnder(g, ivs, ivs.map(v => gm * gm / (v * v + gm * gm)), imv, p => iy + ih - 100 * p, iy + ih, { c: TK.accent, a: 0.15 }); Ink.curve(g, ivs, ivs.map(v => gm * gm / (v * v + gm * gm)), imv, p => iy + ih - 100 * p, { w: 1.2, c: TK.accent });
      Ink.mono(g, '×1200 · natural width 0.012 km/s', ix + iw, iy - 6, { align: 'right', size: 10, c: TK.accent });
      Ink.ruler(g, x0, x1, yB + 4, { map: mv, ticks: [-50, -25, 0, 25, 50].map(v => ({ v, s: String(v) })), label: 'Δv [km/s] · linear' });
    } else {
      const b = P.dopplerB(S.T), a = P.aDamp(b), mv = scl(-260, 260, x0, x1), yT = 120, vs = P.linspace(-260, 260, 1601), my = p => yB - (Math.log10(Math.max(p, 1e-9)) + 9) / 12 * (yB - yT);
      let xc = 3; for (let x = 2; x < 7; x += 0.001) if (a / (Math.sqrt(Math.PI) * x * x) > Math.exp(-x * x)) { xc = x; break; }
      const core = vs.filter(v => Math.abs(v) <= xc * b);
      Ink.fillUnder(g, core, core.map(v => P.voigtH(a, v / b)), mv, my, yB, { c: TK.wash, a: 0.35 });
      for (const sgn of [-1, 1]) { const w = vs.filter(v => sgn * v >= xc * b); Ink.fillUnder(g, w, w.map(v => P.voigtH(a, v / b)), mv, my, yB, { c: TK.accent, a: 0.18 }); }
      Ink.curve(g, vs, vs.map(v => Math.max(Math.exp(-((v / b) ** 2)), 1e-9)), mv, my, { w: 1, c: TK.pencil, dash: [3, 3] });
      Ink.curve(g, vs, vs.map(v => a / (Math.sqrt(Math.PI) * ((v / b) ** 2 + a * a))), mv, my, { w: 1, c: TK.accent, a: 0.8 });
      Ink.curve(g, vs, vs.map(v => P.voigtH(a, v / b)), mv, my, { w: 1.7 });
      for (const sgn of [-1, 1]) Ink.seg(g, mv(sgn * xc * b), yT, mv(sgn * xc * b), yB, { w: 0.7, c: TK.pencil, dash: [3, 3] });
      Ink.note(g, 'core: motion', mv(0), my(1) - 10, { align: 'center', size: 14.5, c: TK.ink });
      Ink.note(g, 'wings: lifetime', mv(-185), my(3e-6) - 16, { align: 'center', size: 14.5, c: TK.accent });
      { const X = mv(xc * b), right = X > x1 - 240; Ink.note(g, `beyond ≈ ${(xc * b).toFixed(0)} km/s the lifetime wins`, X + (right ? -8 : 8), yT + 18, { size: 13.5, c: TK.accent, align: right ? 'right' : 'left' }); }   // reads leftward near the edge (hot gas)
      [['1', 1], ['10⁻³', 1e-3], ['10⁻⁶', 1e-6], ['10⁻⁹', 1e-9]].forEach(([s_, v]) => { Ink.seg(g, x0 - 8, my(v), x0 - 3, my(v), { w: 0.8, c: TK.graphite }); Ink.mono(g, s_, x0 - 12, my(v) + 3, { align: 'right' }); });
      Ink.ruler(g, x0, x1, yB + 4, { map: mv, ticks: [-200, -100, 0, 100, 200].map(v => ({ v, s: String(v) })), label: 'Δv [km/s] · height: absorption strength, logarithmic' });
    }
    Ink.text(g, `${st.label || ''} —`, 60, 700, { f: 'serif', size: 19, c: TK.ink });
    Ink.text(g, st.text || '', 60, 728, { f: 'serif', size: 17, c: TK.graphite, italic: true });
  },
  onKey(k, S) { if (k === 'ArrowRight' || k === 'ArrowLeft') { S.stage = clamp(S.stage + (k === 'ArrowRight' ? 1 : -1), 1, 4); return true; } return false; },
  describe(S) { const st = (META(4).stages || [])[S.stage - 1] || {}; return `${S.stage <= 2 ? "One atom's absorption line, at Lyα in its own frame: a very narrow natural (Lorentzian) line, set by the excited state's finite lifetime." : "A parcel's absorption line, at Lyα in its own frame: a thermal core from the atoms' distribution of motions, while each atom's finite lifetime contributes faint natural wings."} Step ${st.label}: ${st.text}.`; },   // steps 1–2 show one atom; steps 3–4 the gas
  micro: {
    lifetime: {
      ask: 'why does a short life spread the colour?', title: 'A short life means a spread of colours',
      text: 'A classical analogue: a bell that rings and dies away. A long ring has a pure pitch; a short one is a spread of pitches.\nThe atom’s excited state fades in the same way, so the colour it absorbs is spread too: the natural line, whose width is set by the lifetime.',
      controls: [{ type: 'ruler', key: 'mL', label: 'lifetime, relative to the real 1.6 ns', min: 0.25, max: 4, log: true, fmt: v => `×${v.toFixed(2)}`, ticks: logTicks([0.25, 0.5, 1, 2, 4], v => `×${v}`) }],
      init(S) { S.mL = S.mL ?? 1; },
      eqs: () => [{ tex: 'x(t) \\propto e^{-\\Gamma t/2}\\cos\\omega_0 t \\;\\Rightarrow\\; |X(\\omega)|^2 \\propto \\dfrac{1}{(\\omega-\\omega_0)^2 + (\\Gamma/2)^2}', note: 'classical analogue only: a decaying oscillation has a Lorentzian spectrum of full width Γ (angular frequency)', ids: ['SCI-NAT-001'] },
        { tex: '\\Delta\\nu_{\\rm FWHM} = \\dfrac{\\Gamma}{2\\pi} \\approx 100\\ {\\rm MHz} \\;\\Leftrightarrow\\; 2\\gamma \\approx 0.012\\ {\\rm km\\,s^{-1}}', note: 'Γ = A₂₁ = 6.26×10⁸ s⁻¹: the physical statement is the finite lifetime of 2p', ids: ['SCI-NAT-001', 'SCI-ATOM-001'] }],
      draw(g, S) {
        const L = S.mL, mt = scl(0, 6, 80, 440), ts = P.linspace(0, 6, 1500), yC = 300;
        Ink.label(g, 'classical analogue: a ringing that dies away (schematic pitch)', 80, 90);
        Ink.curve(g, ts, ts.map(tt => Math.exp(-tt / (2 * L)) * Math.cos(2 * Math.PI * 4 * tt)), mt, v => yC - 120 * v, { w: 1, c: TK.graphite });
        Ink.curve(g, ts, ts.map(tt => Math.exp(-tt / (2 * L))), mt, v => yC - 120 * v, { w: 1, c: TK.pencil, dash: [3, 3] });
        Ink.ruler(g, 80, 440, yC + 140, { map: mt, ticks: [0, 1, 2, 4, 6].map(v => ({ v, s: String(v) })), label: 'time [in units of the real lifetime, 1.6 ns]' });
        const mf = scl(-4, 4, 540, 940), fs = P.linspace(-4, 4, 800), w = 1 / L, my = p => 440 - 300 * p, Lz = fs.map(f => (w / 2) ** 2 / (f * f + (w / 2) ** 2));
        Ink.label(g, 'its spread of colours (frequency), same height', 540, 90);
        Ink.fillUnder(g, fs, Lz, mf, my, 440, { c: TK.accent, a: 0.15 }); Ink.curve(g, fs, Lz, mf, my, { w: 1.7, c: TK.accent });
        Ink.seg(g, mf(-w / 2), my(0.5), mf(w / 2), my(0.5), { w: 1, c: TK.accent }); Ink.mono(g, `full width ×${w.toFixed(2)}`, mf(w / 2) + 8, my(0.5) + 3, { size: 10.5, c: TK.accent });
        Ink.ruler(g, 540, 940, 446, { map: mf, ticks: [-4, -2, 0, 2, 4].map(v => ({ v, s: String(v) })), label: 'frequency offset [units of the real natural width, ≈ 100 MHz]' });
        Ink.note(g, L < 1 ? 'shorter life → wider spread' : L > 1 ? 'longer life → purer colour' : 'the real 2p lifetime → the real natural width', 540, 520, { size: 16, c: TK.ink });
      },
    },
    voigt: {
      ask: 'how do the two pieces combine?', title: 'Every atom’s own line, at every atom’s speed',
      text: 'Each atom has its own narrow natural (Lorentzian) line, centred on its own Doppler shift. The parcel’s line is all of them added up: a convolution of the speed census with the natural line.\nThe sum is the Voigt profile, written with the function H(a, x).',
      controls: [{ type: 'ruler', key: 'mA', label: 'damping drawn exaggerated by', min: 1, max: 1000, log: true, fmt: v => `×${Math.round(v)}`, ticks: logTicks([1, 10, 100, 1000], v => `×${v}`) }],
      init(S) { S.mA = S.mA ?? 300; },
      eqs: () => { const r = report('VAL-VOIGT-001'), e = r.regions ? Math.max(...r.regions.map(x => x.max_rel_err)) : NaN; return [{ tex: 'H(a,x) = \\dfrac{a}{\\pi}\\int_{-\\infty}^{\\infty}\\dfrac{e^{-y^2}\\,dy}{(x-y)^2+a^2}', note: 'Voigt–Hjerting function; φ(Δv) = H(a, Δv/b)/(√π b)', ids: ['SCI-VOIGT-001'] }, { tex: 'H(a,x)\\to \\dfrac{a}{\\sqrt{\\pi}\\,x^2}\\ \\ (|x|\\gg 1)', note: 'the wings are the Lorentzian tail', ids: ['SCI-VOIGT-001'] }, { note: `browser: Humlicek (1982) W4; checked against scipy.special.wofz, max rel. error ${e.toExponential(1)}`, ids: ['SCI-VOIGT-002', 'VAL-VOIGT-001'] }]; },
      draw(g, S) {
        const aEx = P.aDamp(P.dopplerB(1e4)) * S.mA, mx = scl(-5, 5, 80, 940), xs = P.linspace(-5, 5, 1000), r = P.rng(3);
        Ink.curve(g, xs, xs.map(x => Math.exp(-x * x)), mx, p => 220 - 140 * p, { w: 1, c: TK.pencil, dash: [3, 3] });
        Ink.label(g, 'the census (dashed) and each atom’s own line, at its own speed', 80, 50);
        for (let k = 0; k < 24; k++) { const v = Math.SQRT1_2 * P.gauss(r); Ink.curve(g, xs, xs.map(x => aEx * aEx / ((x - v) ** 2 + aEx * aEx)), mx, p => 220 - 90 * p, { w: 0.8, c: TK.accent, a: 0.7 }); }
        const V = xs.map(x => P.voigtH(aEx, x)), my = p => 560 - (Math.log10(Math.max(p, 1e-7)) + 7) / 7 * 230;
        Ink.label(g, `their sum: the Voigt profile, logarithmic height (damping ×${Math.round(S.mA)})`, 80, 300);
        Ink.curve(g, xs, xs.map(x => Math.max(Math.exp(-x * x), 1e-7)), mx, my, { w: 1, c: TK.pencil, dash: [3, 3] });
        Ink.curve(g, xs, V, mx, my, { w: 1.7 });
        Ink.ruler(g, 80, 940, 566, { map: mx, ticks: [-4, -2, 0, 2, 4].map(v => ({ v, s: String(v) })), label: 'x = Δv / b' });
      },
    },
  },
  foot: 'natural line magnified (SCI-REP-004) · the damped-oscillator analogue is in the microscope only (SCI-NAT-001)',
};
