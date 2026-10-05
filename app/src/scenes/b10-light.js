/* Beat 10 · Light multiplies. The inked ribbon on a light table: composited layer by layer with opacity 1 − e^−τᵢ over a
 * warm backlight, the picture performs Beer–Lambert (SCI-FLUX-001/002, SCI-REP-005). The light that gets through also
 * lights the paper around the ribbon: the halo at each colour is proportional to the transmitted fraction e^−τ there
 * (a dark trough casts no light), and paper fibres show only in that light. The ribbon's own pixels are checked against
 * e^−τ (checks.beerLambert → app/smoke.mjs → VAL-REND-001). Microscope: why a line stops getting deeper. */
import { TK } from '../design/tokens.js';
import { Ink } from '../design/ink.js';
import { clamp, fmtN, hexRGB } from '../core/util.js';
import { metaEqs, interaction } from '../core/meta.js';
import { DPR, learned } from '../core/runtime.js';
import { P } from '../physics/lya.js';
import { SC } from '../data/scene-data.js';
import { WX, wmx, wmu, UG_W, uRuler, windowKernels } from '../primitives/sightline.js';
import { paperFibres } from '../primitives/material.js';

export const B10 = { yRb: 200, hR: 70, pad: 44, fall: 16, halo: 1, blur: 7 };
function b10iP(S) { const ug = UG_W(); return clamp(Math.round((S.pu - ug[0]) / (ug[1] - ug[0])), 0, ug.length - 1); }
/** the window-velocity index under ribbon column xp of W2 */
function b10col(xp, W2) { const ug = UG_W(), rx0 = wmx(-0.3), rx1 = wmx(4.75), u = (rx0 + (xp + 0.5) / W2 * (rx1 - rx0) - WX.x0) / (WX.x1 - WX.x0) * (WX.xb - WX.xa) * SC.HUB + WX.xa * SC.HUB; return clamp(Math.round((u - ug[0]) / (ug[1] - ug[0])), 0, ug.length - 1); }
let _b10ribbon = null, _b10halo = null;
/** the backlit ribbon, composited once (it depends only on the cells): colour ← colour·(1−α) + ink·α, α = 1 − e^−τᵢ, layer by layer */
function b10ribbon(W2) {
  if (_b10ribbon && _b10ribbon.width === W2) return _b10ribbon;
  const { kern } = windowKernels(24), img = new ImageData(W2, 1), ink = hexRGB(TK.pool), light = hexRGB(TK.glow);
  for (let xp = 0; xp < W2; xp++) {
    const i = b10col(xp, W2);
    let col = light.slice(); for (const k of kern) { const a = 1 - Math.exp(-k[i]); col = col.map((c, q) => c * (1 - a) + ink[q] * a); }
    img.data.set([col[0], col[1], col[2], 255], xp * 4);
  }
  const c2 = document.createElement('canvas'); c2.width = W2; c2.height = 1; c2.getContext('2d').putImageData(img, 0, 0);
  return (_b10ribbon = c2);
}
/** light around the ribbon: at each colour ∝ the transmitted fraction e^−τ, falling off with distance from the edge,
 * softened sideways (light diffuses); paper fibres drawn only where this light is */
function b10halo(W, H) {
  const key = `${W}x${H}`; if (_b10halo && _b10halo.key === key) return _b10halo.cv;
  const { tot } = windowKernels(24), { pad, fall, halo, blur } = B10, inner = H - 2 * pad, T = new Float64Array(W + 2 * pad);
  for (let x = 0; x < W + 2 * pad; x++) T[x] = Math.exp(-tot[b10col(clamp(x - pad, 0, W - 1), W)]);   // transmission at the nearest ribbon colour
  const Tb = T.map((_, x) => { let s = 0, n = 0; for (let k = -blur; k <= blur; k++) { const j = x + k; if (j >= 0 && j < T.length) { s += T[j]; n++; } } return s / n; });
  const cv = document.createElement('canvas'); cv.width = W + 2 * pad; cv.height = H; const x = cv.getContext('2d'), im = x.createImageData(cv.width, H), gl = hexRGB(TK.glow);
  for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < cv.width; xx++) {   // distance outside the ribbon's rectangle; none inside it
    const dy = yy < pad ? pad - yy : yy >= pad + inner ? yy - pad - inner + 1 : 0, dx = xx < pad ? pad - xx : xx >= pad + W ? xx - pad - W + 1 : 0, d = Math.hypot(dx, dy);
    const q = (yy * cv.width + xx) * 4; im.data[q] = gl[0]; im.data[q + 1] = gl[1]; im.data[q + 2] = gl[2]; im.data[q + 3] = d > 0 ? 255 * halo * Tb[xx] * Math.exp(-d / fall) : 0;
  }
  x.putImageData(im, 0, 0); x.globalCompositeOperation = 'source-atop'; x.drawImage(paperFibres(cv.width, H, TK.grain), 0, 0);
  _b10halo = { key, cv }; return cv;
}

