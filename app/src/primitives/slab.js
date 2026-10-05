/* The 3D gas volume in shallow perspective (SCI-SIM-TOY-001; design/VISUAL_LANGUAGE.md §4 depth cues).
 * x (the beam) → right, y → up, z → depth. The camera sits in front and above, looking along +z, so every z-slice is an
 * axis-aligned rectangle: the volume is stacked translucent slices (no WebGL). `sway` moves the camera sideways.
 * The gas dissolves into paper toward the sample's edges (ruling, production material pass): no wireframe, only short
 * corner cues that carry the parallax. `bounds: true` draws the sample's boundary, labelled ("show the physics").
 * The observer and the quasar sit at the beam's ends for orientation only: break marks and one label at each end say the
 * gaps are not to scale — the distance to us is the comoving distance to the sample's redshift (SCI-RED-004). */
import { TK } from '../design/tokens.js';
import { Ink } from '../design/ink.js';
import { clamp } from '../core/util.js';
import { SC, SLAB_FADE, slabEdgeFade } from '../data/scene-data.js';
import { DPR } from '../core/runtime.js';
import { P } from '../physics/lya.js';

/** the comoving distance from us to the sample's redshift [Mpc/h] (lyaphys comovingDistance, SCI-RED-004) */
let _chi = null;
const chiToUs = () => _chi ?? (_chi = P.comovingDistance(SC.z, SC.cosmo));
export function slabGeom(box, tilt = 0.55, sway = 0) {
  const sl = SC.slab, [bx, by, bw, bh] = box, D = 3.4 * sl.lz;
  const cam = sw => ({ cx: sl.lx / 2 + sw * 0.18 * sl.lx, cy: sl.ly / 2 + (0.6 + 1.6 * tilt) * sl.ly });
  const proj = (c, x, y, z) => { const s = D / (D + z); return [c.cx + s * (x - c.cx), c.cy + s * (y - c.cy)]; };
  const c0 = cam(0), pts = [];
  for (const x of [0, sl.lx]) for (const y of [0, sl.ly]) for (const z of [0, sl.lz]) pts.push(proj(c0, x, y, z));
  const xmin = Math.min(...pts.map(p => p[0])), xmax = Math.max(...pts.map(p => p[0])), ymin = Math.min(...pts.map(p => p[1])), ymax = Math.max(...pts.map(p => p[1]));
  const k = Math.min(bw / (xmax - xmin), bh / (ymax - ymin)), ox = bx + (bw - k * (xmax - xmin)) / 2, oy = by + (bh - k * (ymax - ymin)) / 2, c = cam(sway);
  const P3 = (x, y, z) => { const [X, Y] = proj(c, x, y, z); return [ox + k * (X - xmin), oy + k * (ymax - Y)]; };
  return { P3, scale: z => k * D / (D + z), box, k, ray: x => P3(x, sl.ray_y, sl.ray_z) };
}
/** the stacked slices for one view, composited once into an offscreen layer and reused while the view is unchanged
 * (performance only: the same drawing operations, in the same order; within 8-bit rounding of drawing them each frame) */
