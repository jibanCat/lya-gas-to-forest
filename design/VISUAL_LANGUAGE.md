# Visual language: implementation spec (binding)

*2026-10-03. This file does not redesign anything. It writes down the Visual_LyA language as the approved canonical
prototype uses it, so that production code cannot drift. Material grammar (same day): §4a,
the physical-light exception (§8), the volume's edges (§9).*

- **Sources:**
  - Visual_LyA, the author's earlier Lyα visual language (its site tokens `--paper/--ink/--wash/--pool/--rust`);
  - this project's earlier language card, and its decisions on the paper colour and on rulers;
  - the approved canonical prototype (`experiments/canonical/`).
- **Rule for conflicts:** if engineering convenience conflicts with this file, this file wins.

The tokens below are the **single source** in `app/src/design/tokens.js`. `node app/build.mjs` fails if this table and
that file disagree.

---

## 1. Tokens

Contrast is WCAG 2 against paper `#FCFBF8`; 4.5 is the threshold for text.

| token | value | job | contrast | text? |
|---|---|---|---|---|
| `paper` | `#FCFBF8` | the page: a whiter notebook than Visual_LyA's `#F4F2ED` | — | — |
| `light` | `#FFFDF4` | light itself: the light-table ribbon, the quasar's light, inset grounds | — | — |
| `ink` | `#1F2732` | the simulation's truth: gas, computed τ, F; statements | 14.5 | yes |
| `pool` | `#0C121B` | saturated, where the light is gone (never `#000`) | 18.2 | yes |
| `graphite` | `#59616C` | rulers, secondary marks, secondary text | 6.1 | yes |
| `muted` | `#6F7278` | small labels, measurements, captions | 4.7 | yes (the lightest text allowed) |
| `pencil` | `#8E959D` | hypotheses, ghosts, counterfactuals, ticks | 2.9 | **no**: strokes only |
| `wash` | `#7D8DA3` | the shadow under a spectrum; τ as stain (fills at 15–35 %) | 3.3 | **no**: fills only |
| `faint` | `#C9CBCF` | inactive furniture, dashed baselines, far box edges | 1.6 | **no** |
| `hair` | `#D9D6CF` | separating hairline (equation rule, zero baselines) | 1.4 | **no** |
| `accent` (cinnabar) | `#B93A20` | **current causal focus or active selection only** | 5.5 | yes |
| `mist` | `#E6EBF1` | reserved (unused on screen) | — | no |
| `tintBlue` | `#4E5D73` | photon tint, bluer than Lyα (Beat 2 only): a slate grey within the ink family | — | no: strokes only |
| `tintRed` | `#6B5A55` | photon tint, redder than Lyα (Beat 2 only): an umber grey within the ink family | — | no: strokes only |
| `glow` | `#FFF3D8` | warm transmitted light: the backlight of the light table (Beat 10); its strength at each colour is the computed transmission e^−τ | — | no |
| `grain` | `#A68D63` | paper fibres, seen only where light passes through paper (Beat 10 halo), at 5–13 % | — | no |

### The cinnabar rule

Cinnabar marks the one thing being followed or acted on now:
- the selected parcel or structure;
- the probe;
- the pen that is writing;
- the active toggle state.

At most one focus at a time. Two cinnabar marks may appear together only when they are the same focus (for example,
a structure in real space and its shadow in the spectrum). Cinnabar never decorates, never fills a large area, and
never carries a category.

## 2. Type

| role | face | size / weight | colour |
|---|---|---|---|
| beat title | Fraunces | 26 px / 300, line 1.15 | ink |
| statement (one per beat, ≤ ~35 words) | Fraunces | 15.5 px / 300, line 1.42 | ink |
| on-figure sentence (one line, at most) | Fraunces | 18.5 px / 300 | ink |
| marginal / figure note | Fraunces italic | 13–15 px / 300 | graphite (or ink) |
| small label | Inter | 11–12.5 px / 300 | muted |
| measurement, tick label, id | IBM Plex Mono | 9–11 px / 400 | muted (ink when it is the reading) |
| equation (show the physics only) | KaTeX | 14 px | ink; its note in Inter 11.5 muted; its ids in Plex Mono 9.5 muted |

