# app/ — the production implementation

The canonical path (Beats 0–13), rebuilt outside `experiments/` as authored scientific scenes on shared primitives. The
review prototype in `experiments/canonical/` is now history and design evidence; nothing here imports it.

## Build, open, test

```
python3 science/tools/build_provenance.py   # manifest + ledger → design/canonical/beats.json (fills report numbers)
node app/build.mjs                          # app/src → app/dist/lya.html (one self-contained page)
node app/smoke.mjs                          # every beat, control, key, microscope, probe; reduced motion; design guard
node app/shoot.mjs design/production/frames --list app/shots.txt          # reproducible stills
node app/record.mjs <dir> 15 [route]        # surface (a fresh study session, 0 → 13) | b0 | b3 | b6 | b7 | b10 | b12 | agency | cold (frames; encode with ffmpeg)
node app/audit.mjs                          # every surface control, classified by its declared role → docs/SURFACE_AUDIT.md (fails on a generic slider)
node app/study.mjs <dir>                    # the study session mode (#cold=1) end to end: Beat 0 start, no ids, telemetry, reload, export
node app/shoot.mjs design/coherence/shots --list app/coherence_shots.txt && python3 app/coherence_sheets.py   # Beat 6 synthesis; surface coherence
node app/touch.mjs <dir>                    # the direct manipulations with real touch input, each checked on the physical state
node app/sequence.mjs design/implicit/seq app/implicit.json && python3 app/implicit_sheets.py   # cold start → hint → gesture → reading, per interaction
node app/perf.mjs <out.json>                # frame rate and per-frame cost of each drag; the exact physics timed alone
node app/shoot.mjs design/interaction/aff --list app/affordances.txt && python3 app/interaction_sheets.py   # the interaction grammar sheet
node app/sequence.mjs <dir> app/transforms.json   # transformations in progress, on a virtual clock (review sheets)
python3 app/material_sheets.py              # the material-pass review sheets (design/material/)
```

Open `app/dist/lya.html` by double-click; it works offline. For a naïve-user study session open it in a new tab with
`#cold=1` (`docs/study/STUDY_PROTOCOL.md`). It:
- forgets every hint and reveal and begins at Beat 0;
- hides provenance ids;
- logs interaction behaviour, never identity (`docs/study/TELEMETRY.md`, `src/review/session.js`).

A reload resumes the session. The log is saved from a quiet link at the last beat, or with Shift+L. Fonts and KaTeX are vendored in `app/vendor/` (licences
and checksums in `app/vendor/VENDOR.md`) and inlined by the build.

**URLs.** Every view is a URL:
- `#beat=5&stage=3`;
- `&adv=1` for "show the physics";
- `&micro=lifetime` for a microscope;
- `&probe=all` for the review questions;
- `&rm=1` to force reduced motion.

## Structure: scenes, not generic components