const _slabLayers = new Map();
function slabLayer(G3, box, slices, fade, from, to, key) {
  if (_slabLayers.has(key)) { const v = _slabLayers.get(key); _slabLayers.delete(key); _slabLayers.set(key, v); return v; }
  const sl = SC.slab, pad = 30, [bx, by, bw, bh] = box, c = document.createElement('canvas'), W = bw + 2 * pad, H = bh + 2 * pad;
  c.width = Math.ceil(W * DPR); c.height = Math.ceil(H * DPR);
  const x = c.getContext('2d'); x.setTransform(DPR, 0, 0, DPR, (pad - bx) * DPR, (pad - by) * DPR); x.imageSmoothingEnabled = true;
  for (let kk = from; to > from ? kk <= to : kk >= to; kk += to > from ? 1 : -1) {
    const z = (kk + 0.5) / sl.nz * sl.lz, [x0, y0] = G3.P3(0, sl.ly, z), s = G3.scale(z), aerial = 0.5 + 0.5 * (1 - kk / sl.nz);   // farther is paler
    x.globalAlpha = 0.105 * aerial * fade * slabEdgeFade((kk + 0.5) / sl.nz, SLAB_FADE.z);   // near and far faces dissolve too
    x.drawImage(slices[kk], x0, y0, sl.lx * s, sl.ly * s);
  }
  const v = { c, ox: bx - pad, oy: by - pad, W, H }; _slabLayers.set(key, v); if (_slabLayers.size > 8) _slabLayers.delete(_slabLayers.keys().next().value);
  return v;
}
export function drawSlab(g, box, { tilt = 0.55, sway = 0, focus = true, fade = 1, probeX = null, windowX = null, quasar = true, observer = true, rayAlpha = 1, cut = false, bounds = false } = {}) {
  const sl = SC.slab, G3 = slabGeom(box, tilt, sway), slices = focus ? SC.slicesFocus : SC.slices;
  const key = [box.join(','), tilt.toFixed(4), sway.toFixed(4), focus ? 1 : 0, fade.toFixed(3), DPR].join('|');
  const layer = (from, to, part) => { const v = slabLayer(G3, box, slices, fade, from, to, key + part); g.save(); g.imageSmoothingEnabled = true; g.drawImage(v.c, v.ox, v.oy, v.W, v.H); g.restore(); };
  const C8 = [[0, 0, 0], [sl.lx, 0, 0], [sl.lx, sl.ly, 0], [0, sl.ly, 0], [0, 0, sl.lz], [sl.lx, 0, sl.lz], [sl.lx, sl.ly, sl.lz], [0, sl.ly, sl.lz]].map(c => G3.P3(...c));
  const EDGES = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
  if (bounds) {   // the toy sample's boundary, stated as such
    for (const [a, b] of EDGES) Ink.seg(g, ...C8[a], ...C8[b], { w: 0.6, c: TK.pencil, a: 0.8 * fade, dash: [3, 3] });
    for (let q = 1; q <= 9; q++) { const x = sl.lx * q / 10, [ax, ay] = G3.P3(x, sl.ray_y, sl.ray_z), [fx, fy] = G3.P3(x, 0, sl.ray_z); Ink.seg(g, ax, ay, fx, fy, { w: 0.5, c: TK.faint, a: 0.6 * fade, dash: [1, 4] }); }
  } else {        // corner cues only: two short strokes along the edges at each corner (they carry the parallax)
    for (const [a, b] of EDGES) for (const [p, q] of [[a, b], [b, a]]) { const [x0, y0] = C8[p], [x1, y1] = C8[q], L = Math.hypot(x1 - x0, y1 - y0) || 1, k = Math.min(0.12, 10 / L); Ink.seg(g, x0, y0, x0 + (x1 - x0) * k, y0 + (y1 - y0) * k, { w: 0.6, c: TK.faint, a: 0.9 * fade }); }
  }
  layer(sl.nz - 1, Math.ceil(sl.nz / 2), '|back');   // far gas, behind the beam
  const [ax, ay] = G3.ray(-1.2), [qx, qy] = G3.ray(sl.lx + 1.2);                // the beam at mid-depth: behind near gas, in front of far gas
  Ink.seg(g, ax, ay, qx, qy, { w: 1.3, c: TK.ink, a: rayAlpha * fade });
  for (let q = 1; q <= 7; q++) { const [x, y] = G3.ray(sl.lx * (q / 8)); Ink.arrow(g, x + 7, y, x - 3, y, { w: 1, c: TK.ink, a: 0.5 * rayAlpha * fade, head: 4 }); }
  const brk = xb => { const [x, y] = G3.ray(xb); Ink.seg(g, x - 4, y, x + 4, y, { w: 4, c: TK.paper, a: fade }); for (const d of [-2.5, 2.5]) Ink.seg(g, x + d - 2, y + 5, x + d + 2, y - 5, { w: 0.9, c: TK.ink, a: rayAlpha * fade }); };   // the beam is broken: not to scale
  if (observer) brk(-0.6); if (quasar) brk(sl.lx + 0.6);
  if (windowX) { const [w0x, w0y] = G3.ray(windowX[0]), [w1x, w1y] = G3.ray(windowX[1]); Ink.seg(g, w0x, w0y, w1x, w1y, { w: 3.2, c: TK.accent, a: 0.75 * fade }); }
  layer(Math.ceil(sl.nz / 2) - 1, 0, '|front');      // near gas, in front of the beam
  if (cut && probeX != null) { const q = [[probeX, 0, 0], [probeX, sl.ly, 0], [probeX, sl.ly, sl.lz], [probeX, 0, sl.lz]].map(c => G3.P3(...c)); Ink.poly(g, q, { c: TK.accent, a: 0.05 * fade }); Ink.line(g, [...q, q[0]], { w: 0.8, c: TK.accent, a: 0.7 * fade, dash: [3, 3] }); }
  if (quasar) { Ink.dot(g, qx + 8, qy, 5, { c: TK.ink, a: fade }); for (let q = 0; q < 8; q++) { const an = q * Math.PI / 4; Ink.seg(g, qx + 8 + 8 * Math.cos(an), qy + 8 * Math.sin(an), qx + 8 + 13 * Math.cos(an), qy + 13 * Math.sin(an), { w: 0.8, c: TK.ink, a: 0.7 * fade }); } Ink.note(g, 'quasar (the lamp)', qx + 24, qy + 4, { size: 14, a: fade });; for (const [i, l] of ['farther still', 'not to scale'].entries()) Ink.mono(g, l, qx + 24, qy - 26 + 12 * i, { size: 9.5, c: TK.muted, a: fade }); }
  if (observer) { Ink.ring(g, ax - 8, ay, 5, { c: TK.ink, w: 1.1, a: fade }); Ink.dot(g, ax - 8, ay, 1.8, { a: fade }); Ink.note(g, 'observer (us)', ax - 18, ay + 4, { size: 14, align: 'right', a: fade }); for (const [i, l] of [`≈ ${(chiToUs() / 1000).toFixed(1)} Gpc/h to us`, 'not to scale'].entries()) Ink.mono(g, l, Math.max(ax - 18, 112), ay - 26 + 12 * i, { size: 9.5, align: 'right', c: TK.muted, a: fade }); }   // the distance label stays on the figure when the volume is turned
  if (probeX != null) { const [px, py] = G3.ray(probeX); Ink.ring(g, px, py, 9, { c: TK.accent, w: 1.4 }); }
  if (bounds) { const [lx, ly] = C8[3]; Ink.mono(g, `the toy sample: ${sl.lx.toFixed(0)} × ${sl.ly.toFixed(0)} × ${sl.lz.toFixed(0)} Mpc/h — the gas continues beyond it`, lx, ly - 8, { size: 9.5, a: fade }); }
  return G3;
}
/** y–z cross-section of the slab at beam position x (looking along the beam), as an ink image */
const _xsec = {};
export function crossSection(x) {
  const sl = SC.slab, i = clamp(Math.floor(x / sl.lx * sl.nx), 0, sl.nx - 1);
  if (_xsec[i]) return _xsec[i];
  const c = document.createElement('canvas'); c.width = sl.nz; c.height = sl.ny;
  const ctx = c.getContext('2d'), im = ctx.createImageData(sl.nz, sl.ny);
  for (let j = 0; j < sl.ny; j++) for (let kk = 0; kk < sl.nz; kk++) { const v = Math.pow(sl.at(i, j, kk), 1.25), q = ((sl.ny - 1 - j) * sl.nz + kk) * 4; im.data[q] = 31; im.data[q + 1] = 39; im.data[q + 2] = 50; im.data[q + 3] = 255 * v; }
  ctx.putImageData(im, 0, 0); return (_xsec[i] = c);
}