- Lowercase labels.
- Numbers in mono, with thin-space thousands (`4 863 Å`).
- No bullets on screen.
- Type develops in place: opacity plus a 2 px settle, 400 ms.
- Type is never animated by sliding or typing out.

## 3. Composition

- **Stage.** A 1440 × 880 design stage, scaled to fit.
  - The margin column is at x = 40–310: statement, controls, the "why?" links, then equations.
  - The figure field is x = 340–1410, y = 70–850.
  - Type sits in the margin column. On the figure there are only short notes attached to the thing they name.
- **No containers.** No card, panel, box, pill, badge, frame, border, drop shadow, rounded rectangle or toolbar.
  - Separate by space or by a single hairline.
  - The one exception is a microscope inset or magnifier, drawn as a hairline frame because it is a physical lens
    onto the figure.
- **One subject, asymmetric, with air.** Hold at least about 40 % untouched paper in a held frame. A spectrum may run to
  the edge.
- **Rulers only where the axis carries the lesson** (a deliberate departure from Visual_LyA's "no axes"):
  - x [comoving Mpc/h], u [km/s], Δv, λ [Å], t [ns].
  - Rulers are a graphite hairline (0.8 px) with 4 px ticks and mono tick labels; the label sits under the right end.
  - No grids, colour bars, legends in boxes, or axis triads.

## 4. Marks

| mark | treatment |
|---|---|
| gas (continuous) | ink pigment with alpha ∝ density (log), on paper; aerial perspective (farther is paler); soft edges; never emissive, never glowing |
| neutral atoms | ink dots, 2–3.4 px; their motion arrows are graphite hairlines; always labelled "representative atoms · not to scale" where they first appear |
| ionised majority | a pencil stipple, Beat 1 only |
| teaching parcel | a horizontal Gaussian smudge (ink; cinnabar when selected) |
| sampling cells | ruled strips (ink alpha per cell) with graphite rule lines |
| optical depth (ink) | ink deposited in velocity space; transparent layers stack |
| transmitted light | the `light` ribbon composited with ink at opacity 1 − e^−τ: the picture performs Beer–Lambert (SCI-REP-005) |
| spectrum | graphite or ink line, 1.1–1.6 px, with a wash fill at 15–22 % between continuum and flux; dashed faint continuum at F = 1 |
| velocity | arrows: graphite hairline for one kind (expansion = pencil), ink or cinnabar for the followed kind; one px-per-km/s scale per figure |
| hypothesis or ghost | pencil, dashed |
| depth cues (3D) | perspective, one slow drift on entry, back/front layering of the beam, aerial perspective (farther is paler); the gas dissolves into paper toward the sample's edges, with only short corner cues — no wireframe; the sample's boundary is drawn, labelled, only in "show the physics"; no glow, bloom, fog colour or vignette |
| transmitted light (Beat 10) | the `glow` backlight through the layered ribbon; the light that gets through also lights the paper around it, with a strength at each colour equal to the transmitted fraction e^−τ there (a saturated trough casts none), falling off within ~16 px; paper fibres (`grain`) only in that light, never inside the ribbon |

**Line weights:**
- 0.5–0.8 px: hairlines and rulers;
- 1.0–1.4 px: curves and arrows;
- 1.6–2.2 px: emphasis;
- nothing heavier.

**Dash patterns:** `[2,3]` for links and leaders, `[3,3]` for ghosts, `[2,4]` for baselines.

### 4a. Material grammar (Ink Forest's intuition, Visual_LyA's restraint)

A first encounter with a graph, histogram, spectrum or coordinate plot shows where it comes from: physical scene →
visible transformation → quantitative representation. Three gestures do this everywhere, so the app reads as one
language rather than several diagrams (`app/src/primitives/material.js`):

| gesture | what it means | where |
|---|---|---|
| **thread** (fibre) | a causal mapping: a hairline that leaves where something is and arrives, vertically, where it lands. Graphite; cinnabar only for the followed one; faded by weight so the topology shows and never a loom | Beat 3 atom → its speed; Beat 7 gas → velocity space; Beat 12 colour → the gas that absorbed it |
| **deposit** | ink arriving: darker at its rim while wet, then dry; accumulation builds density | Beat 3 marks on the speed ruler; Beat 7 ink landing; Beat 12 gas developing |
| **light** | transmission: warm only where light physically passes; its strength is the computed e^−τ | Beat 10 light table |

Every endpoint of a gesture comes from the scene's validated numbers, and every gesture that asserts physics is listed
with its claims in `design/canonical/BEATS.yaml` (`visual_transforms`) → `design/canonical/VISUAL_PROVENANCE.md`.
Motion has memory: a short pencil trail may record a drift (Beat 5 close-up), and transient threads fade once their
result has landed.

## 5. Motion

Animation shows matter and light transforming, not widgets updating.

1. **One verb at a time.** Move, then spread, then deepen; never two at once.
2. **Identity by continuity.** Things travel, stretch or deposit; they are never cut and replaced.
3. **Material easing:** cubic in-out, 0.6–1.8 s. Accumulation is near-linear.
4. **Nothing loops as decoration.**
   - Motion that *is* the physics may run: thermal motion of atoms, photons travelling, the light's journey.
   - Ambient sway or idle breathing may not.
   - Beat 0's parallax is a single slow drift on entry, which then holds.
5. **Hold after a reveal.**
6. **Reduced motion** (`prefers-reduced-motion`, or `#rm=1`).
   - Every animation resolves to its end state.
   - Thermal motion freezes, and the arrows carry the speeds.
   - The light's journey steps instead of gliding.
   - Nothing is lost except the motion itself.

## 6. Interaction

**The reader operates the physics, not the lesson.** Distinguish *physical state* (temperature, a parcel's velocity,
where the light is, the colour examined, the frame, the neutral amount) from *presentation state* (which step is
highlighted, whether a caption has appeared). The interface acts on physical state; presentation state exists for
first-use demonstrations, reproducible stills (URL steps), reduced motion and narration timing. If the reader can
manipulate a physical cause directly, a lesson-step button is never the primary interaction.

- **The physics is the interface.** Drag the light, a parcel's motion, the inspection loupe, the spectral cursor; hold the
  gas; touch a colour or a structure; move along the beam. Measurements follow.
- **Surface and advanced, deliberately.** On the surface path the physical action comes first and the reading follows.
  Explicit precision controls belong where they correspond to an instrument (a spectrograph's resolution and S/N, a
  magnification) or to controlled quantitative exploration ("show the physics", the microscopes), after intuition
  exists. Microscope controls never appear in the surface composition. Implicit interaction is used where it clarifies
  causal physics, not to eliminate sliders: where no gesture is physically honest — the amount of neutral hydrogen —
  the control stays explicit (an *instrument*: a quiet scale with a notch, a caption, the cause in the microscope).
- **One affordance grammar** (`app/src/primitives/affordance.js`), never chrome. Each scene lists its physical objects;
  the runtime draws one mark:

  | object | cursor | hover / keyboard focus | dragging | released |
  |---|---|---|---|---|
  | grab (the light, a velocity, the loupe) | grab → grabbing | a cinnabar hairline ring (r 9 px, 0.8 px) fades in, 120 ms | the ring tightens (r 6, 1.2 px) | fades out, 350 ms |
  | scan (a colour, a speed bin) | ew-resize | the ring sits on the cursor's handle | — | fades |
  | select (a structure, a region) | pointer | a cinnabar hairline under the region | solid | fades |

  Idle scenes and stills show none of it. Hit regions are larger than the visible marks (touch ×1.5); marks are never
  thickened to be easier to hit. Keyboard focus on the figure shows the same ring on the object the arrows act on.
- **A small gesture vocabulary** (every `interactions` entry names one, with its control law):

  | gesture | what the hand does | examples |
  |---|---|---|
  | hold | press and keep pressing a physical object; the state changes while held, and stays where released | hold the gas to explore warmer gas |
  | drag | move a physically meaningful thing; it stays under the hand where it was grabbed | the light, a parcel's motion, the loupe |
  | squeeze | pull a shadow back; the recorded spectrum compresses about 0 Å, naming the frame | undo the stretch ("show the physics", probes 3–4) |
  | trace | press a graph and slide along it; the cause follows | the spectrum → the gas that absorbed each colour |
  | dwell | rest on a graph or a region; a relation appears, the physics does not change | a speed bin's atoms; where a stretch of gas absorbs |
  | tap | choose | a structure; pin a dwell on touch |
  | set | an explicit instrument setting in the margin (a notch on a quiet scale), where no gesture is physically honest | Beat 6's neutral amount |

  One verb per gesture across the path: *move* changes a place (Beat 6's parcel along the beam), *push* changes a motion
  (Beat 2's atom, Beat 6's and Beat 7's parcels), *hold* explores warmer gas (Beats 3 and 6), *follow / move along* the
  beam (Beat 0), *trace* a colour (Beat 12).
- **One instrument, one implementation.** The same physical control in two beats is one piece of code and one control law:
  the push (`primitives/motion.js`: Beats 2, 6, 7) and the hold (`primitives/hold.js`: Beats 3, 6). A later beat's record
  `reuses` the first one's gesture, domain and bounds (checked by `build_provenance.py`); it may add a parameter (Beat 6's
  hold waits 0.25 s before warming, because the same gas can also be moved), never change one.

  Release lets a temporary causal overlay settle and fade.
- **Readouts, not controls.** Where a physical gesture exists, a bar or ruler reports what happened (a reading: a tick,
  not a knob; role "meter"); it moves while the hand acts. After the gesture is learned it may also take a precise
  value (two layers: physical first, precision after). Pressed before then, it points to the physical object.
- **First-use hints** are short physical verbs ("move along the beam", "hold the gas to explore warmer gas", "drag the light",
  "push the gas: drag its motion", "press the spectrum and slide", "hold a shadow and pull it back toward Lyα") in Fraunces italic, graphite, beside their
  object with one short hairline arrow; one at a time; once the gesture has been used they fade. Hints and
  first-encounter reveals are remembered **for the session** only: a new session sees the formations again,
  and a quiet replay is always available.
- **Gestures are control laws, not physics.** "Hold the gas to explore warmer gas" does not claim that touching gas heats it;
  each mapping is recorded as pedagogical in `INTERACTION_PROVENANCE.md`.
- **What changed, and what did not.** Where one object carries several degrees of freedom (Beat 6), the state before a
  gesture stays as a pencil ghost, a quiet ledger (place · motion · width · amount) marks which one changed, and a measured
  comparison (never typed) says what moved and what stayed.
- **Study sessions** (`#cold=1`, `docs/study/`): forget all onboarding, begin at Beat 0, hide provenance ids, and log
  interaction behaviour (never identity); the log is saved at the end or by the facilitator (Shift+L).
- **Timing: brief reveal → immediate control → replay on request.** A first encounter may animate a relationship once,
  in about 2–4 s; any touch or key hands the system to the reader at once; slower pedagogy is a "replay" on request.
  The reader never waits to change a quantity.
- **Graphs stay alive.** Where the mapping is meaningful, touching a graph shows its physical origin: a speed bin ↔ its
  atoms (Beat 3), a velocity ↔ the gas that lands there (Beat 7), a colour ↔ the layers its light crossed (Beat 10), a
  colour ↔ the gas that absorbed it and gas ↔ the colours it takes (Beat 12). Never a one-to-one map that the physics
  does not support.
- **Attention.** While a process forms, its layer leads and the others recede in opacity (toward pencil); after, the
  composition rebalances. No camera moves; nothing loops.
- **No fake intermediate physics.** Every scientifically meaningful intermediate state is a physical state, recomputed
  (a velocity, a temperature, a cursor position); allowed easing: opacity, fades, the wet → dry of a deposit, a thread's
  appearance, a mark's flight between two representations that land at exact values. Every control is an
  `interactions` entry in `design/canonical/BEATS.yaml` (→ `INTERACTION_PROVENANCE.md`).
- **Equivalence.** Every drag has a keyboard route acting on the same physical state; hover enrichment has a tap and a
  focus route; reduced motion keeps direct manipulation, drops travel and settling, and keeps causal traces.
- **Margin controls are quiet:** a reading is a hairline ruler with a tick (ARIA meter); an instrument setting is a pencil
  scale with a notch and an italic caption; a microscope's sweep is a hairline ruler with a bead (ARIA slider); serif
  text choices underlined when on, serif text buttons; no pills, filled buttons, icons or HUD. Every control declares its
  role, and `node app/audit.mjs` lists them all (`docs/SURFACE_AUDIT.md`); a ruler with no role fails it.

## 7. Layers

- **Surface.** The physical picture, one statement and at most one on-figure sentence.
- **"Show the physics."** Compact equations in the margin under a hairline, each with a one-line note and its ledger
  ids.
  - Precise frame language and caveats live here.
  - It may add one physical layer to the figure (the quasar's emission, reference spectra, extra controls), never a
    second lecture.
- **Microscope ("why?").** A paper sheet over the stage, with "← back to the story" in cinnabar. Return is exact.
- **Probe (review mode).** A quiet question in the margin; the answer is given by acting on the picture. No scores,
  points or badges.

## 8. Forbidden

The following are not allowed:
- dashboards;
- coloured panels, pills, chips, badges;
- heavy borders, cards, drop shadows, rounded rectangles, floating toolbars;
- saturated colour, a second hue, rainbow or viridis maps, colour bars;
- gradients, glow, bloom, starfields, lens flare, vignettes, **as decoration or UI**. A gradient, glow or illumination cue
  is allowed only when it directly encodes a physical light or material interaction, and its strength must come from the
  computed quantity (Beat 10: the halo ∝ e^−τ; ink softness = a parcel's Gaussian; a deposit's wet rim = arrival);
- dark sections (this app has none);
- generic icons;
- thick buttons;
- scroll-driven state;
- progress bars.

Also forbidden:
- **a wireframe or glowing simulation box** (the sample's boundary appears only in "show the physics", dashed and labelled);
- **a literal mountain or terrain;**
- **text in pencil, wash, faint or hair** (they fail contrast).

## 9. Recorded departures from Visual_LyA (approved)

| departure | where | why |
|---|---|---|
| whiter paper `#FCFBF8` | everywhere | "notebook / laboratory", not "record" (B8) |
| hairline rulers and axes | wherever an axis is the lesson | the axis is the lesson (B9) |
| small mono measurements and labels | figures | teaching needs readings; kept small and muted |
| equations | "show the physics" only | first-year default is the physical picture |
| margin controls | margin column | interactive app, not a talk |
| ~~faint hairline edges on the 3D volume~~ | — | **resolved:** the volume dissolves into paper, as Visual_LyA does; short corner cues only |
| a warm backlight with a halo | Beat 10 | **resolved:** physical light, not decoration — its strength is the transmitted fraction (§4, §8) |
| thermal motion that runs continuously | Beats 1, 3 | it is the physics (temperature is motion); frozen under reduced motion |

## 10. Guards in code

- `app/src/design/tokens.js` is the only place colours, fonts and the stage layout are defined; CSS custom properties
  are generated from it at boot.
- `Ink.text` and `Ink.mono` record any text drawn in a non-text token (pencil, wash, faint, hair). `node app/smoke.mjs`
  fails if any such text is drawn in any beat.
- `node app/build.mjs` checks this table against `tokens.js`, and fails on drift.
