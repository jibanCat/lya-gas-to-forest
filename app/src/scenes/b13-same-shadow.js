/* Beat 13 · Same shadow. Three gases, one recorded line at S/N 20: predict, reveal, break the tie with a heavier ion or
 * Lyβ (SCI-DEG-001/002). The configurations come from their single source (science/validation/degeneracy/configs.json). */
import { TK } from '../design/tokens.js';
import { Ink } from '../design/ink.js';
import { scl, clamp } from '../core/util.js';
import { metaEqs } from '../core/meta.js';
import { learned } from '../core/runtime.js';
import { P } from '../physics/lya.js';
import { SC } from '../data/scene-data.js';

const CFG_TEXT = { i: { name: 'one hot cloud', words: 'T = 45 000 K — unusually hot — at rest' }, ii: { name: 'two cold clouds', words: 'T = 10 000 K each (typical), approaching' }, iii: { name: 'one cold cloud, expanding', words: 'T = 10 000 K (typical), expanding along the line' } };
let _b13 = null;
function b13cfgs() {
  if (_b13) return _b13;
  const C = SC.configs, toReal = p => ({ x: p.u / SC.HUB, sx: p.su / SC.HUB, N: p.N, T: p.T, v: p.v, dvdx: p.dv / (p.su / SC.HUB) });
  return (_b13 = ['i', 'ii', 'iii'].map(k => ({ k, ...CFG_TEXT[k], parts: C.configs[k].map(toReal) })));
}
let _b13ug = null;
function b13ug() { const C = SC.configs; return _b13ug || (_b13ug = P.linspace(C.u_range_kms[0], C.u_range_kms[1], C.npix)); }
function b13tau(cfg, { mass = P.C.m_H, sigmaScale = 1 } = {}) {
  const ug = b13ug(), tau = new Float64Array(ug.length);
  for (const p of cfg.parts) { const cells = P.parcelToCells(p, SC.HUB, { mass }).map(c => ({ ...c, N: c.N * sigmaScale })), t = P.tauFromCells(ug, cells, { profile: 'voigt' }); for (let i = 0; i < t.length; i++) tau[i] += t[i]; }
  return tau;
}
let _b13F = null;
function b13F() { return _b13F || (_b13F = b13cfgs().map(c => Array.from(b13tau(c), v => Math.exp(-v)))); }

