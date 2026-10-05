/* Runtime: stage, navigation, quiet accessible controls, narration, microscope (exact return), keyboard, live
 * description, frame loop. Scenes are authored objects; this module never draws physics.
 *
 * Scene contract: { n, slug, persist, controls (array or getter), init(S), afterHash(S), draw(g, S, t),
 *   onPointer(type, p, S), onKey(key, S) → handled?, describe(S) → text for assistive tech, keys: text, micro, foot,
 *   checks: { name: () → { pass, … } } (pixel-level checks that the picture performs its claim) }.
 * Titles, statements and equations come from the manifest (core/meta.js). */
import { TK, STAGE } from '../design/tokens.js';
import { DESIGN_LINT } from '../design/ink.js';
import { clamp } from './util.js';
import { App, parseHash, writeHash } from './app.js';
import { META, metaEqs } from './meta.js';
import { openSources, closeSources } from './sources.js';
import { openPython, closePython, pythonFor } from './python.js';
import { cursorOf, affHitTest, drawAffordance, drawHint, hintUsed, markHint, affFade } from '../primitives/affordance.js';

export let CV = null;
export let G = null;
export let DPR = 1;
let STAGE_EL, MARGIN, CTRL, EQS, TOPNAV, MICRO, OV, LIVE;
const MAIN = STAGE.MAIN, W = STAGE.W, H = STAGE.H;
const sceneTitle = sc => META(sc.n).title || '';
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// ---------------------------------------------------------------------------------------------- DOM
function buildDOM() {
  for (const [k, v] of Object.entries(TK)) document.documentElement.style.setProperty('--' + k, v);
  STAGE_EL = document.getElementById('stage');
  STAGE_EL.innerHTML = `
    <nav id="topnav" aria-label="beats"></nav>
    <button id="advtoggle" role="switch" aria-checked="false" title="show the physics: the equations behind the picture (key p)"></button>
    <main id="margin"><div id="mtag"></div><h1 id="mtitle"></h1><div id="mtext"></div><div id="ctrl"></div><div id="why"></div><section id="probe" aria-live="polite"></section><section id="eqs" aria-label="the physics"></section><div id="sess"></div></main>
    <canvas id="cv" tabindex="0" role="application" aria-roledescription="interactive figure" aria-describedby="live"></canvas><div id="ov"></div>
    <div id="micro" class="hidden" role="dialog" aria-modal="true" aria-labelledby="mtitle2"><button id="mback">← back to the story</button><h2 id="mtitle2"></h2><div id="mtext2"></div><canvas id="mcv"></canvas><div id="mctrl"></div><div id="meqs"></div></div>
    <div id="srcp" class="hidden" role="dialog" aria-modal="true" aria-labelledby="srct"><button id="srcback">← back to the story</button><div id="srcbody"></div></div>
    <div id="pyp" class="hidden" role="dialog" aria-modal="true" aria-labelledby="pyt"><button id="pyback">← back to the story</button><div id="pybody"></div></div>
    <div id="foot"></div><div id="live" class="vh" aria-live="polite"></div>`;
  CV = document.getElementById('cv'); MARGIN = document.getElementById('margin'); CTRL = document.getElementById('ctrl'); EQS = document.getElementById('eqs');
  TOPNAV = document.getElementById('topnav'); MICRO = document.getElementById('micro'); OV = document.getElementById('ov'); LIVE = document.getElementById('live');
  DPR = Math.min(2, window.devicePixelRatio || 1);
  CV.width = MAIN.w * DPR; CV.height = MAIN.h * DPR; G = CV.getContext('2d');
  const MCV = document.getElementById('mcv'); MCV.width = 1000 * DPR; MCV.height = 620 * DPR;
  document.getElementById('advtoggle').onclick = () => setPhysics(!App.adv);
  document.getElementById('mback').onclick = () => closeMicro();
  document.getElementById('srcback').onclick = () => { closeSources(); writeHash(); };
  document.getElementById('pyback').onclick = () => closePython();
  fit(); window.addEventListener('resize', fit);
  const toLocal = (ev, el, w, h) => { const r = el.getBoundingClientRect(); return { x: (ev.clientX - r.left) / r.width * w, y: (ev.clientY - r.top) / r.height * h }; };
  let down = false, lastPointerT = -9;
  const scene = () => App.scenes[App.i];
  // pointer, pen and touch alike: the affordance under the pointer is found here and passed to the scene as p.aff
  const at = ev => { const p = toLocal(ev, CV, MAIN.w, MAIN.h); p.touch = ev.pointerType === 'touch'; return p; };
  CV.addEventListener('pointerdown', ev => {
    down = true; lastPointerT = App.t; AFF.kb = false; CV.setPointerCapture(ev.pointerId);
    const p = at(ev), o = affAt(p, p.touch); AFF.active = o ? o.id : null; AFF.hover = AFF.active; AFF.down0 = p;
    if (o) { CV.style.cursor = cursorOf(o, true); if (o.kind === 'select' || o.kind === 'scan') affUse(o); }   // a hold is learned when the scene says so (learned())
    p.aff = AFF.active; p.kind = o ? o.kind : null; p.pointerType = ev.pointerType; scene().onPointer && scene().onPointer('down', p, App.state); App.hooks.afterPointer && App.hooks.afterPointer('down', p);
  });
  CV.addEventListener('pointermove', ev => {
    const p = at(ev);
    if (down) { const o = affObj(AFF.active); if (o && o.kind !== 'hold' && AFF.down0 && Math.hypot(p.x - AFF.down0.x, p.y - AFF.down0.y) > 3) affUse(o); p.aff = AFF.active; }
    else { const o = affAt(p, false); if ((o ? o.id : null) !== AFF.hover) { AFF.hover = o ? o.id : null; AFF.hoverT = App.t; if (o && App.hooks.onHover) App.hooks.onHover(o); } CV.style.cursor = o ? cursorOf(o) : ''; p.aff = AFF.hover; }
    scene().onPointer && scene().onPointer(down ? 'drag' : 'move', p, App.state);
  });
  const release = ev => {   // pointerup, and pointercancel (a system gesture, palm rejection): a hold or drag always ends
    if (!down && ev.type === 'pointercancel') return;
    down = false; const p = at(ev); p.aff = AFF.active;
    if (AFF.active) { AFF.rel = AFF.active; AFF.relT = App.t; } AFF.active = null;
    scene().onPointer && scene().onPointer('up', p, App.state);
    if (App.adv) refreshMargin(true);   // "show the physics" prints the state the gesture left (Beat 6's widths, its u)
    const o = p.touch ? null : affAt(p, false); AFF.hover = o ? o.id : null; CV.style.cursor = o ? cursorOf(o) : ''; writeHash();
  };
  CV.addEventListener('pointerup', release); CV.addEventListener('pointercancel', release);
  CV.addEventListener('pointerleave', () => { AFF.hover = null; scene().onPointer && scene().onPointer('leave', null, App.state); });
  CV.addEventListener('focus', () => { if (App.t - lastPointerT > 0.3) AFF.kb = true; });
  CV.addEventListener('contextmenu', ev => ev.preventDefault());   // a long press is a hold, not a context menu (touch)
  MCV.addEventListener('pointermove', ev => { if (App.micro) { const m = microDef(); m && m.onPointer && m.onPointer('move', toLocal(ev, MCV, 1000, 620), App.state); } });
  window.addEventListener('keydown', onKey);
}
/** fit the fixed stage to the visible viewport. On mobile browsers window.innerWidth reports a layout viewport widened to the
 * 1440 px stage, so the visible size comes from the root element (or the visual viewport) */