/** the inspected column held to the light, as a lens view: light from the table enters at the left and crosses the layers
 * in turn; each lets through e^−τᵢ, and the beam after each is composited exactly as the ribbon (light·T + ink·(1 − T),
 * T the product so far) — the light visibly dims, layer by layer, to the flux. Inspection only (INT-INSPECT-001). */
export const B10L = { x0: 130, x1: 740, y: 350, h: 20, top: 300 };
export function b10lightPath(g, kern, iP, tot, xP) {
  const L = kern.map((k, j) => ({ j, t: k[iP] })).filter(l => l.t > 0.01).sort((a, b) => b.t - a.t), show = L.slice(0, 5), rest = L.slice(5).reduce((s, l) => s + l.t, 0);
  if (rest > 0) show.push({ j: -1, t: rest });
  const { x0, x1, y, h, top } = B10L, n = show.length, seg = (x1 - x0) / (n + 1), ink = hexRGB(TK.pool), light = hexRGB(TK.glow);
  const col = T => `rgb(${[0, 1, 2].map(q => Math.round(ink[q] * (1 - T) + light[q] * T)).join(',')})`;
  Ink.label(g, 'held to the light at this colour: each layer lets a fraction through (deepest layers first)', x0, top);
  Ink.seg(g, xP - 9, B10.yRb + B10.hR + 6, x1, y - h / 2 - 4, { w: 0.5, c: TK.pencil, dash: [2, 3] });   // the lens points back at the loupe
  let T = 1;
  g.save(); g.fillStyle = col(1); g.fillRect(x0, y - h / 2, seg, h); g.restore();
  Ink.mono(g, 'light in: 100%', x0, y - h / 2 - 12, { size: 10 });
  show.forEach((l, k) => {
    const xs = x0 + seg * (k + 1), tr = Math.exp(-l.t); T *= tr;
    g.save(); g.fillStyle = col(T); g.fillRect(xs, y - h / 2, seg, h); g.restore();                  // the light after this layer
    g.save(); g.fillStyle = TK.pool; g.globalAlpha = 1 - tr; g.fillRect(xs - 1.5, y - h / 2 - 7, 3, h + 14); g.restore();   // the layer: ink of opacity 1 − e^−τᵢ
    Ink.mono(g, l.j >= 0 ? `cell ${l.j + 1}` : 'others', xs, y + h / 2 + 16, { align: 'center', size: 10, c: TK.ink });
    Ink.mono(g, `τ ${l.t.toFixed(2)}`, xs, y + h / 2 + 29, { align: 'center', size: 9.5 });
    Ink.mono(g, `×${tr.toFixed(2)}`, xs, y + h / 2 + 42, { align: 'center', size: 9.5, c: TK.ink });
  });
  Ink.arrow(g, x0 - 18, y, x0 - 4, y, { w: 0.8, c: TK.graphite, head: 4 }); Ink.arrow(g, x1 + 4, y, x1 + 18, y, { w: 0.8, c: TK.graphite, head: 4 });
  Ink.mono(g, `gets through: ${(T * 100).toFixed(1)}%  =  e^(−${tot.toFixed(2)})`, x1, y - h / 2 - 12, { align: 'right', size: 11.5, c: TK.accent });
  return T;
}

