/* Beat 8 · From parcels back to a continuous sightline. The same stretch re-cut into 3 parcels … 225 cells; τ converges
 * to the full sampling (SCI-TAU-002/004/005, SCI-SIM-001, SCI-REP-002/003). */
import { TK } from '../design/tokens.js';
import { Ink } from '../design/ink.js';
import { clamp, rgba } from '../core/util.js';
import { metaEqs } from '../core/meta.js';
import { P } from '../physics/lya.js';
import { SC, tauParcel } from '../data/scene-data.js';
import { drawSlab } from '../primitives/slab.js';
import { WX, wmx, wmu, UG_W, contextStrip, xRuler, uRuler, inkTrail, binCells, windowFull, maxDF } from '../primitives/sightline.js';

const NCELLS = [3, 6, 12, 24, 48, 96, 225];
const b8full = () => windowFull();   // primitives/sightline.js: one definition for Beats 8 and 9

export const sceneCells = {
  n: 8,
  slug: 'parcels-to-continuum',
  keys: 'Left and right arrows cut the stretch coarser or finer.',
  eqs: () => metaEqs(8),
  persist: ['nc'],
  controls: [{ type: 'choice', key: 'nc', role: 'representation', why: 'how finely the stretch is described (sampling), not a physical state of the gas', label: 'cut the stretch into', options: NCELLS.map(n => ({ v: n, s: n === 3 ? '3 parcels' : n === 225 ? 'full sampling' : String(n) })) }],
  tour: [
    { say: 'three parcels: a teaching summary of the stretch' },
    { say: 'cut finer: twelve cells, each mapped by the same rule', do: (S, H) => H.choose('nc', 12) },
    { say: 'tens of cells: the optical depth approaches the full calculation (dashed)', do: (S, H) => H.choose('nc', 48) },
    { say: 'the full sampling: it converges on the full calculation', do: (S, H) => H.choose('nc', 225) },
  ],
  init(S) { S.nc = 3; },
  draw(g, S) {
    drawSlab(g, [120, 6, 800, 150], { tilt: 0.55, focus: true, fade: 0.55, windowX: [SC.win.x0, SC.win.x0 + SC.win.span], quasar: false, observer: false });
    Ink.mono(g, 'the stretch, on the beam', 640, 22, { size: 10, c: TK.accent });
    const yR = 250, yV = 420, ug = UG_W(), n = S.nc, cells = binCells(n);
    Ink.label(g, 'real space', WX.x0 - 70, yR + 4);
    if (!cells) { for (const p of SC.parcels) Ink.smudge(g, wmx(p.x), yR, wmx(p.sx) - wmx(0), 13, { c: TK.ink, a: 0.6 }); }
    else if (n < 225) { const maxN = Math.max(...cells.map(c => c.N)); for (const c of cells) { const tn = clamp((Math.log10(c.N / maxN) + 2) / 2, 0.03, 1); g.save(); g.fillStyle = rgba(TK.ink, 0.85 * tn); g.fillRect(wmx(c.xlo), yR - 13, wmx(c.xhi) - wmx(c.xlo), 26); g.restore(); Ink.seg(g, wmx(c.xlo), yR - 16, wmx(c.xlo), yR + 16, { w: 0.6, c: TK.graphite, a: 0.7 }); } }
    else contextStrip(g, yR, 13, 1);
    xRuler(g, yR + 24);
    const src = cells || SC.parcels.map(p => ({ x: p.x, u: SC.HUB * p.x + p.v, N: p.N }));
    if (src.length <= 48) { const maxN = Math.max(...src.map(c => c.N)); for (const c of src) inkTrail(g, wmx(c.x), yR + 18, wmu(c.u), yV - 4, 1, { c: TK.ink, a: 0.15 + 0.6 * Math.sqrt(c.N / maxN) }); }
    Ink.label(g, 'velocity space', WX.x0 - 70, yV + 4); Ink.seg(g, wmx(-0.4), yV, wmx(4.8), yV, { w: 0.6, c: TK.faint });
    const full = b8full();
    const cur = cells ? P.tauFromCells(ug, cells.map(c => ({ u: c.u, N: c.N, b: c.b })), { profile: 'gauss' }) : (() => { const tt = new Float64Array(ug.length); for (const p of SC.parcels) { const tp = tauParcel(ug, p, { profile: 'gauss' }); for (let i = 0; i < ug.length; i++) tt[i] += tp[i]; } return tt; })();
    const tmax = Math.max(...full, ...cur) * 1.05, yT = 700, my = v => yT - v / tmax * 220;
    Ink.curve(g, ug, Array.from(full), wmu, my, { w: 1.2, c: TK.pencil, dash: [4, 3] });
    Ink.fillUnder(g, ug, Array.from(cur), wmu, my, yT, { c: TK.wash, a: 0.25 }); Ink.curve(g, ug, Array.from(cur), wmu, my, { w: 1.6 });
    Ink.label(g, 'optical depth: this decomposition (ink) · full sampling (dashed) — up is more', WX.x0, yT - 236);
    const md = maxDF(cur, full);
    S._md = md;
    if (cells && n <= 24) { const du = SC.HUB * SC.win.span / n, bmin = Math.min(...cells.map(c => c.b)); if (du > bmin / 2) Ink.mono(g, `under-resolved: each cell spans ${du.toFixed(0)} km/s, ${(du / (bmin / 2)).toFixed(0)}× the limit (half the narrowest line’s width, ≈ ${(bmin / 2).toFixed(0)} km/s) — it can do worse than the three parcels`, WX.x1, yT - 222, { align: 'right', size: 10, c: TK.graphite }); }   // why a coarse cut is not yet better (aH·Δx ≤ b/2)
    Ink.mono(g, `largest difference in transmitted flux: ${md.toFixed(3)}`, WX.x1, yT - 236, { align: 'right', size: 10.5, c: TK.ink });
    uRuler(g, yT + 6);
  },
  onKey(k, S) { if (k === 'ArrowRight' || k === 'ArrowLeft') { const i = NCELLS.indexOf(S.nc); S.nc = NCELLS[clamp(i + (k === 'ArrowRight' ? 1 : -1), 0, NCELLS.length - 1)]; return true; } return false; },
  describe(S) { return `The same 4.4 Mpc/h stretch, cut into ${S.nc === 3 ? 'the three teaching parcels' : S.nc === 225 ? 'its full sampling' : S.nc + ' cells'}; each piece maps to where it lands, places its optical depth there and broadens it. Against the full sampling, the largest difference in transmitted flux is ${(S._md ?? 0).toFixed(3)}.`; },
  foot: 'the three parcels were a teaching decomposition; cells are the toy sightline re-binned (SCI-REP-003, SCI-TAU-005)',
};