const SMALL_SCALE = 0.55;   // below this the stage's body text is under ~8.5 px: the experience is designed for tablet and larger screens
function stageScale() { const de = document.documentElement, vw = de.clientWidth || window.innerWidth, vh = de.clientHeight || window.innerHeight; return Math.min(vw / W, vh / H); }
/** a gentle notice on screens too small for the fixed stage — never a trap: "continue anyway" (remembered for the tab) */
function smallScreenNotice() {
  if (App.shoot || stageScale() >= SMALL_SCALE) return;
  try { if (sessionStorage.getItem('lyaSmallOK') === '1') return; } catch (e) {}
  const d = document.createElement('div'); d.id = 'small'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-labelledby', 'smallt');
  d.innerHTML = `<p id="smallt">This interactive is designed for tablet and larger screens.</p><p class="sm2">On this screen its text and controls will be very small. Turning the device sideways helps a little.</p><button id="smallgo">continue anyway</button>`;
  document.body.appendChild(d);
  const go2 = document.getElementById('smallgo'); go2.onclick = () => { try { sessionStorage.setItem('lyaSmallOK', '1'); } catch (e) {} d.remove(); CV.focus({ preventScroll: true }); }; go2.focus();
}
const DPR0 = window.devicePixelRatio || 1;
function fit() {
  const de = document.documentElement, vw = de.clientWidth || window.innerWidth, vh = de.clientHeight || window.innerHeight, s0 = Math.min(vw / W, vh / H);
  // browser zoom (the device-pixel ratio rising above its load-time value) enlarges the stage as on any page — it then
  // scrolls — instead of being undone by fitting; pinch-zoom on touch screens is untouched
  const z = (window.devicePixelRatio || 1) / DPR0, s = z > 1.05 ? s0 * z : s0, over = W * s > vw + 1 || H * s > vh + 1;
  document.body.style.overflow = over ? 'auto' : ''; de.style.overflow = over ? 'auto' : '';
  STAGE_EL.style.transform = `scale(${s})`; STAGE_EL.style.left = `${over ? Math.max(0, (vw - W * s) / 2) : (vw - W * s) / 2}px`; STAGE_EL.style.top = `${over ? Math.max(0, (vh - H * s) / 2) : (vh - H * s) / 2}px`;
  if (!SIZER) { SIZER = document.createElement('div'); SIZER.style.cssText = 'position:absolute;left:0;top:0;width:1px;height:1px;pointer-events:none'; document.body.appendChild(SIZER); }
  SIZER.style.width = `${W * s}px`; SIZER.style.height = `${H * s}px`;   // the scrollable extent of a zoomed stage (a transform does not take up space)
}
let SIZER = null;