export const sceneSameShadow = {
  n: 13,
  slug: 'same-shadow',
  keys: 'Keys 1, 2, 3 choose a gas.',
  eqs: () => metaEqs(13),
  persist: ['phase', 'pick', 'metal', 'lyb'],
  controls: [
    { type: 'choice', key: 'phase', role: 'step', why: 'a chain of reasoning (predict, reveal, break the tie), not a physical state', label: 'step', options: [{ v: 'predict', s: '1 · predict' }, { v: 'reveal', s: '2 · reveal' }, { v: 'break', s: '3 · break the tie' }] },
    { type: 'toggle', key: 'metal', role: 'instrument', why: 'which lines the observation includes: information added, not a change to the gas', label: 'add a heavier ion’s line (silicon, Si IV)', show: S => S.phase === 'break' },
    { type: 'toggle', key: 'lyb', role: 'instrument', why: 'which lines the observation includes: information added, not a change to the gas', label: 'add Lyman-β', show: S => S.phase === 'break' },
  ],
  init(S) { S.phase = 'predict'; S.pick = ''; S.metal = false; S.lyb = false; },
  draw(g, S) {
    const snr = 20, sig = 1 / snr, ug = b13ug(), Fs = b13F(), data = P.addNoise(Fs[0], snr, 12);
    b13cfgs().forEach((c, k) => {
      const x0 = 90 + k * 330, y = 110, mx = scl(-0.8, 0.8, x0, x0 + 280), picked = S.pick === c.k;
      Ink.text(g, `${c.k} · ${c.name}`, x0, y - 50, { f: 'serif', size: 16.5, c: picked && S.phase === 'predict' ? TK.accent : TK.ink });   // after the prediction, red means (i) only
      Ink.note(g, c.words, x0, y - 30, { size: 13 });
      Ink.seg(g, x0, y, x0 + 280, y, { w: 0.6, c: TK.faint });
      for (const p of c.parts) { Ink.smudge(g, mx(p.x), y, Math.max(3, mx(p.sx) - mx(0)), 11, { c: picked && S.phase === 'predict' ? TK.accent : TK.ink, a: 0.6 }); if (p.v) Ink.arrow(g, mx(p.x), y - 20, mx(p.x) + p.v * 1.2, y - 20, { w: 1.1, c: TK.graphite, head: 4 }); if (p.dvdx) { Ink.arrow(g, mx(p.x) - 6, y - 20, mx(p.x) - 30, y - 20, { w: 1, c: TK.graphite, head: 4 }); Ink.arrow(g, mx(p.x) + 6, y - 20, mx(p.x) + 30, y - 20, { w: 1, c: TK.graphite, head: 4 }); } if (p.T > 2e4) { [[-32, -18, 13], [-14, -12, -12], [-24, -5, 10], [24, -18, 12], [8, -12, -12], [20, -5, -10]].forEach(([dx, dy, L]) => { const ax = mx(p.x) + dx, ay = y + dy; Ink.arrow(g, ax, ay, ax + L, ay, { w: 0.8, c: picked ? TK.accent : TK.graphite, head: 3 }); }); Ink.mono(g, 'random thermal motions', mx(p.x) + 44, y - 10, { size: 9.5, c: TK.muted }); } }   // heat: random motions along the beam, both ways, on the gas itself (a smudge, as (ii) and (iii)) — not an outward burst
      if (picked) Ink.mono(g, '● your choice', x0, y + 30, { size: 10.5, c: S.phase === 'predict' ? TK.accent : TK.muted });
    });
    { const p = b13cfgs()[0].parts[0], kpc = p.sx / SC.cosmo.h / (1 + SC.z) * 1000;   // (i)'s size, proper, from its configuration
      Ink.mono(g, `each “cloud” is a denser part of the continuous gas, idealised as one smooth clump; (i) is a constructed example — unusually hot, and compact (≈ ${kpc.toFixed(0)} kpc)`, 90, 26, { size: 10, c: TK.muted }); }
    const X0 = 90, X1 = 700, mv = scl(-150, 150, X0, X1), f1 = 250, f0 = 520, mf = f => f0 - f * (f0 - f1);
    Ink.label(g, `the recorded line (signal-to-noise ${snr} per 2.5 km/s pixel)`, X0, f1 - 26);
    Ink.seg(g, X0, mf(1), X1, mf(1), { w: 0.6, c: TK.faint, dash: [2, 4] }); Ink.seg(g, X0, mf(0), X1, mf(0), { w: 0.6, c: TK.hair });
    ug.forEach((u, i) => Ink.dot(g, mv(u), mf(clamp(data[i], -0.06, 1.06)), 2, { c: TK.ink, a: 0.8 }));   // kept off the labels: a point beyond the frame sits on its edge
    if (S.phase !== 'predict') {
      Fs.forEach((F, k) => Ink.curve(g, ug, F, mv, mf, { w: k ? 1.1 : 1.6, c: k ? TK.pencil : TK.accent, dash: k === 2 ? [5, 3] : null }));
      const chi = Fs.map(F => F.reduce((s, f, i) => s + ((f - Fs[0][i]) / sig) ** 2, 0));
      // two kinds of "same shadow" (SCI-DEG-001): (ii) is hidden by the noise (Δχ² grows as (S/N)², computed from the same lines);
      // (iii) by hydrogen itself — heat and smooth motion give one Gaussian in every hydrogen line
      Ink.note(g, 'it was (i) — we built it that way. Two others fit, for different reasons:', X0, 574, { size: 15, c: TK.ink });
      Ink.note(g, `(ii) hides in the noise: its extra misfit Δχ² is ${chi[1].toFixed(1)} here, but ${(chi[1] * (50 / snr) ** 2).toFixed(0)} at signal-to-noise 50.`, X0, 596, { size: 15, c: TK.ink });
      Ink.note(g, '(iii) hides in hydrogen itself: heat and smooth motion widen every hydrogen line alike —', X0, 618, { size: 15, c: TK.ink });
      Ink.note(g, 'so no hydrogen line, at any signal-to-noise, can tell them apart.', X0, 640, { size: 15, c: TK.ink });
      if (S.pick === 'ii') Ink.note(g, 'your (ii) is not ruled out at this noise', X0, 666, { size: 14, c: TK.accent });
      if (S.pick === 'iii') Ink.note(g, 'your (iii) is not wrong — in hydrogen, heat and smooth motion look alike', X0, 666, { size: 14, c: TK.accent });
      if (S.pick === 'i') Ink.note(g, 'right — but only by luck: the shadow alone could not have told you', X0, 666, { size: 14, c: TK.accent });
    }
    Ink.ruler(g, X0, X1, f0 + 6, { map: mv, ticks: [-100, -50, 0, 50, 100].map(v => ({ v, s: String(v) })), label: 'Δv [km/s]' });
    if (S.phase === 'break') {
      const panels = [];
      if (S.metal) panels.push({ name: 'Si IV 1394 — if the gas holds silicon, in the same gas', more: '(illustrative column; mass ≈ 28 m_H)', note: ['heat broadens light atoms more than heavy ions;', 'bulk motion — the gas’s own, and the expansion', 'across each cloud — broadens all alike: so the', 'hot gas (i) has the narrowest Si IV line'], taus: b13cfgs().map(c => b13tau(c, { mass: 28 * P.C.m_H, sigmaScale: 0.03 })) });
      if (S.lyb) { const r = P.C.lyb_f * P.C.lyb_lambda_A / (P.C.f * P.C.lambda_A); panels.push({ name: 'Lyman-β (1026 Å): hydrogen’s next, weaker line', more: `(${(1 / r).toFixed(2)}× weaker, so it does not saturate flat: f λ)`, taus: b13cfgs().map(c => b13tau(c, { sigmaScale: r })) }); }
      panels.forEach((pn, j) => {
        const Y0 = 270 + j * 250 + (j && panels[0].note ? 40 : 0), Y1 = Y0 + 170, mfb = f => Y1 - f * (Y1 - Y0), mvb = scl(-150, 150, 760, 1050);
        Ink.label(g, pn.name, 760, Y0 - (pn.more ? 32 : 20)); if (pn.more) Ink.mono(g, pn.more, 760, Y0 - 17, { size: 9.5 });
        if (pn.note) pn.note.forEach((l, i) => Ink.note(g, l, 760, Y0 + 128 + 16 * i, { size: 13.5, c: TK.ink }));   // why the hot gas's line is the narrowest: inside its own panel, under its curves
        pn.taus.forEach((tt, k) => Ink.curve(g, ug, Array.from(tt, v => Math.exp(-v)), mvb, mfb, { w: k ? 1.1 : 1.6, c: k ? TK.pencil : TK.accent, dash: k === 2 ? [5, 3] : null }));
        Ink.seg(g, 760, mfb(1), 1050, mfb(1), { w: 0.6, c: TK.faint, dash: [2, 4] });
      });
      if (!panels.length) Ink.note(g, '← switch on a second line, in the margin, to break the tie', 760, 300, { size: 15 });
      Ink.mono(g, 'red (i) hot · grey (ii) blend', 760, 200, { size: 10 }); Ink.mono(g, 'dashed (iii) expanding', 760, 214, { size: 10 });
      if (panels.length) ['The spectrum is a record of the neutral hydrogen along the beam, written in', 'velocity. Reading it back is inference, not decoding: more than one gas can', 'fit; more lines, and many sightlines read with a model, narrow the choice.'].forEach((l, i) => Ink.text(g, l, X0, 700 + 22 * i, { f: 'serif', size: 16.5, c: TK.ink }));   // the ending: Beat 0's question, answered at a higher level
    }
  },
  affordances(S) {   // predicting: choose the gas you think made the shadow (a choice of answer, not a physical state)
    if (S.phase !== 'predict') return [];
    return b13cfgs().map((c, k) => ({ id: 'cfg:' + c.k, kind: 'select', role: 'predict', at: [90 + k * 330 + 140, 110], bracket: [90 + k * 330, 90 + k * 330 + 280, 128], hit: { rect: [90 + k * 330 - 6, 40, 90 + k * 330 + 286, 150] }, hint: k === 1 && !S.pick ? { key: 'b13.pick', text: 'choose the gas you think made this shadow', at: [90 + 330 + 140, 172], align: 'center', noArrow: true } : null }));   // no arrow: a hint must not point at one answer
  },
  onPointer(type, p, S) { if (type === 'down' && p && S.phase === 'predict' && p.aff && p.aff.startsWith('cfg:')) { S.pick = p.aff.slice(4); learned('b13.pick'); } },
  onKey(k, S) { if (['1', '2', '3'].includes(k) && S.phase === 'predict') { S.pick = ['i', 'ii', 'iii'][+k - 1]; return true; } return false; },
  describe(S) {
    if (S.phase === 'predict') return `One recorded line, measured at signal-to-noise 20, and three gases that could have made it: (i) one unusually hot, compact clump at rest; (ii) two cold clouds approaching each other; (iii) one cold cloud expanding along the line. Predict which made it${S.pick ? `; you chose (${S.pick})` : ''}.`;
    const Fs = b13F(), chi = Fs.map(F => F.reduce((s, f, i) => s + ((f - Fs[0][i]) * 20) ** 2, 0));
    const why = `Two others fit, for different reasons. (ii), the blend, hides in the noise: its extra misfit is ${chi[1].toFixed(1)} over ${Fs[0].length} pixels here, but ${(chi[1] * (50 / 20) ** 2).toFixed(0)} at signal-to-noise 50, so better data would show it. (iii) hides in hydrogen itself: heat and smooth motion widen every hydrogen line alike, so no hydrogen line can tell them apart`;
    if (S.phase === 'reveal') return `It was (i) — we built it that way. ${why}.`;
    return `Breaking the tie${S.metal ? '. In Si IV, a heavier ion, heat broadens the line less while bulk motion broadens it as much, so the hot gas (i) has the narrowest line' : ''}${S.lyb ? `. In Lyman-beta, which absorbs more weakly, the blend (ii) stands apart (shallower), while (i) and (iii) stay alike` : ''}${!S.metal && !S.lyb ? ': add a heavier ion’s line or Lyman-beta' : ''}. ${S.metal || S.lyb ? 'The spectrum is a record of the neutral hydrogen along the beam, written in velocity; reading it back is inference, not decoding — more than one gas can fit; more lines, and many sightlines read with a model, narrow the choice.' : ''}`;
  },
  foot: 'the blend (ii) stays hidden at signal-to-noise 20 per 2.5 km/s pixel or worse (here at perfect resolution) — better data reveal it; heat against smooth motion, (i) against (iii), in any hydrogen line (SCI-DEG-001)',
};
