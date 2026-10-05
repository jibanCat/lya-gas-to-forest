# Changelog

## v0.1.0 — first public release, 2026-10-05

**What it is.** Fourteen interactive scenes, from a beam of quasar light crossing continuous intergalactic gas to the
Lyman-α forest and the limits of reading it back:
- atomic resonance;
- thermal and natural line widths;
- cosmological redshift;
- real space against velocity space;
- optical depth and transmitted flux;
- saturation;
- a spectrograph's resolution and noise;
- the inverse problem.

The last scene separates differences hidden by noise from differences hydrogen cannot record at all.

**Validated science.**
- Every claim is traced to sources at exact locations, with assumptions, validity domains and teaching
  simplifications, on a sources sheet per scene and in the science notes.
- The physics is checked by automated tests against independent calculations: SciPy's Faddeeva function, exact-Voigt
  sums, distance integrals, and the fake_spectra code within a declared domain.
- No accuracy number is typed by hand.

**Who computes what.** Every scientific quantity has a computation record:
- who computes it (this app, an external package, both, or a teaching visualization);
- its equation, variables, constants and their sources, assumptions and numerical method;
- its implementation and its independent check.

Each calculation the app implements has a short, independent Python reproduction (`reproduce/`, NumPy and SciPy),
shown under "show the physics" and checked against the app's own values by the release gate.

**Reading straight through.** "← previous" and "next →" never move: one place on the screen turns every page, from the
first scene to the last and back, with mouse, touch or keyboard.

**A guided tour.** Tap any empty space, or "continue ›" under "show the physics", and the story moves on like a
slideshow: each tap plays the next slide of the scene — a step, or one variation acted out with the scene's own controls
and physics (warmer gas, a pushed parcel, a finer cut, a noisier spectrograph) — then the next scene. A line names what
each slide shows and where the reader is. A tap during an animation goes straight on; touching anything in the figure
hands it to the reader. Every scene's slides are checked by `app/tour_check.mjs`.

**Browsers and devices.** Designed for tablets in landscape and larger screens, with mouse, touch or keyboard. See
`docs/BROWSERS.md` for the tested environments.

**Known limitations.** See the README: the screen size, the synthetic toy data, the isolated teaching controls, the
constructed inverse examples, and the fact that this is not a general-purpose modelling package.