// ---------------------------------------------------------------------------------------------- keyboard: controls first, then the figure, then navigation
function onKey(ev) {
  if (ev.defaultPrevented) return;
  const t = ev.target, inControl = t && t.closest && t.closest('.ctl, #topnav, #micro');
  if (ev.key === 'Escape' && App.python) { closePython(); ev.preventDefault(); return; }
  if (App.python) return;   // the Python sheet is open: keys belong to it
  if (ev.key === 'Escape' && App.sources) { closeSources(); writeHash(); ev.preventDefault(); return; }
  if (App.sources) return;   // the sources sheet is open: keys belong to it
  if (ev.key === 'Escape' && App.micro) { closeMicro(); ev.preventDefault(); return; }
  if (inControl && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown', ' ', 'Enter'].includes(ev.key)) return;
  const sc = App.scenes[App.i];
  if (t === CV && !App.micro && sc.onKey && sc.onKey(ev.key, App.state, ev)) { ev.preventDefault(); AFF.kb = true; App.hooks.onKeyUsed && App.hooks.onKeyUsed(ev.key); if (sc.kbTarget && !sc.kbLearns) affUse(affObj(sc.kbTarget(App.state))); renderControls(); refreshMargin(true); writeHash(); return; }
  if (ev.key === 'p' && !ev.metaKey && !ev.ctrlKey) { setPhysics(!App.adv); return; }
  if (App.micro) return;
  if (ev.key === 'ArrowRight' || ev.key === 'PageDown') { go(App.i + 1, 'key'); ev.preventDefault(); }
  else if (ev.key === 'ArrowLeft' || ev.key === 'PageUp') { go(App.i - 1, 'key'); ev.preventDefault(); }
}

// ---------------------------------------------------------------------------------------------- navigation
// previous / next as marginal book navigation: the whole label is the target, and the next beat is named by its title
// sequential reading: "← previous" and "next →" never change their text, so they never move — the same place on the
// screen turns the page every time (from Beat 0 the reader can click one spot 13 times). The next beat's title is a
// quiet preview beside "next →", not part of the target, and cut short rather than wrapped, so it moves nothing.
function navLink(id, k, text, rel) {
  const sc = App.scenes[k]; if (!sc) return `<span class="bnav none" id="${id}" aria-hidden="true">${text}</span>`;   // an invisible placeholder of the same text keeps the other in place
  return `<button class="bnav" id="${id}" data-k="${k}" aria-label="${rel} beat — beat ${sc.n}: ${esc(sceneTitle(sc))}">${text}</button>`;
}
function renderTopnav() {
  const had = document.activeElement && TOPNAV.contains(document.activeElement) ? document.activeElement : null;   // keyboard reading keeps its place across pages
  const hadId = had && had.id, hadK = had && had.classList.contains('bn') ? had.dataset.k : null;
  const nxt = App.scenes[App.i + 1];
  TOPNAV.innerHTML = App.scenes.map((sc, k) => `<button class="bn ${k === App.i ? 'on' : k < App.i ? 'past' : ''}" data-k="${k}" aria-label="beat ${sc.n}: ${sceneTitle(sc)}" ${k === App.i ? 'aria-current="step"' : ''}>${sc.n}</button>`).join('') +
    navLink('prev', App.i - 1, '← previous', 'previous') + navLink('next', App.i + 1, 'next →', 'next') +
    `<span id="nexttitle" aria-hidden="true">${nxt ? esc(sceneTitle(nxt)) : ''}</span>`;
  if (hadId === 'next' || hadId === 'prev') { const el = document.getElementById(hadId); (el && el.tagName === 'BUTTON' ? el : document.getElementById(hadId === 'next' ? 'prev' : 'next')).focus({ preventScroll: true }); }
  else if (hadK != null) { const el = TOPNAV.querySelector(`.bn[data-k="${hadK}"]`); if (el) el.focus({ preventScroll: true }); }
  TOPNAV.querySelectorAll('.bn').forEach(el => el.onclick = () => go(+el.dataset.k, 'beat number'));
  for (const id of ['prev', 'next']) { const el = document.getElementById(id); if (el.dataset.k) el.onclick = () => go(+el.dataset.k, 'arrow'); }
}
export function go(k, via = 'start') {
  k = clamp(k, 0, App.scenes.length - 1);
  const from = App.started ? App.scenes[App.i].n : null; App.started = true;
  if (App.sources) closeSources();
  if (App.python) closePython(false);
  App.i = k; App.micro = null; MICRO.classList.add('hidden'); App.state = {}; App.anim = { since: App.t, entered: App.t };
  const sc = App.scenes[k]; if (sc.init) sc.init(App.state);
  CV.setAttribute('aria-label', `${sceneTitle(sc)}. ${sc.keys || ''}`);
  STAGE_EL.dataset.science = (META(sc.n).science || []).join(' ');
  renderTopnav(); renderControls(); refreshMargin(false, true); writeHash();
  App.hooks.onScene && App.hooks.onScene(sc, { from, via });
}
export function setPhysics(on) {
  App.adv = on; const t = document.getElementById('advtoggle'); t.setAttribute('aria-checked', String(on)); App.hooks.onPhysics && App.hooks.onPhysics(on);
  renderControls(); refreshMargin(); writeHash();
  if (on) revealPhysics();
}
/** the physics panel, just switched on, is brought into view when the scene's controls have pushed it below the column */
function revealPhysics() {
  const r = EQS.getBoundingClientRect(), m = MARGIN.getBoundingClientRect(), s = m.height / MARGIN.clientHeight || 1;   // screen px per CSS px (the stage is scaled)
  if (EQS.style.display !== 'none' && r.top > m.bottom - 60 * s) MARGIN.scrollTop += (r.top - m.top) / s - 40;
}

// ---------------------------------------------------------------------------------------------- quiet controls (ARIA slider / radio group / switch / button)
const ctrlList = sc => (typeof sc.controls === 'function' ? sc.controls() : sc.controls) || [];
export function renderControls(target = CTRL, list = null) {
  const sc = App.scenes[App.i], ae = document.activeElement, focusKey = ae && ae.dataset ? ae.dataset.fk : null;
  target.innerHTML = '';
  for (const c of (list || ctrlList(sc))) {
    if (c.show && !c.show(App.state)) continue;
    const el = document.createElement('div'); el.className = 'ctl'; target.appendChild(el);
    el.dataset.role = c.role || (c.readout ? 'readout' : c.type === 'ruler' ? 'slider' : c.type); if (c.why) el.dataset.why = c.why; if (c.int) el.dataset.int = c.int;   // the surface audit reads these (app/audit.mjs)
    if (c.type === 'ruler') makeRuler(el, c);
    else if (c.type === 'toggle') {
      const on = !!App.state[c.key];
      el.innerHTML = `<button class="tog ${on ? 'on' : ''}" role="switch" aria-checked="${on}" data-fk="t:${c.key}">${on ? '●' : '○'} ${c.label}</button>`;
      el.querySelector('button').onclick = () => { App.hooks.onControl && App.hooks.onControl(c.label, c.role); App.state[c.key] = !App.state[c.key]; if (c.onChange) c.onChange(App.state); App.anim = { ...App.anim, since: App.t, key: c.key }; renderControls(target, list); refreshMargin(); writeHash(); };
    } else if (c.type === 'choice') {
      const id = 'cl-' + c.key;
      el.innerHTML = `<div class="clab" id="${id}">${c.label}</div><div role="radiogroup" aria-labelledby="${id}">` + c.options.map(o => { const on = App.state[c.key] === o.v; return `<span class="cho ${on ? 'on' : ''}" role="radio" aria-checked="${on}" tabindex="${on ? 0 : -1}" data-v="${o.v}" data-fk="c:${c.key}:${o.v}">${o.s}</span>`; }).join('') + `</div>`;
      const opts = [...el.querySelectorAll('.cho')];
      const pick = s => { App.hooks.onControl && App.hooks.onControl(`${c.label}: ${s.textContent}`, c.role); const v = s.dataset.v; App.state[c.key] = isNaN(+v) ? v : +v; if (c.onChange) c.onChange(App.state); App.anim = { ...App.anim, since: App.t, key: c.key }; renderControls(target, list); refreshMargin(); writeHash(); };
      opts.forEach((s, i) => { s.onclick = () => pick(s); s.onkeydown = ev => { const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[ev.key]; if (d) { ev.preventDefault(); pick(opts[(i + d + opts.length) % opts.length]); } else if (ev.key === ' ' || ev.key === 'Enter') { ev.preventDefault(); pick(s); } }; });
      if (!opts.some(s => s.tabIndex === 0) && opts[0]) opts[0].tabIndex = 0;
      if (c.role === 'instrument') el.querySelector('[role="radiogroup"]').classList.add('inst');
      if (c.caption) el.insertAdjacentHTML('beforeend', `<div class="ccap">${c.caption}</div>`);
    } else if (c.type === 'button') {
      el.innerHTML = `<button class="btn" data-fk="b:${c.label}">${c.label}</button>`;
      el.querySelector('button').onclick = () => { App.hooks.onControl && App.hooks.onControl(c.label, c.role); c.act(App.state); App.anim = { ...App.anim, since: App.t, key: c.key || 'btn' }; renderControls(target, list); refreshMargin(); writeHash(); };
    }
  }
  if (!list) {
    const why = document.getElementById('why'); why.innerHTML = '';
    for (const [key, m] of Object.entries(sc.micro || {})) { const s = document.createElement('button'); s.className = 'whylink'; s.dataset.fk = 'w:' + key; s.textContent = 'why? ' + m.ask; s.onclick = () => openMicro(key); why.appendChild(s); why.appendChild(document.createElement('br')); }
    if (window.LYA_DATA.prov && window.LYA_DATA.prov.beats[String(sc.n)]) { const s = document.createElement('button'); s.className = 'srclink'; s.dataset.fk = 'src'; s.textContent = 'sources & assumptions'; s.onclick = () => { openSources(); writeHash(); }; why.appendChild(s); }   // the scene's public provenance
  }
  if (focusKey) { const el = STAGE_EL.querySelector(`[data-fk="${CSS.escape(focusKey)}"]`); if (el) el.focus(); }
}
/** readout rulers follow the physical state every frame (the gesture changes the state; the instrument reports it) */
function syncReadouts() {
  for (const el of CTRL.querySelectorAll('.rul.ro')) {
    const c = el._c, v = App.state[c.key]; if (v == null || el._v === v) continue; el._v = v;
    el.querySelector('.bead').style.left = `${el._toPos(v) * 230}px`; el.parentNode.querySelector('.cval').textContent = c.fmt ? c.fmt(v) : String(v);
    el.setAttribute('aria-valuenow', v); el.setAttribute('aria-valuetext', c.fmt ? c.fmt(v) : String(v));
  }
}
function makeRuler(el, c) {
  const W0 = 230, v = App.state[c.key];
  const toPos = val => c.log ? (Math.log(val / c.min) / Math.log(c.max / c.min)) : (val - c.min) / (c.max - c.min);
  const fromPos = p => { p = clamp(p, 0, 1); let val = c.log ? c.min * Math.pow(c.max / c.min, p) : c.min + p * (c.max - c.min); if (c.step) val = Math.round(val / c.step) * c.step; return val; };
  const fmt = x => c.fmt ? c.fmt(x) : String(x), id = 'rl-' + c.key;
  el.innerHTML = `<div class="clab" id="${id}">${c.label}<span class="cval">${fmt(v)}</span></div><div class="rul" role="slider" tabindex="0" aria-labelledby="${id}" aria-valuemin="${c.min}" aria-valuemax="${c.max}" aria-valuenow="${v}" aria-valuetext="${fmt(v)}" data-fk="r:${c.key}"><div class="rline"></div>${(c.ticks || []).map(t => `<div class="rtick ${toPos(t.v) < 0.02 ? 'lo' : toPos(t.v) > 0.98 ? 'hi' : ''}" style="left:${toPos(t.v) * W0}px"><span>${t.s}</span></div>`).join('')}<div class="bead" style="left:${toPos(v) * W0}px"></div></div>`;
  const rul = el.querySelector('.rul'), bead = el.querySelector('.bead'), val = el.querySelector('.cval');
  if (c.role === 'instrument') rul.classList.add('inst');   // an instrument setting: a notch on a scale, not a knob
  if (c.caption) el.insertAdjacentHTML('beforeend', `<div class="ccap">${c.caption}</div>`);
  if (c.readout) {   // a reading instrument: role meter, a tick for a marker; operable for precision only when the scene allows
    rul.classList.add('ro'); rul._c = c; rul._toPos = toPos; rul._v = v;
    if (!(c.operable && c.operable(App.state))) {
      rul.setAttribute('role', 'meter'); rul.removeAttribute('tabindex'); rul.title = c.title || '';
      rul.addEventListener('pointerdown', () => { AFF.nudge = App.t; App.hooks.onReading && App.hooks.onReading(c.label); });   // a reading pressed like a slider points to the physical gesture
      return;
    }
    rul.classList.add('op'); rul.title = c.titleOperable || '';
  }
  const setV = nv => { if (App.hooks.onSetting && App.state[c.key] !== nv) App.hooks.onSetting(c.label, c.role || (c.readout ? 'readout' : 'slider')); App.state[c.key] = nv; bead.style.left = `${toPos(nv) * W0}px`; val.textContent = fmt(nv); rul.setAttribute('aria-valuenow', nv); rul.setAttribute('aria-valuetext', fmt(nv)); if (c.onChange) c.onChange(App.state); refreshMargin(true); };
  const set = ev => { const r = rul.getBoundingClientRect(); setV(fromPos((ev.clientX - r.left) / r.width)); };
  rul.addEventListener('pointerdown', ev => { rul.setPointerCapture(ev.pointerId); set(ev); rul.onpointermove = set; });
  for (const t of ['pointerup', 'pointercancel']) rul.addEventListener(t, () => { rul.onpointermove = null; writeHash(); });
  rul.addEventListener('keydown', ev => {
    const p = toPos(App.state[c.key]), stepP = c.step ? (c.log ? 1 / 60 : c.step / (c.max - c.min)) : 1 / 100;
    const d = { ArrowRight: stepP, ArrowUp: stepP, ArrowLeft: -stepP, ArrowDown: -stepP, PageUp: 10 * stepP, PageDown: -10 * stepP }[ev.key];
    let np = null; if (d != null) np = p + d; else if (ev.key === 'Home') np = 0; else if (ev.key === 'End') np = 1;
    if (np == null) return; ev.preventDefault(); let nv = fromPos(np); if (c.step && nv === App.state[c.key]) nv = fromPos(np + Math.sign(d || 0) * stepP); setV(nv); writeHash();
  });
}

// ---------------------------------------------------------------------------------------------- narration: title, statement (develops), equations (show the physics)
export function texHTML(s, display = false) { try { return window.katex.renderToString(s, { throwOnError: false, displayMode: display }); } catch (e) { return s; } }
const eqHTML = e => `<div class="eq">${e.tex ? `<div class="eqm">${texHTML(e.tex, true)}</div>` : ''}${e.note ? `<div class="eqn">${e.note}</div>` : ''}${e.ids ? `<div class="eqid">${e.ids.join(' · ')}</div>` : ''}</div>`;
export function refreshMargin(light = false, develop = false) {
  const sc = App.scenes[App.i], S = App.state, m = META(sc.n);
  const adv = document.getElementById('advtoggle'); adv.innerHTML = `<span class="${App.adv ? 'on' : ''}">${App.adv ? '●' : '○'} show the physics</span>`; adv.setAttribute('aria-checked', String(App.adv));
  document.getElementById('mtag').textContent = `beat ${sc.n} of ${App.scenes.length - 1}`;
  const title = document.getElementById('mtitle'), text = document.getElementById('mtext');
  title.textContent = m.title || '';
  const stmt = (typeof sc.text === 'function' ? sc.text(S) : m.statement) || '';
  const hide = App.probe && !App.probe.revealed;   // a review question must not be answered by the statement
  text.innerHTML = hide ? '' : stmt.trim().split('\n').map(p => `<p>${p}</p>`).join('');
  if (develop && !App.rm && !App.shoot) for (const el of [title, text]) { el.classList.remove('dev'); void el.offsetWidth; el.classList.add('dev'); }
  const eqs = App.adv ? (sc.eqs ? sc.eqs(S) : metaEqs(sc.n)) : [];
  EQS.innerHTML = eqs.map(eqHTML).join('');
  if (eqs.length && pythonFor(sc.n).length) {   // the third layer, under the physics: hidden until asked for
    EQS.insertAdjacentHTML('afterbegin', '<button class="pylink" data-fk="py" aria-expanded="false" aria-controls="pyp">reproduce in Python ▸</button>');
    EQS.querySelector('.pylink').onclick = () => openPython();
  }
  EQS.style.display = eqs.length ? 'block' : 'none';
  fitEqs(EQS);
  const foot = typeof sc.foot === 'function' ? sc.foot(S) : (sc.foot || '');
  document.getElementById('foot').textContent = App.ids ? foot : plainText(foot);   // readers see no provenance ids or file names; the developer view (#ids=1) keeps them
  if (App.hooks.probeRender) App.hooks.probeRender();
  if (App.hooks.sessionHTML) { const el = document.getElementById('sess'), last = App.i === App.scenes.length - 1; if (el.dataset.last !== String(last)) { el.dataset.last = String(last); el.innerHTML = last ? App.hooks.sessionHTML() : ''; const b = el.querySelector('button'); if (b) b.onclick = App.hooks.sessionSave; } }   // a study session: the save link at the last beat only
  if (!light && sc.onMargin) sc.onMargin(S);
}

/** surface text without provenance ids or file names (study sessions): the ids stay in the source and in the provenance views */
export function plainText(s) { return s.replace(/\s*\((?:SCI|VAL|VT|INT)-[^)]*\)/g, '').split(' · ').filter(seg => !/\b(?:SCI|VAL|VT|INT)-[A-Z0-9]|\.js\b/.test(seg)).join(' · '); }

