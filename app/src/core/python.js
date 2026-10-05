/* "Reproduce in Python": the third layer, under "show the physics". For each calculation this scene shows, a short,
 * independent reproduction of the equation in Python (NumPy, SciPy), its expected output, and links to the full script
 * and to how the quantity is computed. The code is only displayed and copied — nothing runs here; the reader runs it in
 * their own Python. Its content comes from the computation inventory (science/COMPUTATION_INVENTORY.yaml → public
 * provenance, embedded by the build); the expected output is the app's own value, checked by reproduce/check.py. */
import { App } from './app.js';

const pyEsc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const PY_NOTES = 'science/index.html';
const PY_OWNER = { lya_app: 'computed by this app (lya_app)', hybrid: 'computed by this app; checked against an external code' };

/** the reproductions for one scene: one block per script, naming every calculation it reproduces */
export function pythonFor(n) {
  const P = window.LYA_DATA.prov, by = new Map();
  for (const c of Object.values(P.computations || {})) {
    if (!c.python || !c.beats.includes(n)) continue;
    const k = c.python.script; if (!by.has(k)) by.set(k, { python: c.python, comps: [] }); by.get(k).comps.push(c);
  }
  return [...by.values()];
}
export function pythonHTML(n) {
  const P = window.LYA_DATA.prov, repo = P.site.repository, blocks = pythonFor(n), b = P.beats[String(n)];
  const body = blocks.map(({ python: p, comps }, i) => `<section class="pyblock">
<h3>${comps.map(c => `<a href="${PY_NOTES}#${c.anchor}" target="_blank" rel="noopener">${pyEsc(c.title)}</a>`).join(' · ')}</h3>
<p class="powner">${[...new Set(comps.map(c => PY_OWNER[c.owner] + (c.reference ? `: ${pyEsc(c.reference.package)} ${pyEsc(c.reference.version)}` : '')))].join(' · ')}</p>
${p.note ? `<p class="pnote">${pyEsc(p.note.replace(/\[\[#[a-z0-9-]+\|([^\]]+)\]\]/g, '$1'))}</p>` : ''}
<div class="pcode"><button class="pcopy" data-i="${i}" aria-label="copy this code">copy</button><pre><code>${pyEsc(p.snippet)}</code></pre></div>
<p class="plabel">expected output</p><pre class="pout">${pyEsc(p.expected.join('\n'))}</pre>
<p class="plinks">${repo ? `<a href="${pyEsc(repo)}/blob/main/${pyEsc(p.script)}" target="_blank" rel="noopener">view the full reproduction script →</a> · ` : `<code>${pyEsc(p.script)}</code> · `}<a href="${PY_NOTES}#${comps[0].anchor}" target="_blank" rel="noopener">how it is computed →</a></p>
</section>`).join('');
  return `<div class="pyhead"><div class="stag">reproduce in Python</div><h2 id="pyt">${pyEsc(b ? b.title : '')}</h2>
<p class="pintro">Each block reproduces, independently, the equation the app uses for this scene — in a few lines of Python with NumPy and SciPy. Copy it into your own Python, a notebook or Colab: nothing runs here. The expected output is the app's own value; an automated check confirms that each block prints it.</p></div>${body}`;
}
let pyBack = null, pyCodes = [];
export function openPython() {
  const el = document.getElementById('pyp'); App.python = true; pyBack = document.activeElement;
  pyCodes = pythonFor(App.scenes[App.i].n).map(x => x.python.snippet);
  document.getElementById('pybody').innerHTML = pythonHTML(App.scenes[App.i].n); el.classList.remove('hidden'); el.scrollTop = 0;
  for (const b of el.querySelectorAll('.pcopy')) b.onclick = () => pyCopy(pyCodes[+b.dataset.i], b);
  const t = document.querySelector('.pylink'); if (t) t.setAttribute('aria-expanded', 'true');
  document.getElementById('pyback').focus();
}
export function closePython(restore = true) {
  const el = document.getElementById('pyp'); if (!App.python) return; App.python = false; el.classList.add('hidden');
  const t = document.querySelector('.pylink'); if (t) t.setAttribute('aria-expanded', 'false');
  if (!restore) return;   // leaving the scene: focus stays where the reader is going
  if (t) t.focus(); else if (pyBack && pyBack.focus) pyBack.focus();
}
function pyCopy(text, btn) {
  const done = ok => { btn.textContent = ok ? 'copied' : 'select and copy'; setTimeout(() => { btn.textContent = 'copy'; }, 1600); };
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(() => done(true), () => done(pyFallback(text)));
  else done(pyFallback(text));
}
function pyFallback(text) {   // where the clipboard API is unavailable: a hidden text area and the browser's own copy
  const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (e) {} ta.remove(); return ok;
}
