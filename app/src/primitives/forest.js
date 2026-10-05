/* The whole sightline as a forest (Beats 11–12): distance and velocity rulers across the box, the observed-wavelength
 * ruler (SCI-MAP-004), and "who ate this colour?" — each cell's share of the optical depth at one colour. */
import { Ink } from '../design/ink.js';
import { P } from '../physics/lya.js';
import { SC } from '../data/scene-data.js';
import { META } from '../core/meta.js';

export const FX = { x0: 90, x1: 1040 };
export function fmx(x) { return FX.x0 + x / SC.L * (FX.x1 - FX.x0); }
export function fmu(u) { return fmx(u / SC.HUB); }
export function lamTicks(g, y) {
  const z0 = SC.z, lam = u => P.lambdaObs(u, z0), uOf = l => P.C.c_kms * Math.log(l / (P.C.lambda_A * (1 + z0)));
  const l0 = Math.ceil(lam(0) / 5) * 5, ticks = []; for (let l = l0; l < lam(SC.period); l += 5) ticks.push({ v: uOf(l), s: String(l) });
  Ink.ruler(g, FX.x0, FX.x1, y, { map: fmu, ticks, label: 'observed wavelength  [Å]  (z ≈ 3)' });
}
/** the inverse lookup's display thresholds (design/canonical/BEATS.yaml, VT-INV-TRACE) — defined once, validated by VAL-INV-001 */
export function invTh() { return META(12).visual_transforms.find(t => t.id === 'VT-INV-TRACE').thresholds; }
/** contributions to τ at velocity u (lyaphys tauContributions: they sum to the spectrum's τ, VAL-INV-001), grouped by
 * contiguity along the (periodic) line into regions with their shares of the total (SCI-TAU-003). Cells under
 * cell_min_fraction are not grouped or drawn; their τ is in tot (the ledger's "rest"). */
export function provenanceAt(u, cells = SC.cells) {
  const th = invTh(), parts = P.tauContributions(u, cells, { period: SC.period, cut: SC.tauCut }).map(p => ({ c: p.cell, t: p.tau }));
  const tot = parts.reduce((s, p) => s + p.t, 0), keep = parts.filter(p => p.t > th.cell_min_fraction * tot), groups = [];
  const ref = keep.reduce((a, p) => p.t > a.t ? p : a, keep[0] || { c: { x: 0 } }).c.x, L = SC.L;
  const wx = x => { let d = x - ref; d -= L * Math.round(d / L); return ref + d; };
  keep.sort((a, b) => wx(a.c.x) - wx(b.c.x));
  for (const p of keep) { const x = wx(p.c.x), last = groups[groups.length - 1]; if (last && x - last.x1 < th.group_gap_mpch) { last.cells.push(p); last.x1 = x; last.t += p.t; } else groups.push({ cells: [p], x0: x, x1: x, t: p.t }); }
  for (const gr of groups) { gr.share = gr.t / tot; gr.xc = ((gr.cells.reduce((s, p) => s + wx(p.c.x) * p.t, 0) / gr.t) % L + L) % L; }
  return { tot, parts: keep, groups: groups.sort((a, b) => b.t - a.t) };
}