// ---------------------------------------------------------------------------------------------- microscope ("why?"): a paper sheet over the stage; return is exact
export function microDef() { const sc = App.scenes[App.i]; return sc.micro && App.micro ? sc.micro[App.micro] : null; }
export function openMicro(key) {
  App.hooks.onMicro && App.hooks.onMicro(key, true);
  const sc = App.scenes[App.i], m = sc.micro[key]; App.micro = key; App.microSaved = JSON.stringify(App.state);
  if (m.init) m.init(App.state);
  MICRO.classList.remove('hidden');
  document.getElementById('mtitle2').textContent = m.title;
  document.getElementById('mtext2').innerHTML = (m.text || '').split('\n').map(p => `<p>${p}</p>`).join('');
  renderControls(document.getElementById('mctrl'), m.controls || []);
  refreshMicroEqs(); writeHash(); document.getElementById('mback').focus();
}
function refreshMicroEqs() { const m = microDef(); if (!m) return; const el = document.getElementById('meqs'), h = App.adv || m.eqsAlways !== false ? (m.eqs ? m.eqs(App.state) : []).map(eqHTML).join('') : ''; if (el._h === h) return; el._h = h; el.innerHTML = h; fitEqs(el); }
/** a display equation wider than its column is scaled to fit, never clipped (KaTeX sizes in em) */
function fitEqs(root) { for (const el of root.querySelectorAll('.eqm')) { el.style.fontSize = ''; for (let k = 0; k < 4; k++) { const w = el.clientWidth, sw = el.scrollWidth; if (!(w > 0 && sw > w + 1)) break; el.style.fontSize = `${Math.max(7, parseFloat(getComputedStyle(el).fontSize) * w / sw * 0.98).toFixed(2)}px`; } } }
if (document.fonts) document.fonts.addEventListener('loadingdone', () => { const e = document.getElementById('eqs'); if (e) fitEqs(e); });   // KaTeX's fonts change the widths once loaded
export function closeMicro() {
  App.hooks.onMicro && App.hooks.onMicro(App.micro, false);
  const key = App.micro; App.micro = null; MICRO.classList.add('hidden'); App.state = JSON.parse(App.microSaved || '{}');
  renderControls(); refreshMargin(); writeHash();
  const back = STAGE_EL.querySelector(`[data-fk="w:${key}"]`); if (back) back.focus();
}

