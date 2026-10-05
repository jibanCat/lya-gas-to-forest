/* Beat 2 · One atom meets one colour. Photons of five colours cross; the one the moving atom sees at Lyα is scattered
 * out of the beam (SCI-ATOM-001/002, SCI-RES-001). The resonance window is drawn ~500× wider than natural (SCI-REP-004).
 * The reader pushes the atom's motion along the beam (its arrow, or the atom itself; INT-ATOMV-001 — the shared push law of
 * primitives/motion.js, at this beat's scale); the speed ruler is a reading. */
import { TK } from '../design/tokens.js';
import { Ink } from '../design/ink.js';
import { clamp, scl } from '../core/util.js';
import { App, motionOK } from '../core/app.js';
import { learned } from '../core/runtime.js';
import { hintUsed } from '../primitives/affordance.js';
import { motionLaw, pushStart, pushTo } from '../primitives/motion.js';
import { P } from '../physics/lya.js';
import { SC, sigmaLOS } from '../data/scene-data.js';
import { wave } from '../primitives/atoms.js';

const LANES = [-30, -15, 0, 15, 30];          // photon colours as Δv (km/s) from Lyα in the parcel's frame
const RES_HW = 3.0;                           // drawn resonance half-width (km/s), ×500 the natural γ (SCI-REP-004)
const B2 = { xAtom: 330, yB: 330 };
let LAW2 = { px: 2.2, domain: [-40, 40], key: 1 };   // the push law at this beat's scale (INT-ATOMV-001), read at init
function resP(d) { return 1 / (1 + (d / RES_HW) ** 2); }
function drawPhotonLane(g, xQ, xObs, y, xAtom, dv, t, hit, k) {
  const col = dv < -5 ? TK.tintBlue : dv > 5 ? TK.tintRed : TK.ink, L = xQ - xObs, speed = 70, period = 120, tt = motionOK() ? t : 1.3;
  for (let n = 0; n < 6; n++) {
    const x = xQ - ((tt * speed + n * period + k * 23) % (L + 60));
    if (x < xObs - 20) continue;
    if (hit && xAtom != null && x < xAtom) {   // scattered: leaves the beam in a random direction after reaching the atom
      const d = xAtom - x, ang = [-2.2, 2.0, -1.2, 1.3, -2.6, 2.5][n % 6], sx = xAtom + d * Math.cos(ang), sy = y + d * Math.sin(ang);
      if (d < 220) wave(g, sx, sy, ang, TK.accent, 1 - d / 220);
      continue;
    }
    wave(g, x, y, 0, col, 1);
  }
  Ink.seg(g, xObs, y, xQ, y, { w: 0.5, c: TK.faint, dash: [2, 5] });
}
function atomFramePanel(g, x0, x1, yB, ticks, sub = 'ticks: the five colours, shifted by the atom’s motion') {
  const mv = scl(-45, 45, x0, x1), vs = P.linspace(-45, 45, 361);
  Ink.label(g, 'in the atom’s own frame: where each photon colour sits', x0, yB - 250);
  Ink.mono(g, sub, x0, yB - 236, { size: 9.5 });
  Ink.fillUnder(g, vs, vs.map(resP), mv, p => yB - 190 * p, yB, { c: TK.wash, a: 0.25 });
  Ink.curve(g, vs, vs.map(resP), mv, p => yB - 190 * p, { w: 1.2, c: TK.ink });
  Ink.note(g, 'Lyα resonance', mv(4), yB - 196, { size: 13.5 });
  for (const tk of ticks) { if (tk.d < -45 || tk.d > 45) continue; Ink.seg(g, mv(tk.d), yB - 2, mv(tk.d), yB - 22, { w: tk.hit ? 2.2 : 1, c: tk.hit ? TK.accent : TK.graphite }); if (tk.label != null) Ink.mono(g, `${tk.label > 0 ? '+' : ''}${tk.label}`, mv(tk.d), yB - 28, { align: 'center', size: 9.5, c: tk.hit ? TK.accent : TK.muted }); }
  Ink.ruler(g, x0, x1, yB, { map: mv, ticks: [-40, -20, 0, 20, 40].map(v => ({ v, s: String(v) })), label: 'colour as seen by the atom  [Δv, km/s]' });
}

