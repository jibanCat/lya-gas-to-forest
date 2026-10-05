/* Comprehension probes: a quiet review mode for testing whether the surface interaction teaches what we intend
 * (production brief §5). Open with #probe=all (the five in order) or #probe=<id>. The question replaces the statement
 * in the margin; the answer is given by acting on the picture (clicking the ruler) or choosing a phrase. No scores,
 * points or badges. Responses — answer, time to answer, whether "show the physics" was open — are kept for the session
 * and can be saved as JSON for a later first-year student test. */
import { App } from '../core/app.js';
import { go, renderControls, refreshMargin, setPhysics } from '../core/runtime.js';
import { fmtA } from '../core/util.js';
import { b5stageT } from '../scenes/b05-stretched.js';

export const PROBES = [
  { id: 'local-lya', beat: 5, n: 1,
    setup: S => { S.stage = 3; S.conceal = true; S.hideLine = true; },
    ask: 'Before the light reaches the next structure: at what wavelength, in that gas’s own frame, will its hydrogen absorb most strongly?',
    respond: 'wavelength', how: 'click on the ruler',
    expected: 'about 1215.67 Å (Lyman-alpha)', ok: a => Math.abs(a.lambda - 1215.67) < 40,
    reveal: S => { S.conceal = false; S.hideLine = false; },
    after: 'Lyα, 1215.67 Å: in its own frame every bit of gas absorbs there, so the mark never moves while the light stretches past it.',
    evidence: 'Step 2 showed the first structure writing its shadow at the mark; the mark stays at 1215.67 Å on the ruler of “here” for the whole journey.' },
  { id: 'existing-shadow', beat: 5, n: 2,
    setup: S => { S.stage = 2; S.hideLine = true; },
    ask: 'The light travels on toward us and keeps stretching. What happens to the shadow that was just written?',
    respond: 'choice', options: ['it moves to shorter wavelengths (bluer)', 'it stays at 1215.67 Å', 'it moves to longer wavelengths (redder)'],
    expected: 'it moves to longer wavelengths (redder)', ok: a => a.choice === 2,
    reveal: S => { S.hideLine = false; S._tFrom = S._tauNow; S._tTo = b5stageT(3); S._since = App.t; S.stage = 3; },
    after: 'It is part of the light now, so it stretches with the light: it drifts redward, away from the mark — just as the quasar’s own Lyα already did (watch the close-up).',
    evidence: 'In the close-up the quasar’s own Lyα, carried by the ribbon, has already drifted redward from the mark, leaving a pencil trail; the shadow was just written at the mark, on the same ribbon.' },
  { id: 'absorber-frame', beat: 5, n: 3,
    setup: S => { S.stage = 6; S.probeFrames = true; S.probeCompress = true; S.squeezeAnswers = true; S.frame = 'obs'; S.conceal = true; S.hideLine = true; },
    ask: 'Grab one shadow in the recorded forest and undo the stretch for the gas that wrote it: squeeze the spectrum back. Where does that shadow belong?',
    respond: 'wavelength', how: 'drag a shadow toward shorter wavelengths and let go where it belongs (or click the ruler)',
    expected: '1215.67 Å — back at Lyα', ok: a => Math.abs(a.lambda - 1215.67) < 40,
    reveal: S => { S.conceal = false; S.hideLine = false; S._fD0 = S._DNow; S._Dsq = null; S._fSince = App.t; S.frame = 'absorber'; },
    after: 'Back at exactly 1215.67 Å: that gas wrote its shadow at Lyα in its own frame, and undoing its stretch returns it there.',
    evidence: 'Every shadow was written at the 1215.67 Å mark and then stretched with the ribbon; squeezing the recorded spectrum undoes a stretch — the grabbed shadow slides back toward the mark.' },
  { id: 'quasar-frame', beat: 5, n: 4,
    setup: S => { S.stage = 6; S.probeFrames = true; S.probeCompress = true; S.showEmission = true; S.frame = 'obs'; S.hideLine = true; },
    ask: 'Squeeze the recorded spectrum into the quasar’s own frame (drag it toward shorter wavelengths; it stops there). Where does the forest of shadows sit?',
    respond: 'choice', options: ['blueward of the quasar’s Lyα (shorter wavelengths)', 'right on top of it', 'redward of it (longer wavelengths)', 'on both sides of it'],
    expected: 'blueward of the quasar’s Lyα', ok: a => a.choice === 0,
    reveal: S => { S.hideLine = false; S._fD0 = S._DNow; S._Dsq = null; S._fSince = App.t; S.frame = 'quasar'; },
    after: 'Blueward: every structure lies between us and the quasar, so the light had stretched less when the quasar emitted it than when the gas absorbed it.',
    evidence: 'The quasar’s own Lyα rides on the ribbon ahead of every shadow (from step 1 on); squeezing the whole spectrum moves the forest and that anchor together, so the forest stays on its blue side.' },
  { id: 'space-vs-spectrum', beat: 7, n: 5,
    setup: S => { S.stage = 3; S.conceal = true; },
    ask: 'If two pixels are close together in the spectrum, must the gas that made them be close together in space?',
    respond: 'choice', options: ['yes, always', 'no, not necessarily', 'only if the gas is hot'],
    expected: 'no, not necessarily', ok: a => a.choice === 1,
    reveal: S => { S.conceal = false; },
    after: 'Not necessarily: the gas’s own motion moves it in the spectrum. b and c sit apart in space but land almost on top of each other; dragging an arrow can even reverse their order.',
    evidence: 'The threads from real space to velocity space tilt and cross once own motions are switched on; b and c land together.' },
];