// ---------------------------------------------------------------------------------------------- affordances (primitives/affordance.js)
export const AFF = { list: [], hover: null, hoverT: 0, active: null, rel: null, relT: -9, kb: false, down0: null, gone: null, nudge: null };
function affObj(id) { return id ? AFF.list.find(o => o.id === id) : null; }
function affAt(p, touch) { return AFF.list.find(o => affHitTest(o, p, touch ? 1.5 : 1)) || null; }
/** the gesture has been discovered: its hint goes away for this session (and fades out now) */
function affUse(o) { if (o && o.hint && o.hint.key && !hintUsed(o.hint.key)) { markHint(o.hint.key); AFF.gone = { o, t: App.t }; App.hooks.onLearned && App.hooks.onLearned(o.hint.key); setTimeout(() => renderControls(), 0); } }   // readouts may unlock for precision
/** a scene says a gesture has been learned (holds, and gestures whose success the scene judges) */
export function learned(key) { const o = AFF.list.find(q => q.hint && q.hint.key === key); if (o) affUse(o); else if (!hintUsed(key)) { markHint(key); App.hooks.onLearned && App.hooks.onLearned(key); setTimeout(() => renderControls(), 0); } }
function drawAffs(sc) {
  const S = App.state, now = App.t, kbId = AFF.kb && document.activeElement === CV && sc.kbTarget ? sc.kbTarget(S) : null, forced = App.forceAff;
  for (const o of AFF.list) {
    let mode = null, a = 0;
    if (forced && forced.id === o.id) { mode = forced.mode; a = forced.mode === 'released' ? 0.5 : 1; }
    else if (App.shoot) continue;                                      // idle stills: no affordance marks
    else if (o.id === AFF.active) { mode = 'active'; a = 1; }
    else if (o.id === AFF.hover) { mode = 'hover'; a = App.rm ? 1 : affFade(AFF.hoverT, now, 0.12); }
    else if (o.id === kbId) { mode = 'focus'; a = 1; }
    else if (o.id === AFF.rel) { mode = 'released'; a = App.rm ? 0 : 1 - affFade(AFF.relT, now, 0.35); }
    if (!mode && AFF.nudge != null && now - AFF.nudge < 1.6 && o.hint && !hintUsed(o.hint.key)) { mode = 'hover'; a = 1; }   // nudged from a reading: the object answers
    if (mode) drawAffordance(G, o, mode, a);
  }
  const hintKey = typeof S.hints === 'string' && S.hints !== 'true' ? S.hints : null, all = S.hints === true || S.hints === 'true';   // stills: #hints=true, or one hint by key
  const showHints = !App.probe && (!App.shoot || all || hintKey);
  if (showHints) {   // one hint at a time: the first undiscovered gesture
    const o = hintKey ? AFF.list.find(o => o.hint && o.hint.key === hintKey) : AFF.list.find(o => o.hint && (!hintUsed(o.hint.key) || all));
    if (o) { const a = App.shoot || App.rm || (AFF.nudge != null && now - AFF.nudge < 4) ? 1 : affFade((App.anim.entered || 0) + 0.9, now, 0.6); drawHint(G, o, a); if (a > 0.5 && App.hooks.onHintShown) App.hooks.onHintShown(o.hint.key); }
  }
  if (AFF.gone && !App.rm) { const o = AFF.list.find(q => q.hint && q.hint.key === AFF.gone.o.hint.key) || AFF.gone.o, a = 1 - affFade(AFF.gone.t, now, 0.6); if (a > 0) drawHint(G, o, a); else AFF.gone = null; }
}
// ---------------------------------------------------------------------------------------------- frame loop and live description
let lastLive = '', lastLiveT = -1;
const PERF = { draw: [], n: 0 };   // per-frame draw time (ms), for the performance report (window.__lyaPerf)
export function frame() {
  const sc = App.scenes[App.i];
  DESIGN_LINT.scene = `beat ${sc.n}`;
  G.setTransform(DPR, 0, 0, DPR, 0, 0); G.fillStyle = TK.paper; G.fillRect(0, 0, MAIN.w, MAIN.h); OV.innerHTML = '';
  const t0 = performance.now();
  try { sc.draw(G, App.state, App.t); } catch (e) { console.error(e); }
  PERF.draw.push(performance.now() - t0); if (PERF.draw.length > 600) PERF.draw.shift(); PERF.n++;
  syncReadouts();
  if (App.hooks.afterDraw) App.hooks.afterDraw(G, App.state, App.t);
  try { AFF.list = (sc.affordances ? sc.affordances(App.state) : []) || []; drawAffs(sc); } catch (e) { console.error(e); }
  if (App.micro) {
    const m = microDef(), mc = document.getElementById('mcv'), mg = mc.getContext('2d');
    DESIGN_LINT.scene = `beat ${sc.n} microscope ${App.micro}`;
    mg.setTransform(DPR, 0, 0, DPR, 0, 0); mg.fillStyle = TK.paper; mg.fillRect(0, 0, 1000, 620);
    try { m.draw(mg, App.state, App.t); } catch (e) { console.error(e); }
    refreshMicroEqs();
  }
  if (sc.describe && App.t - lastLiveT > 0.7) { const d = sc.describe(App.state); if (d !== lastLive) { LIVE.textContent = d; lastLive = d; } lastLiveT = App.t; }
  if (!App.shoot) requestAnimationFrame(frame);
}
/** text placed in figure coordinates (KaTeX inside the figure) */
export function ovTex(s, x, y, { size = 16, c = TK.ink, anchor = 'l' } = {}) {
  const el = document.createElement('div'); el.className = 'ovt';
  el.style.cssText = `left:${MAIN.x + x}px;top:${MAIN.y + y}px;font-size:${size}px;color:${c};transform:translate(${anchor === 'l' ? '0' : anchor === 'c' ? '-50%' : '-100%'},-50%)`;
  el.innerHTML = texHTML(s); OV.appendChild(el);
}