export const sceneResonance = {
  n: 2,
  slug: 'atom-meets-colour',
  keys: 'Left and right arrows change the atom’s speed along the beam.',
  persist: ['v', 'mode'],
  controls: [
    { type: 'choice', key: 'mode', role: 'view', why: 'a choice between two ways of looking (one atom and five colours, or one colour and many atoms), not a physical state', label: 'view', options: [{ v: 'one', s: 'one atom, five colours' }, { v: 'many', s: 'one colour, many atoms' }] },
    { type: 'ruler', key: 'v', label: 'atom’s speed along the beam', readout: true, operable: () => hintUsed('b2.push') || App.adv, title: 'a reading — push the atom: drag its motion', titleOperable: 'a reading; drag it for a precise value', min: -40, max: 40, step: 1, fmt: v => `${v > 0 ? '+' : ''}${v} km/s`, ticks: [{ v: -30, s: '−30' }, { v: 0, s: '0' }, { v: 30, s: '+30' }], show: S => S.mode === 'one' },
  ],
  tour: [
    { say: S => `one atom moving ${S.v > 0 ? '+' : ''}${Math.round(S.v)} km/s along the beam: only the colour that is Lyα in its own frame is scattered` },
    { say: 'at rest, it scatters Lyα itself — 1215.67 Å in its own frame', int: 'INT-ATOMV-001', to: { v: 0 } },
    { say: 'moving toward us, it is in resonance with a different colour: the Doppler shift', int: 'INT-ATOMV-001', to: { v: -30 } },
    { say: 'one colour, many atoms: only the atoms moving at the right speed respond', do: (S, H) => H.choose('mode', 'many') },
  ],
  init(S) { LAW2 = motionLaw(2, 'INT-ATOMV-001'); S.v = 15; S.mode = 'one'; },
  draw(g, S, t) {
    const { yB, xAtom } = B2, xObs = 40, xQ = 600;
    Ink.note(g, '← toward us', xObs, yB - 120, { size: 13.5 }); Ink.note(g, 'from the quasar', xQ, yB - 120, { size: 13.5, align: 'right' });
    if (S.mode === 'one') {
      g.save(); g.fillStyle = TK.wash; g.globalAlpha = 0.12; g.fillRect(xAtom - 9, yB - 96, 18, 192); g.restore();   // the atom sits in the one beam: every colour row passes through it
      Ink.blob(g, xAtom, yB, 26, { c: TK.ink, a: 0.18 }); Ink.dot(g, xAtom, yB, 6, { c: TK.ink });
      if (Math.abs(S.v) > 0.5) Ink.arrow(g, xAtom, yB + 22, xAtom + S.v * LAW2.px, yB + 22, { w: 1.3, c: TK.accent, head: 5 });
      Ink.mono(g, `${S.v > 0 ? '+' : S.v < 0 ? '−' : ''}${Math.abs(S.v)} km/s ${S.v > 0 ? '(moving away from us)' : S.v < 0 ? '(moving toward us)' : ''}`, xAtom, yB - 98, { align: 'center', size: 10.5, c: TK.ink });   // at the head of the atom's band, in ink, outside the rows: the speed is the atom's, not a colour's (cinnabar marks the resonant colour)
      LANES.forEach((dv, k) => {
        const y = yB - 80 + k * 40, hit = resP(dv - S.v) > 0.5;
        drawPhotonLane(g, xQ, xObs, y, xAtom, dv, t, hit, k);
        Ink.mono(g, `${dv > 0 ? '+' : dv < 0 ? '−' : ' '}${Math.abs(dv)}`, xQ + 14, y + 3.5, { size: 10.5, c: hit ? TK.accent : TK.muted });
      });
      Ink.label(g, 'colours, as Δv from Lyα [km/s] (+ = redder)', xQ + 14, yB - 108);
      Ink.mono(g, 'one beam — its colours drawn apart for clarity; the atom (the grey band) meets them all', xObs, yB + 112, { size: 10, c: TK.muted });
      atomFramePanel(g, 650, 1030, 560, LANES.map(dv => ({ d: dv - S.v, hit: resP(dv - S.v) > 0.5, label: dv })));
    } else {
      const dv = 15, s = sigmaLOS(1.2e4), atoms = SC.atoms.slice(0, 22).map((a, k) => ({ v: a.gx * s, y: yB - 150 + k * 14 }));
      drawPhotonLane(g, xQ, xObs, yB - 175, null, dv, t, false, 0);
      atoms.forEach((a, k) => {
        const P0 = resP(dv - a.v), x = xAtom + ((k * 37) % 120) - 60;
        Ink.dot(g, x, a.y, 3.4, { c: P0 > 0.25 ? TK.accent : TK.ink, a: 0.3 + 0.7 * Math.max(P0, 0.15) });   // red, fading with the match: the closer, the stronger
        Ink.arrow(g, x, a.y, x + a.v * 1.8, a.y, { w: 0.8, c: P0 > 0.25 ? TK.accent : TK.graphite, head: 3, a: 0.8 });
      });
      Ink.note(g, 'which atoms bring this colour (+15 km/s) into resonance in their frame?', 40, yB + 190, { size: 15.5, c: TK.ink });
      Ink.note(g, 'red: atoms moving away from us at close to +15 km/s; the closer the match, the stronger the response', 40, yB + 214, { size: 13.5 });
      atomFramePanel(g, 650, 1030, 560, atoms.map(a => ({ d: dv - a.v, hit: resP(dv - a.v) > 0.25 })), 'ticks: this one colour, as each atom sees it');
    }
  },
  affordances(S) {   // push the atom: its arrow (or the atom itself) — the tip stays under the hand
    if (S.mode !== 'one') return [];
    const { xAtom, yB } = B2, tip = xAtom + S.v * LAW2.px;
    return [{ id: 'atom', kind: 'grab', int: 'INT-ATOMV-001', at: [tip, yB + 22], hit: { rect: [Math.min(xAtom - 26, tip) - 10, yB - 28, Math.max(xAtom + 26, tip) + 10, yB + 34] }, hint: { key: 'b2.push', text: 'push the atom: drag its motion', at: [xAtom + 40, yB + 124], align: 'left' } }];
  },
  kbTarget: () => 'atom',
  onPointer(type, p, S) {
    if (!p || S.mode !== 'one') return;
    if (type === 'down' && p.aff === 'atom') { S._push = pushStart(S.v, p); return; }
    if (type === 'drag' && S._push) { S.v = pushTo(S._push, p, LAW2); return; }
    if (type === 'up') S._push = null;
  },
  onKey(k, S) { if (S.mode === 'one' && (k === 'ArrowRight' || k === 'ArrowLeft')) { S.v = clamp(S.v + (k === 'ArrowRight' ? LAW2.key : -LAW2.key), LAW2.domain[0], LAW2.domain[1]); learned('b2.push'); return true; } return false; },
  describe(S) { if (S.mode !== 'one') return 'One colour, +15 km/s from Lyα, meets many atoms moving at different speeds: the atoms moving away from us at close to 15 km/s bring it into resonance and scatter it; the others barely respond.'; const hit = LANES.filter(dv => resP(dv - S.v) > 0.5); const near = LANES.map(dv => [dv, resP(dv - S.v)]).sort((p, q) => q[1] - p[1])[0], sg = v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v);
    return `One atom on the quasar's beam, moving ${sg(S.v)} km/s along it (+ = away from us); five colours of the beam pass it. ${hit.length ? `The colour at ${sg(hit[0])} km/s from Lyα is in resonance in the atom's frame and is scattered out of the beam.` : `No colour is at the resonance peak; the nearest, ${sg(near[0])} km/s, sits on its flank and is barely scattered.`}`; },
  foot: 'resonance window drawn ~500× wider than its true width (SCI-REP-004)',
};
