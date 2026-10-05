/* Hold the gas to explore warmer gas: one shared gesture → temperature control law (Beats 3 and 6; INT-TEMP-001, which
 * Beat 6's record reuses — build_provenance.py checks they agree). A pedagogical control law, not physics: holding still
 * explores warmer gas at a steady pace in log T; moving vertically while holding refines either way (down cooler); release
 * keeps the state reached (no cooling physics is invented). Where the same object can also be moved (Beat 6), a horizontal
 * movement before any vertical one turns the hold into a move and returns T to where it was; warming may then begin after a
 * short onset (onset_s), so that a drag never warms the gas on its way. */
import { clamp } from '../core/util.js';
import { interaction } from '../core/meta.js';

/** the control law from the manifest: dex/s held still, dex per px while refining, px before a hold becomes a refinement
 * (or a move), and the onset before warming begins [s] */
export function holdLaw(n, id) {
  const q = (interaction(n, id).gesture || {}).params || {};
  return { rate: q.rate_dex_per_s ?? 0.3, scrub: q.refine_dex_per_px ?? 0.008, deadband: q.deadband_px ?? 6, onset: q.onset_s ?? 0, key: q.key_factor ?? 1.12 };
}
/** a hold begins on the gas at temperature T */
export function holdBegin(T, p, now, { refine = false } = {}) { const l = Math.log10(T); return { t0: now, logT0: l, logT: l, x0: p.x, y0: p.y, lx: p.x, ly: p.y, start: T, refine, move: false }; }
/** the hand moves while holding: 'temp' (a refinement, or still a hold) or 'move' (only when the object can also be moved) */
export function holdDrag(h, p, law, { canMove = false } = {}) {
  if (h.move) return 'move';
  if (!h.refine) {
    if (canMove && Math.abs(p.x - h.x0) > law.deadband && Math.abs(p.x - h.x0) >= Math.abs(p.y - h.y0)) { h.move = true; h.logT = Math.log10(h.start); return 'move'; }   // the hold becomes a move: T returns to where it was
    if (Math.abs(p.y - h.y0) > law.deadband) { h.refine = true; h.logT0 = h.logT; h.y0 = p.y; }   // the hold becomes a refinement
  }
  if (h.refine) h.logT = h.logT0 - (p.y - h.y0) * law.scrub;
  return 'temp';
}
/** the temperature now (rounded to 10 K, inside the domain); held still, it rises at the law's pace after the onset */
export function holdT(h, law, dom, now) {
  if (!h.refine && !h.move) h.logT = h.logT0 + law.rate * Math.max(0, now - h.t0 - law.onset);
  if (h.move || h.logT === Math.log10(h.start)) return h.start;   // a move, or nothing explored yet: T exactly as it was
  return clamp(Math.round(10 ** clamp(h.logT, Math.log10(dom[0]), Math.log10(dom[1])) / 10) * 10, dom[0], dom[1]);
}
/** what the hold did, on release: explored warmer or cooler gas (for learned()) */
export function holdResult(h, T) { return { warmer: !h.move && T > h.start * 1.05, cooler: !h.move && T < h.start / 1.05 }; }