export const sceneLight = {
  n: 10,
  slug: 'light-multiplies',
  keys: 'Left and right arrows move the inspected colour along the ribbon (and the spectrum).',
  eqs: () => metaEqs(10),
  persist: ['pu'],
  init(S) {
    const ug = UG_W(), { tot } = windowKernels(24), uB = SC.HUB * SC.parcels[1].x + SC.parcels[1].v; let best = null;
    ug.forEach((u, i) => { if (tot[i] > 0.9 && tot[i] < 1.8) { const d = Math.abs(u - uB); if (!best || d < best.d) best = { u, d }; } });
    S.pu = best ? best.u : uB;
  },
  draw(g, S) {
    const ug = UG_W(), { kern, tot } = windowKernels(24), { yRb, hR } = B10, rx0 = wmx(-0.3), rx1 = wmx(4.75);
    const px = Math.round(rx1 - rx0), pad = B10.pad;
    g.save(); g.drawImage(b10halo(px, hR + 2 * pad), rx0 - pad, yRb - pad); g.restore();   // the light that gets through, on the paper around the ribbon
    g.save(); g.imageSmoothingEnabled = true; g.drawImage(b10ribbon(Math.round(px * DPR)), rx0, yRb, px, hR); g.restore();
    Ink.label(g, 'the inked ribbon (velocity space), backlit', rx0, yRb - 36);
    const iP = b10iP(S), xP = wmu(S.pu);
    Ink.seg(g, xP, yRb + hR + 4, xP, 690, { w: 1, c: TK.accent, dash: [2, 3] });
    Ink.line(g, [[xP - 9, yRb - 6], [xP + 9, yRb - 6], [xP + 9, yRb + hR + 6], [xP - 9, yRb + hR + 6], [xP - 9, yRb - 6]], { w: 0.8, c: TK.accent });   // the inspected part of the sheet
    b10lightPath(g, kern, iP, tot[iP], xP);
    const f1 = 470, f0 = 690, mf = f => f0 - f * (f0 - f1), F = Array.from(tot, v => Math.exp(-v));
    Ink.fillUnder(g, ug, F, wmu, mf, mf(1), { c: TK.wash, a: 0.18 }); Ink.curve(g, ug, F, wmu, mf, { w: 1.7 });
    Ink.seg(g, wmx(-0.4), mf(1), wmx(4.8), mf(1), { w: 0.6, c: TK.faint, dash: [2, 4] }); Ink.mono(g, '1', WX.x0 - 10, mf(1) + 3, { align: 'right' }); Ink.mono(g, '0', WX.x0 - 10, mf(0) + 3, { align: 'right' });
    Ink.dot(g, xP, mf(F[iP]), 4, { c: TK.accent });
    Ink.label(g, 'the light that gets through: the spectrum — down is less light', WX.x0, f1 - 16);
    uRuler(g, f0 + 6);
    Ink.text(g, 'Light multiplies.', 760, 150, { f: 'serif', size: 30, c: TK.accent });
  },
  affordances(S) {   // the loupe on the ribbon; the ribbon and the flux are both handles (each points at the other)
    const xP = wmu(S.pu), rx0 = wmx(-0.3), rx1 = wmx(4.75);
    return [{ id: 'loupe', kind: 'grab', int: 'INT-INSPECT-001', at: [xP, B10.yRb - 12], hit: { rect: [rx0, B10.yRb - 22, rx1, B10.yRb + B10.hR + 12] }, hint: { key: 'b10.loupe', text: 'hold another part of the sheet to the light', at: [xP + (xP > 600 ? -30 : 30), B10.yRb - 20], align: xP > 600 ? 'right' : 'left' } },
      { id: 'flux', name: 'the flux (the colour held)', kind: 'scan', int: 'INT-INSPECT-001', at: [xP, 700], hit: { rect: [rx0, 450, rx1, 702] } }];
  },
  kbTarget: () => 'loupe',
  onPointer(type, p, S) {
    if (p && (type === 'move' || type === 'drag' || type === 'down') && (p.aff === 'loupe' || p.aff === 'flux')) {
      const u = clamp((p.x - WX.x0) / (WX.x1 - WX.x0) * (WX.xb - WX.xa) * SC.HUB + WX.xa * SC.HUB, SC.HUB * -0.3, SC.HUB * 4.75);
      S._u0 = S._u0 ?? S.pu; if (Math.abs(wmu(u) - wmu(S._u0)) > (((interaction(10, 'INT-INSPECT-001').gesture || {}).params || {}).learned_px ?? 30)) learned('b10.loupe');   // moving the loupe (by hover, drag or touch) is the gesture
      S.pu = u;
    }
  },
  onKey(k, S) { if (k === 'ArrowRight' || k === 'ArrowLeft') { S.pu = clamp(S.pu + (k === 'ArrowRight' ? 4 : -4), SC.HUB * -0.3, SC.HUB * 4.75); return true; } return false; },
  describe(S) { const { tot } = windowKernels(24), i = b10iP(S); return `The 24 inked layers on a light table, backlit: each lets through e to the minus its optical depth, so the fractions multiply. At ${S.pu.toFixed(0)} km/s the optical depths add to ${tot[i].toFixed(2)}, so ${(Math.exp(-tot[i]) * 100).toFixed(0)}% of the light gets through.`; },
  micro: {
    saturation: {
      ask: 'why does a line stop getting deeper?', title: 'Same shape in τ, a different look in F',
      text: 'Multiply the hydrogen by 100 at a time. In optical depth the line keeps exactly the same shape — the whole curve rises.\nThe light only cares where τ passes 1: first a dip, then a saturated trough that barely widens, then — once even the faint lifetime wings pass τ = 1 — damping wings.',
      controls: [{ type: 'ruler', key: 'mlogN', label: 'neutral hydrogen column', min: 12, max: 21, step: 0.1, fmt: v => fmtN(10 ** v), ticks: [13, 15, 17, 19, 21].map(v => ({ v, s: '10' + String(v).replace(/\d/g, d => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d]) })) }],
      init(S) { S.mlogN = S.mlogN ?? 15; },
      eqs: () => [{ tex: '\\tau(\\Delta v) = \\tau_0\\,H(a, \\Delta v/b)', note: 'shape fixed; amplitude ∝ N', ids: ['SCI-TAU-001', 'SCI-VOIGT-001'] }, { tex: '\\Delta v_{\\tau=1}^{\\rm wing} \\approx \\sqrt{\\sigma_v\\gamma N/\\pi} \\approx 160\\ {\\rm km\\,s^{-1}}\\,(N/10^{19})^{1/2}', note: 'damping wings appear only for very large columns', ids: ['SCI-SAT-002'] }],
      draw(g, S) {
        const b = 25, a = P.aDamp(b), k = 35, Vm = 2500, sh = v => Math.asinh(v / k), mx = v => 80 + (sh(v) + sh(Vm)) / (2 * sh(Vm)) * 860, vs = [];
        for (let i = 0; i <= 1600; i++) { const s = -sh(Vm) + 2 * sh(Vm) * i / 1600; vs.push(k * Math.sinh(s)); }
        const myT = tt => 260 - (Math.log10(Math.max(tt, 1e-4)) + 4) / 14 * 230, myF = f => 560 - f * 220;
        for (const ln of [13, 15, 17, 19, 21]) { const N = 10 ** ln, tt = vs.map(v => P.tau0(N, b) * P.voigtH(a, v / b)); Ink.curve(g, vs, tt.map(x => Math.max(x, 1.01e-4)), mx, myT, { w: 1, c: TK.pencil, a: 0.5 }); Ink.curve(g, vs, tt.map(x => Math.exp(-x)), mx, myF, { w: 1, c: TK.pencil, a: 0.5 }); }
        const N = 10 ** S.mlogN, tt = vs.map(v => P.tau0(N, b) * P.voigtH(a, v / b));
        Ink.curve(g, vs, tt.map(x => Math.max(x, 1.01e-4)), mx, myT, { w: 1.8, c: TK.accent }); Ink.curve(g, vs, tt.map(x => Math.exp(-x)), mx, myF, { w: 1.8, c: TK.accent });
        Ink.seg(g, 80, myT(1), 940, myT(1), { w: 0.8, dash: [5, 4] }); Ink.note(g, 'τ = 1', 946, myT(1) + 4, { size: 13 });
        let vc = 0; for (let i = 800; i < vs.length; i++) if (tt[i] < 1) { vc = vs[i]; break; }
        if (vc > 0) for (const sgn of [-1, 1]) Ink.seg(g, mx(sgn * vc), myT(1), mx(sgn * vc), 560, { w: 0.7, c: TK.accent, dash: [2, 3] });
        Ink.label(g, 'log₁₀ τ — one line, b = 25 km/s', 80, 20); Ink.label(g, 'F = e^(−τ)', 80, 320);
        Ink.ruler(g, 80, 940, 566, { map: mx, ticks: [-1000, -200, -50, 0, 50, 200, 1000].map(v => ({ v, s: String(v) })), label: 'Δv [km/s] · axis compressed in the wings' });
      },
    },
  },
  /** the picture performs the rule: each ribbon pixel's transmitted fraction, read back, equals e^−τ at that colour */
  checks: {
    beerLambert() {
      const W2 = 1000, cv = b10ribbon(W2), d = cv.getContext('2d').getImageData(0, 0, W2, 1).data, { tot } = windowKernels(24), ink = hexRGB(TK.pool), light = hexRGB(TK.glow);
      const q = [0, 1, 2].reduce((a, k) => (light[k] - ink[k] > light[a] - ink[a] ? k : a), 0); let max = 0, mean = 0;
      for (let xp = 0; xp < W2; xp++) { const dev = Math.abs((d[xp * 4 + q] - ink[q]) / (light[q] - ink[q]) - Math.exp(-tot[b10col(xp, W2)])); max = Math.max(max, dev); mean += dev / W2; }
      return { claim: 'SCI-REP-005', columns: W2, max_abs_dT: max, mean_abs_dT: mean, quantisation_bound: 0.5 / (light[q] - ink[q]), pass: max <= 0.5 / (light[q] - ink[q]) + 1e-9 };
    },
  },
  foot: 'the ribbon is composited from layers of opacity 1 − e^−τᵢ over the backlight, which is Beer–Lambert; the light around it is the light that gets through (SCI-REP-005)',
};
