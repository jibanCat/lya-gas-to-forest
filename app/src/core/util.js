/* Small pure helpers shared by scenes (no state, no DOM). */
export function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
export function lerp(a, b, t) { return a + (b - a) * t; }
/** material easing: cubic in-out (design/VISUAL_LANGUAGE.md §5) */
export function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
/** linear scale d0..d1 → r0..r1 */
export function scl(d0, d1, r0, r1) { return v => r0 + (v - d0) / (d1 - d0) * (r1 - r0); }
export function rgba(hex, a = 1) { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; }
/** '#RRGGBB' → [r, g, b] (for per-pixel compositing that must use the tokens) */
export function hexRGB(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
export function logTicks(vals, fmt) { return vals.map(v => ({ v, s: fmt(v) })); }
/** temperatures as people read them */
export function fmtT(T) { return T >= 99950 ? `${(T / 1e5).toFixed(1)}×10⁵ K` : T >= 1e4 ? `${(T / 1e4).toFixed(1)}×10⁴ K` : `${Math.round(T / 100) * 100} K`; }
/** column densities with superscript exponents */
export function fmtN(N) { const e = Math.floor(Math.log10(N)), m = N / 10 ** e; return `${m.toFixed(1)}×10${String(e).replace(/./g, c => '⁰¹²³⁴⁵⁶⁷⁸⁹'[c])} cm⁻²`; }
/** wavelengths with a thin-space thousands separator */
export function fmtA(l) { return l >= 1000 ? `${Math.floor(l / 1000)} ${String(Math.round(l % 1000)).padStart(3, '0')}` : String(Math.round(l)); }
export function fmtA2(l) { return l >= 1000 ? `${Math.floor(l / 1000)} ${(l % 1000).toFixed(1).padStart(5, '0')}` : l.toFixed(1); }
/** a tiny LRU memo for deterministic, pure computations (same inputs → identical output) */
export function memo(fn, size = 48) {
  const cache = new Map();
  return (key, ...args) => { if (cache.has(key)) { const v = cache.get(key); cache.delete(key); cache.set(key, v); return v; } const v = fn(...args); cache.set(key, v); if (cache.size > size) cache.delete(cache.keys().next().value); return v; };
}
