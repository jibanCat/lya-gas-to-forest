/* The validated browser physics is science/js/lyaphys.js (SCI-* ledger, VAL-* tests); the build embeds it unchanged.
 * Scenes take every constant and transform from here — never a local copy (design rule §11 of the production brief). */
export const P = window.LyaPhys;
/** Lyα rest wavelength (vacuum, Å) — CONST-LYA-LAMBDA via lyaphys */
export function LYA() { return P.C.lambda_A; }
