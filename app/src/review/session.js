/* The naïve-user study session (#cold=1; docs/study/STUDY_PROTOCOL.md, TELEMETRY.md). On a fresh start it forgets every
 * hint and first-encounter reveal, as if the app had never been used, begins at Beat 0, hides provenance ids and file names,
 * and records interaction behaviour — never identity: no names, no free text, no user agent, no location. Per beat visit:
 * when it was entered, from where and how (navigation direction, beats skipped), the first physical interaction (hovering or
 * pressing a physical object), presses and dead taps, gestures by kind, hints shown and how long after each the gesture
 * succeeded, readings pressed like sliders, settings, replays, resets, the physics layer and microscopes opened, keys used
 * and time spent. The log is kept in this tab's session storage after every event (a reload resumes it, its clock continuing
 * from the last event; a new tab is a new session). Nothing is shown during the session; at the last beat a quiet link saves it, and the facilitator can save it at
 * any time with Shift+L. window.__lyaSession() reads it (automated walk-throughs). */
import { App } from '../core/app.js';
import { clearOnboarding } from '../primitives/affordance.js';

const KEY = 'lyaStudy', SCHEMA = 'lya-study/1';
export const SESSION = { on: false };
const cur = () => SESSION.visits[SESSION.visits.length - 1];
const r2 = x => +x.toFixed(2);
/** the session's own clock [s]: the app's clock restarts on a reload, so a resumed session continues from its last event */
const clock = () => r2((SESSION.base || 0) + App.t);
const since = v => r2(clock() - v.entered_t);
function save() { SESSION.t_last = clock(); try { sessionStorage.setItem(KEY, JSON.stringify(SESSION)); } catch (e) {} }
function visit(sc, nav) {
  const prev = cur(); if (prev && prev.duration_s == null) prev.duration_s = since(prev);
  const from = nav && nav.from, d = from == null ? 'start' : sc.n > from ? 'forward' : sc.n < from ? 'back' : 'same';
  SESSION.visits.push({ beat: sc.n, slug: sc.slug, entered_t: clock(), from_beat: from, direction: d, via: nav ? nav.via : 'start', skipped: from == null ? 0 : Math.max(0, Math.abs(sc.n - from) - 1),
    first_interaction_s: null, first_success_s: null, presses: 0, dead_taps: 0, gestures: {}, hints: [], learned: [], readings_pressed: [], settings: [], replays: [], resets: [], other_controls: [],
    physics: [], microscopes: [], keys: 0, duration_s: null });
}
function touch(v, kind) { if (v && v.first_interaction_s == null) { v.first_interaction_s = since(v); v.first_interaction_kind = kind; } }   // object (the figure), key, or margin (an instrument, step or reading)
/** a study session: fresh with #cold=1, or resumed after a reload of the same tab */
// which build the participant saw: sessions are comparable only on one frozen candidate (the build writes this meta tag)
const appVersion = () => (document.querySelector('meta[name="lya-version"]') || {}).content || null;
export function installSession(h) {
  let resumed = null; try { resumed = JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch (e) {}
  if (h.cold !== '1' && !(resumed && resumed.on)) return;
  if (h.cold === '1' || !resumed) {
    clearOnboarding();
    Object.assign(SESSION, { on: true, schema: SCHEMA, app_version: appVersion(), started: new Date().toISOString().slice(0, 16), viewport: { w: innerWidth, h: innerHeight, dpr: devicePixelRatio || 1 }, motion_reduced: !!(matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches), input: {}, reloads: 0, visits: [] });
  } else { Object.assign(SESSION, resumed); SESSION.reloads = (SESSION.reloads || 0) + 1; if (SESSION.app_version !== appVersion()) SESSION.version_changed = true; SESSION.base = (SESSION.t_last || 0) - App.t; App.studyResume = true; }   // the reload's own gap is not counted
  App.study = true; document.body.classList.add('study');
  const H = App.hooks, prev = { onScene: H.onScene, afterPointer: H.afterPointer, onLearned: H.onLearned };
  H.onScene = (sc, nav) => { visit(sc, nav); save(); prev.onScene && prev.onScene(sc, nav); };
  H.afterPointer = (type, p) => {
    const v = cur(); if (v && type === 'down') {
      v.presses++; SESSION.input[p.pointerType || 'mouse'] = (SESSION.input[p.pointerType || 'mouse'] || 0) + 1;
      if (p.aff) { touch(v, 'object'); v.gestures[p.kind] = (v.gestures[p.kind] || 0) + 1; } else if (App.scenes[App.i].affordances) v.dead_taps++;
      save();
    }
    prev.afterPointer && prev.afterPointer(type, p);
  };
  H.onHover = () => { const v = cur(); if (v && v.first_interaction_s == null) { touch(v, 'object'); save(); } };
  H.onHintShown = key => { const v = cur(); if (v && !v.hints.some(x => x.key === key)) { v.hints.push({ key, shown_s: since(v) }); save(); } };
  H.onLearned = key => {
    const v = cur(); if (v) { const s = since(v), h = v.hints.find(x => x.key === key); touch(v, 'object'); v.learned.push({ key, s, after_hint_s: h ? r2(s - h.shown_s) : null }); if (v.first_success_s == null) v.first_success_s = s; save(); }
    prev.onLearned && prev.onLearned(key);
  };
  H.onKeyUsed = () => { const v = cur(); if (v) { v.keys++; touch(v, 'key'); save(); } };
  H.onReading = label => { const v = cur(); if (v) { v.readings_pressed.push({ label, s: since(v) }); touch(v, 'margin'); save(); } };
  H.onSetting = (label, role) => { const v = cur(); if (v) { touch(v, 'margin'); const last = v.settings[v.settings.length - 1]; if (!last || last.label !== label || since(v) - last.s > 1.5) v.settings.push({ label, role, s: since(v) }); else last.s = since(v); save(); } };
  H.onControl = (label, role) => { const v = cur(); if (!v) return; touch(v, 'margin'); const e = { label, s: since(v) }; (role === 'replay' ? v.replays : role === 'reset' ? v.resets : v.other_controls).push(role === 'replay' || role === 'reset' ? e : { ...e, role: role || null }); save(); };
  H.onPhysics = on => { const v = cur(); if (v) { v.physics.push({ on, s: since(v) }); save(); } };
  H.onSources = open => { const v = cur(); if (v && open) { (v.sources || (v.sources = [])).push({ s: since(v) }); touch(v, 'margin'); save(); } };
  H.onMicro = (key, open) => { const v = cur(); if (v && open) { v.microscopes.push({ key, s: since(v) }); save(); } };
  window.addEventListener('keydown', ev => { if (ev.key === 'L' && ev.shiftKey && !ev.metaKey && !ev.ctrlKey) { ev.preventDefault(); sessionDownload(); } });   // the facilitator: save the log at any time
  window.__lyaSession = () => JSON.parse(JSON.stringify({ ...SESSION, visits: SESSION.visits.map(v => (v.duration_s == null ? { ...v, now_s: since(v) } : v)) }));
}
/** the quiet link that saves the log: at the last beat only (the participant is not invited to it earlier) */
export function sessionLink() {
  if (!SESSION.on) return '';
  return '<button class="btn" id="sesslog" style="font-size:12.5px;color:var(--muted)">the end · save the session log for the facilitator</button>';
}
export function sessionDownload() {
  const v = cur(); const out = window.__lyaSession(); if (v && v.duration_s == null) out.saved_at_beat = v.beat;
  const blob = new Blob([JSON.stringify(out, null, 1)], { type: 'application/json' }), a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `lya-study-${SESSION.started.replace(/[:T]/g, '-')}.json`; a.click();
}