// ---------------------------------------------------------------------------------------------- boot
export async function boot(prepare) {
  buildDOM();
  try { await document.fonts.ready; await Promise.all(['300 16px Fraunces', 'italic 300 16px Fraunces', '300 13px Inter', '400 11px "IBM Plex Mono"'].map(f => document.fonts.load(f))); } catch (e) {}
  const h = parseHash();
  App.shoot = h.shoot === '1'; if (h.t != null) App.tFixed = +h.t;
  App.ids = h.ids === '1'; document.body.classList.toggle('ids', App.ids);   // developer view: the provenance ids on the surface (#ids=1); readers see titles on the sources sheet
  if (window.__lyaVirtualClock === true && App.tFixed == null) App.tFixed = 0;   // capture tools: the virtual clock from the first frame (true cold starts)
  if (h.aff) { const i = h.aff.lastIndexOf(':'); App.forceAff = { id: h.aff.slice(0, i), mode: h.aff.slice(i + 1) || 'hover' }; }   // reproducible affordance stills (the grammar sheet)
  App.rmForced = h.rm === '1'; App.rm = App.rmForced || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  prepare();
  window.__lyaState = () => App.state; window.__lyaLint = () => DESIGN_LINT.hits.slice();   // read-only hooks for app/smoke.mjs
  window.__lyaClock = t => { App.tFixed = t; };   // virtual clock for app/record.mjs (deterministic recordings)
  window.__lyaPerf = (reset = false) => { const d = PERF.draw.slice().sort((a, b) => a - b), r = { frames: PERF.n, samples: d.length, mean_ms: d.reduce((a, b) => a + b, 0) / (d.length || 1), p95_ms: d[Math.floor(0.95 * (d.length - 1))] || 0, max_ms: d[d.length - 1] || 0 }; if (reset) { PERF.draw = []; PERF.n = 0; } return r; };
  window.__lyaAffs = () => AFF.list.map(o => ({ id: o.id, name: o.name || null, kind: o.kind, int: o.int || null, role: o.role || null, hint: o.hint ? o.hint.text : null }));   // the figure's physical objects (app/audit.mjs)
  window.__lyaChecks = () => App.scenes.flatMap(sc => Object.entries(sc.checks || {}).map(([name, f]) => ({ beat: sc.n, name, ...f() })));   // scene self-checks (app/smoke.mjs)
  for (const sc of App.scenes) if (!META(sc.n).title) console.error(`scene ${sc.n} (${sc.slug}) has no manifest entry`);
  if (App.hooks.beforeGo) App.hooks.beforeGo(h);   // e.g. a study session (#cold=1)
  const k = h.beat != null && (!App.study || App.studyResume) ? App.scenes.findIndex(sc => String(sc.n) === h.beat) : 0;   // a study session always begins at Beat 0
  go(Math.max(0, k));
  App.adv = h.adv === '1';
  for (const [kk, v] of Object.entries(h)) if (!['beat', 'adv', 'shoot', 't', 'micro', 'probe', 'rm', 'aff', 'cold', 'src'].includes(kk)) App.state[kk] = isNaN(+v) ? (v === 'true' ? true : v === 'false' ? false : v) : +v;
  const sc = App.scenes[App.i]; if (sc.afterHash) sc.afterHash(App.state);
  renderControls(); refreshMargin();
  if (App.adv) requestAnimationFrame(revealPhysics);   // a link that opens a scene with the physics on shows it
  if (h.micro) openMicro(h.micro);
  if (h.src === '1') openSources();
  if (h.probe && App.hooks.startProbe) App.hooks.startProbe(h.probe);
  frame();
  smallScreenNotice();
  if (App.shoot) requestAnimationFrame(() => { frame(); document.body.dataset.ready = '1'; });
}
