/* Application state: the current scene, its interaction state, layers (surface / show the physics / microscope / probe),
 * clock, motion preference and the URL. Every view is addressable: #beat=5&stage=3&adv=1 (design/VISUAL_LANGUAGE.md §7). */
export const App = {
  scenes: [], i: 0, adv: false, micro: null, state: {}, shoot: false, rm: false, tFixed: null, start: performance.now(), anim: {},
  probe: null, hooks: {},
  get t() { return this.tFixed != null ? this.tFixed : (performance.now() - this.start) / 1000; },
};
export function registerScene(def) { App.scenes.push(def); }
/** seconds since the last control change; animations resolve at once when shooting stills or under reduced motion */
export function sinceChange() { return (App.shoot || App.rm) ? 99 : App.t - (App.anim.since || 0); }
/** seconds since the beat was entered (first-encounter transformations); complete at once in stills and reduced motion */
export function sinceEnter() { return (App.shoot || App.rm) ? 99 : App.t - (App.anim.entered || 0); }
/** whether decorative-free physical motion may run (thermal motion, travelling light) */
export function motionOK() { return !App.rm && !App.shoot; }
export function parseHash() {
  const h = location.hash.replace(/^#/, ''), o = {};
  for (const kv of h.split('&')) { if (!kv) continue; const [k, v] = kv.split('='); o[decodeURIComponent(k)] = v == null ? '1' : decodeURIComponent(v); }
  return o;
}
export function writeHash() {
  if (App.shoot) return;
  const sc = App.scenes[App.i], parts = [`beat=${sc.n}`];
  if (App.adv) parts.push('adv=1');
  if (App.ids) parts.push('ids=1');
  if (App.micro) parts.push('micro=' + App.micro);
  if (App.probe) parts.push('probe=' + App.probe.id);
  if (App.sources) parts.push('src=1');
  if (App.rm && App.rmForced) parts.push('rm=1');
  for (const [k, v] of Object.entries(App.state)) if (sc.persist && sc.persist.includes(k)) parts.push(`${k}=${typeof v === 'number' ? +v.toPrecision(5) : v}`);
  history.replaceState(null, '', '#' + parts.join('&'));
}
