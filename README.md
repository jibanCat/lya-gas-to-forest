# Lyα: from gas to forest

An interactive, browser-based teaching resource on how neutral hydrogen between a distant quasar and us becomes the
**Lyman-α forest**: the dense pattern of absorption lines in quasar spectra that cosmologists use to map the
intergalactic gas.

**Version 0.1.0** · <!-- release:site -->**Live site:** available after the v0.1 deployment, at `https://jibancat.github.io/lya-gas-to-forest/`<!-- /release:site -->

## Who it is for

It is written for first-year university students, majors and non-majors, and for curious learners from secondary
school up.
- Every scene can be explored without equations.
- An optional **show the physics** layer adds the equations.
- **why?** panels explore one variable at a time.
- Researchers and teachers can follow every scientific claim to its sources.

## What it teaches

There are fourteen scenes. Each is explored by acting on the figure directly: hold the gas, drag the light, press the
spectrum and slide.

| | scene | | scene |
|---|---|---|---|
| 0 | Gas occupies real space | 7 | Distance and observed colour are not the same coordinate |
| 1 | Same gas, different scale | 8 | From parcels back to a continuous sightline |
| 2 | One atom meets one colour | 9 | Ink adds (optical depths add) |
| 3 | Temperature becomes line width | 10 | Light multiplies (F = e^−τ; saturation) |
| 4 | The atom's lifetime leaves faint, far wings | 11 | A forest emerges (an instrument records it) |
| 5 | The same colour, stretched (redshift) | 12 | Who ate this colour? (reading the spectrum backward) |
| 6 | Where does one parcel land? | 13 | Same shadow (what a spectrum cannot tell apart, and why) |

The story runs as one argument:
- a beam of quasar light crosses continuous intergalactic gas, in which only rare neutral hydrogen atoms absorb;
- each atom takes out one colour in its own frame, heat widens the line, and the atom's short lifetime adds faint wings;
- the expanding universe stretches every shadow on its way to us, so observed colour becomes velocity, not distance;
- optical depths add while the transmitted light multiplies, and a forest emerges;
- read backwards, a spectrum is inference, not decoding: the last scene separates differences hidden by noise from
  differences the light does not record at all.

Any scene can be linked directly, for example `…/#beat=7`.

## Run it

The built site is in `app/dist/`. Open `app/dist/index.html`, or `lya.html`, in a browser. It is a single
self-contained page with its fonts and data inside, so it works offline.

To build from source you need Node.js ≥ 20 and Python 3 with PyYAML:

```
npm run build        # provenance (science/tools/build_provenance.py) → app (app/build.mjs) → app/dist/
npm run validate     # the release gate (tools/validate.sh)
```

The gate checks:
- that the build reproduces the committed site;
- the science tests, the provenance and the links and licences;
- the browser checks: every scene, touch, accessibility and Firefox.

It needs Playwright 1.63 installed globally with its browsers: `npm i -g playwright@1.63.0 && npx playwright install`.

## Browsers and devices

Version 0.1 is designed for **tablets in landscape and larger screens**, with mouse, trackpad, touch or keyboard.
Narrow phone screens show a short recommendation, with "continue anyway". A phone layout is planned for v0.2.

Tested for this release:
- Chromium 153 (Playwright 1.63): every scene, touch, keyboard, accessibility and reduced motion;
- Google Chrome 154 on macOS 14.6: the same checks;
- Firefox 117 on macOS 14.6: every scene, the sources sheets and the science notes;
- Safari 17.6 on macOS 14.6: every scene, the science notes, navigation, keyboard focus, the sources sheet, the main
  gestures, session state and reload.

Not yet confirmed: Safari on iPad. `docs/BROWSERS.md` has the exact matrix.

**Accessibility:**
- keyboard accessible, with a visible focus mark;
- touch tested;
- honours reduced motion;
- browser zoom enlarges the page;
- every canvas figure has a live text description of its setup and state for screen readers.

Some small visual marks rely on larger invisible hit areas. The app has not been through a formal WCAG conformance
review or a specialist screen-reader evaluation.

## Science and sources

Every scene has a quiet **sources & assumptions** link. It opens the scene's:
- claims;
- key equations;
- teaching simplifications;
- sources (author, year, exact section or table, with DOI, ADS or arXiv links);
- assumptions and validity domains;
- how the app's numbers were checked.

The **science notes** (`science/`) gather every claim at a stable address, for example
`science/#thermal-doppler-broadening` or `science/#beer-lambert`. They also list what the app does not model.

All of this is generated from one source of truth:
- `science/SCIENCE_LEDGER.yaml`: claims, equations, conventions, assumptions and sources;
- `science/REFERENCES.yaml`: the bibliography, with how each location was verified;
- the validation reports in `science/validation/`.

## How the science is validated

The app's physics (`science/js/lyaphys.js`) is checked by automated tests (`science/tests/`) against independent
calculations:
- SciPy's Faddeeva function;
- exact-Voigt optical-depth sums;
- numerical distance integrals;
- the `fake_spectra` code, within a declared domain.

The measured results appear in the science notes and in `science/validation/VALIDATION_SUMMARY.md`. No number about
accuracy is typed by hand: the build fails if a public number does not come from a validation report.

## Data

The app uses only a small **synthetic** toy data set: a Zel'dovich-approximation volume at z = 3 and one sightline
through it, generated by `science/data/toy/zeldovich3d.py`. It contains no survey or simulation-suite data.
`docs/DATA.md` lists every data file with its origin, checksum and terms.

## Known limitations

- **Screen size.** Version 0.1 is designed for tablet and larger screens; narrow phones are not laid out for (v0.2).
- **Slow networks.** The app is one self-contained page (1.3 MB gzip); on a slow 4G connection the first load takes
  about 7 s.
- **Toy data.** The sightlines are a synthetic toy, not a public simulation-data release. The toy's ultraviolet
  background is tuned to the observed mean transmission, and is declared where it appears.
- **Isolated controls.** The physical controls each change one quantity, for teaching. For example, warming a parcel
  holds its neutral amount fixed, which real gas would not.
- **Constructed inverse examples.** The "same shadow" gases are a constructed example, not typical forest absorbers.
- **Scope.** This is not a general-purpose Lyα forward-modelling package.

## Cite

See `CITATION.cff`; GitHub shows a "Cite this repository" button.

## Licence
<!-- release:licence -->
- **Code:** MIT (`LICENSE`).
- **Original educational text and original teaching visuals:** CC BY 4.0 (`LICENSE-CONTENT.md`).
- **Synthetic toy data created by this project:** CC0 1.0 (`LICENSE-DATA.md`).

Third-party fonts and KaTeX keep their own licences (`THIRD_PARTY_LICENSES.md`).
Cited literature, published constants and other third-party material are not covered by these licences.
<!-- /release:licence -->

## Repository layout

| path | contents |
|---|---|
| `app/` | the app: scenes (`src/`), build (`build.mjs`), vendored fonts and KaTeX (`vendor/`), the built site (`dist/`), browser checks |
| `science/` | ledger, references, the app's physics, toy data, oracles, tests, validation reports |
| `design/canonical/` | the scene manifest (`BEATS.yaml`) and the provenance generated from it |
| `design/VISUAL_LANGUAGE.md` | the visual and interaction language (the build checks the design tokens against it) |
| `docs/` | the data record, the browser matrix, the generated control audit, the study protocol |
| `tools/` | the release gate, the export and hygiene tools, and the release finalizer |
