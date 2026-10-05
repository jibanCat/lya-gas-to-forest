/* "Sources & assumptions": each scene's public provenance, as a quiet paper sheet (like a microscope) opened from a small
 * link in the margin. Its content is generated from the ledger, the reference registry and the validation reports
 * (science/tools/build_provenance.py → public_provenance.json, embedded by the build); nothing here is typed. Links go to
 * the public science notes (science/index.html#anchor), which open beside the app. Internal ids never appear as text. */
import { App } from './app.js';

const srcEsc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const NOTES = 'science/index.html';
const noteHref = a => `href="${NOTES}#${a}" target="_blank" rel="noopener"`;
/** public text: [[#anchor|label]] → a link into the science notes */
const srcRich = t => srcEsc(t).replace(/\[\[#([a-z0-9-]+)\|([^\]]+)\]\]/g, (m, a, l) => `<a ${noteHref(a)}>${l}</a>`);
const srcTex = s => { try { return window.katex.renderToString(s, { throwOnError: false, displayMode: true }); } catch (e) { return srcEsc(s); } };

export function sourcesHTML(n) {
  const P = window.LYA_DATA.prov, b = P.beats[String(n)];
  if (!b) return '';
  const refBy = Object.fromEntries(Object.values(P.references).map(r => [r.anchor, r])), valBy = Object.fromEntries(Object.values(P.validations).map(v => [v.anchor, v]));
  const sec = (h, body) => body ? `<section><h3>${h}</h3>${body}</section>` : '';
  const list = xs => xs.length ? `<ul>${xs.join('')}</ul>` : '';
  const eqs = b.equations.filter(q => q.tex).map(q => `<div class="seq">${srcTex(q.tex)}${q.note ? `<p class="snote">${srcRich(q.note)}</p>` : ''}</div>`).join('');
  const srcs = b.sources.map(s => { const r = refBy[s.ref], locs = [...new Set(s.locations.map(l => l.location).filter(Boolean))];
    return `<li><a ${noteHref(r.anchor)}>${srcEsc(r.short)}</a>${locs.length ? `<span class="sloc">${locs.map(srcEsc).join(' · ')}</span>` : ''}${r.links.filter(l => l.href).length ? `<span class="slinks">${r.links.filter(l => l.href).map(l => `<a href="${srcEsc(l.href)}" target="_blank" rel="noopener">${srcEsc(l.label)}</a>`).join(' · ')}</span>` : ''}</li>`; });
  const checks = b.validations.map(a => { const v = valBy[a]; return `<li><a ${noteHref(a)}>${srcEsc(v.name)}</a> <span class="sstat">${srcEsc(v.status)}</span><span class="smeas">${srcRich(v.measured)}</span></li>`; });
  return `<div class="scol"><div class="stag">sources &amp; assumptions</div><h2 id="srct">${srcEsc(b.title)}</h2>
<p class="sclaim">${srcRich(b.claim)}</p>
<p class="smore"><a ${noteHref('scenes')}>all science notes, by scene →</a></p><p class="sver">science notes v${srcEsc(P.site.version)}</p></div>
<div class="scol">${sec('Key equations', eqs)}${sec('Teaching simplifications', list(b.simplifications.map(x => `<li>${srcRich(x)}</li>`)))}${sec('How the numbers are checked', list(checks))}</div>
<div class="scol">${sec('Sources', list(srcs))}${sec('Claims, their assumptions and validity', list(b.entries.map(e => `<li><a ${noteHref(e.anchor)}>${srcEsc(e.title)}</a>${e.representation ? '<span class="srep">a teaching representation, not physics</span>' : ''}${e.assumptions.length || e.validity ? `<span class="sass">${[...e.assumptions.map(srcRich), ...(e.validity ? [`valid for: ${srcRich(e.validity)}`] : [])].join('; ')}</span>` : ''}</li>`)))}</div>`;
}
let back = null;
export function openSources() {
  const el = document.getElementById('srcp'); App.sources = true; back = document.activeElement;
  document.getElementById('srcbody').innerHTML = sourcesHTML(App.scenes[App.i].n); el.classList.remove('hidden'); el.scrollTop = 0;
  document.getElementById('srcback').focus(); App.hooks.onSources && App.hooks.onSources(true);
}
export function closeSources() {
  const el = document.getElementById('srcp'); if (!App.sources) return; App.sources = false; el.classList.add('hidden');
  App.hooks.onSources && App.hooks.onSources(false);
  const l = document.querySelector('[data-fk="src"]'); (l || back || document.body).focus && (l || back).focus();
}