| layer | where | what |
|---|---|---|
| physics | `science/js/lyaphys.js` (embedded unchanged) via `src/physics/lya.js` | every constant and transform; validated by `science/tests` |
| canonical data | `science/data/toy/` (skewer, slab, the producer's reference τ), `science/validation/degeneracy/configs.json` | the declared toy (SCI-SIM-TOY-001); dataset-independent interface (SCI-SIM-001) |
| manifest | `design/canonical/BEATS.yaml` → `beats.json` | titles, statements, steps, equations, science ids. Scenes never type these |
| design | `src/design/tokens.js`, `src/design/ink.js` | the only colours, fonts and drawing vocabulary (`design/VISUAL_LANGUAGE.md`) |
| runtime | `src/core/` | state and URL, quiet accessible controls, narration, microscope with exact return, keyboard, live description, frame loop |
| primitives | `src/primitives/` | the 3D volume, the sightline and teaching window, atoms, the forest axes, the material grammar (`material.js`: threads, deposits, paper fibres) and the affordance grammar (`affordance.js`: the one hover/focus/drag mark, hit regions, first-use hints) |
| scenes | `src/scenes/b00…b13` | one authored module per beat: drawing, interaction, keys, accessible description, microscopes |
| probes | `src/probes/probes.js` | the five comprehension probes (review mode) |

### Scene contract

```
{ n, slug, persist, controls, init(S), afterHash(S), draw(g, S, t), onPointer(type, p, S),
  onKey(key, S) → handled?, describe(S) → text, keys: text, micro: { … }, foot,
  checks: { name: () → { pass, … } },      // pixel checks that the picture performs its claim (smoke → VAL-REND-001)
  affordances(S) → [{ id, kind: grab|scan|select|hold, int, at, hit, bracket?, ellipse?, cursor?, mark?, name?, hint? }],
  kbTarget(S) → id, kbLearns }               // int: the object's INT record(s); kbLearns: the scene judges keyboard learning
controls: [{ type: ruler|choice|button|toggle, role, why, int, caption?, readout?, operable?, … }]
  // role: readout | instrument | advanced | step | replay | reset | baseline | view | representation | counterfactual
  // why: the stated reason for any control that is not a reading (the audit fails without one)
```

**One instrument, one implementation.** A push of a motion (`primitives/motion.js`: Beats 2, 6, 7) and a hold that
explores warmer gas (`primitives/hold.js`: Beats 3, 6) are shared code with one control law each, read from the manifest;
a later beat's record `reuses` the first (checked by `build_provenance.py`). A parcel's optical depth is one composition
(`lyaphys parcelTau`), and Beat 6's comparison is measured by `lyaphys lineMoments` (VAL-ORTH-001).

**Readouts follow the hand.** A ruler control may be `readout: true`: a reading (a tick, role "meter") that the runtime
keeps in sync with the physical state every frame; `operable(S)` lets it take a precise value once the physical
gesture has been learned (or with "show the physics"). Hints and first-encounter reveals are session-scoped
(`onboarded` / `markOnboarded` in `primitives/affordance.js`).

**Physical state, not lesson steps.** Scenes expose their physical objects through `affordances`; the runtime finds the
object under the pointer (larger hit regions, ×1.5 for touch), sets the cursor, draws the one affordance mark (hover,
keyboard focus, dragging, released), shows a first-use hint until the gesture is used, and passes the object id to the
scene as `p.aff`. Every control that changes or inspects physics is an `interactions` entry in `BEATS.yaml` (variable,
domain, validated function, claims, validation; `design/canonical/INTERACTION_PROVENANCE.md`); scenes read their
domains from it (`interaction(n, id)` in `core/meta.js`).

Every gesture that asserts physics is a `visual_transforms` entry in `design/canonical/BEATS.yaml` (claims, what
computes it, what draws it, thresholds); the provenance build checks that the files and symbols exist. Display
thresholds (e.g. Beat 12's) are read from there, never typed in a scene.

### Bundler

The bundler (`build.mjs`) is dependency-free:
- ES modules with named imports only;
- one shared scope;
- duplicate top-level names fail the build;
- an import that names something its module does not export fails the build.

## Guards (the build or the smoke test fails)

- **Tokens.** `tokens.js` must equal the token table in `design/VISUAL_LANGUAGE.md`.
- **Text colours.** No text may be drawn in a non-text token (pencil, wash, faint, hair); text tokens are ≥ 4.5 : 1 on
  paper.
- **Scenes.** Every scene module's `n` and `slug` must match the manifest.
- **Implementation files.** Every implementation file the science ledger names must exist
  (`science/tools/build_provenance.py`).
- **Runtime.** No console errors in any beat, in normal or reduced motion. Microscopes must return to exactly the
  state they left. Probes 3–4 squeeze correctly. Scene checks pass (Beat 10's ribbon equals e^−τ pixel by pixel).
- **Visual provenance.** Every `visual_transforms` entry names known claims (in the beat's science list), existing files
  and symbols, and known validations.
- **Offline.** The build fails if a vendored stylesheet still points at the network.

## Conventions

- **Provenance.** Scenes take numbers from `lyaphys`, the toy data or the embedded validation reports (`report(id)` in
  `core/meta.js`), never typed copies. A change to a scientific transformation means changing the ledger entry,
  re-running its oracle and test, then regenerating (production brief §11).
- **Motion.**
  - Animations resolve to their end state under `prefers-reduced-motion` or `#rm=1`.
  - Physical motion that *is* the content runs only when motion is allowed: thermal motion, travelling light.
  - Nothing loops as decoration.
- **Interaction.** The figure is focusable; arrow keys act on the physical object (each scene's `keys` text says
  how). Margin controls are ARIA sliders, radio groups, switches and buttons, styled as quiet text and hairlines.
- **Performance.** Repeated pure computations are memoised on their exact inputs: per-parcel τ, window kernels, the
  backlit ribbon. The numbers are identical; only the speed changes.
