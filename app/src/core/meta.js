/* The beat manifest (design/canonical/BEATS.yaml → beats.json, embedded at build): titles, statements, steps, equations
 * and the science ids each scene relies on. Scenes never type their own statements or equations. */
export function META(n) { return (window.LYA_DATA.beats.beats || []).find(b => b.n === n) || {}; }
export function metaEqs(n, extra = []) { return [...(META(n).equations || []), ...extra]; }
export function stageOpts(n) { return (META(n).stages || []).map((st, k) => ({ v: k + 1, s: st.label })); }
/** the ledger ids a scene is built on (shown nowhere on the surface; exposed for provenance tooling) */
export function scienceIds(n) { return META(n).science || []; }
/** a number from a validation report embedded at build (science/validation/<name>/report.json) */
export function report(id) { return (window.LYA_DATA.reports || {})[id] || {}; }
/** an interactive control's manifest entry (domain, bounds): the single source a scene reads its limits from */
export function interaction(n, id) { return (META(n).interactions || []).find(t => t.id === id) || {}; }