const LOG_KEY = 'lya.probes';
function saveLog() { try { localStorage.setItem(LOG_KEY, JSON.stringify(App.probe.log)); } catch (e) {} }

/** start one probe (by id) or the whole set ('all' / '1') */
export function startProbe(which) {
  const list = which === 'all' || which === '1' ? PROBES.slice() : PROBES.filter(p => p.id === which);
  if (!list.length) return;
  App.probe = { list, idx: 0, log: [], session: new Date().toISOString(), revealed: false, answer: null, t0: App.t };
  enterProbe();
}
function enterProbe() {
  const pr = App.probe.list[App.probe.idx], k = App.scenes.findIndex(sc => sc.n === pr.beat);
  App.probe.revealed = false; App.probe.answer = null; App.probe.t0 = App.t; App.probe.id = pr.id;
  go(k); pr.setup(App.state); const sc = App.scenes[App.i]; if (sc.afterHash) sc.afterHash(App.state); pr.setup(App.state);
  renderControls(); refreshMargin();
}
/** an answer given on the picture (e.g. a wavelength read off the ruler) */
export function probeAnswer(a) {
  const P_ = App.probe; if (!P_ || P_.revealed) return; const pr = P_.list[P_.idx]; if (pr.respond !== 'wavelength') return;
  P_.answer = a; refreshMargin();
}
function record(pr, a) { App.probe.log.push({ probe: pr.id, n: pr.n, answer: a, expected: pr.expected, matches_expected: !!pr.ok(a), seconds: +(App.t - App.probe.t0).toFixed(1), physics_open: App.adv, at: new Date().toISOString() }); saveLog(); }
function reveal() { const P_ = App.probe, pr = P_.list[P_.idx]; record(pr, P_.answer); P_.revealed = true; pr.reveal(App.state); renderControls(); refreshMargin(); }
function next() { const P_ = App.probe; if (P_.idx < P_.list.length - 1) { P_.idx++; enterProbe(); } else { P_.done = true; P_.revealed = true; refreshMargin(); } }
function download() { const blob = new Blob([JSON.stringify({ session: App.probe.session, responses: App.probe.log }, null, 1)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `lya-probe-responses-${App.probe.session.slice(0, 19).replace(/[:T]/g, '-')}.json`; a.click(); }

/** the probe panel in the margin: question, the way to answer, the reveal */
export function probeRender() {
  const el = document.getElementById('probe'); if (!el) return;
  const P_ = App.probe;
  if (!P_) { el.style.display = 'none'; el.innerHTML = ''; return; }
  el.style.display = 'block';
  if (P_.done) {
    el.innerHTML = `<p class="pq">That is the end of the review questions.</p>` + P_.log.map(r => `<p class="pa">${r.n}. your answer: ${typeof r.answer === 'object' && r.answer && r.answer.lambda != null ? fmtA(r.answer.lambda) + ' Å' : r.answer && r.answer.text ? r.answer.text : '—'}</p>`).join('') + `<button class="btn" id="psave">save the responses (JSON)</button>`;
    el.querySelector('#psave').onclick = download; return;
  }
  const pr = P_.list[P_.idx], a = P_.answer;
  let h = `<div class="pa">review question ${pr.n} of ${PROBES.length}</div><p class="pq">${pr.ask}</p>`;
  if (pr.respond === 'choice') h += `<div role="radiogroup" aria-label="answers">` + pr.options.map((o, i) => `<span class="popt ${a && a.choice === i ? 'on' : ''}" role="radio" tabindex="0" aria-checked="${a && a.choice === i}" data-i="${i}">${o}</span>`).join('') + `</div>`;
  else h += `<p class="pa">${a ? `your answer: ${fmtA(a.lambda)} Å — click again to change it` : pr.how + '.'}</p>`;
  if (a && !P_.revealed) h += `<button class="btn" id="preveal">show me</button>`;
  if (P_.revealed) h += `<p class="pq">${pr.after}</p><button class="btn" id="pnext">${P_.idx < P_.list.length - 1 ? 'next question →' : 'finish'}</button>`;
  el.innerHTML = h;
  el.querySelectorAll('.popt').forEach(s => { const pick = () => { if (P_.revealed) return; P_.answer = { choice: +s.dataset.i, text: pr.options[+s.dataset.i] }; refreshMargin(); }; s.onclick = pick; s.onkeydown = ev => { if (ev.key === ' ' || ev.key === 'Enter') { ev.preventDefault(); pick(); } }; });
  const rv = el.querySelector('#preveal'); if (rv) rv.onclick = reveal;
  const nx = el.querySelector('#pnext'); if (nx) nx.onclick = next;
}
export function installProbes() { App.hooks.startProbe = startProbe; App.hooks.probeRender = probeRender; App.hooks.probeAnswer = probeAnswer; }
