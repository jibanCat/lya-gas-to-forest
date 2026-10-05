# Study session log: schema `lya-study/1`

The log is written by `app/src/review/session.js` during a study session (`#cold=1`). It records interaction behaviour,
never identity:
- **Not recorded:** names, free text, typed input, user-agent string, IP address or location, and any data from other
  sites.
- **Kept:** the log stays in the tab's session storage until the facilitator saves it as JSON. It leaves the device only
  when the facilitator chooses to send that file.

Times are seconds on the session's own clock: from the start of the session, continued across a reload from the last
logged event.

## Session

| field | meaning |
|---|---|
| `schema` | `lya-study/1` |
| `on` | true while a study session runs |
| `app_version` | the app version the session ran on (from the page's `lya-version`); `version_changed: true` appears if a reload brought a different build |
| `started` | date and time to the minute, local (`YYYY-MM-DDTHH:MM`) |
| `viewport` | `{w, h, dpr}`, window size in CSS px and device pixel ratio (a device class, not an identifier) |
| `motion_reduced` | whether the system asks for reduced motion |
| `input` | presses on the figure, by pointer type: `{mouse, touch, pen}` |
| `reloads` | how many times the tab was reloaded (the session resumed each time) |
| `visits` | one entry per beat visit, in order (below) |
| `t_last` | the session clock at the last event |
| `saved_at_beat` | in a saved file: the beat open when it was saved |

## Visit (one per beat entered)

| field | meaning |
|---|---|
| `beat`, `slug` | which beat |
| `entered_t` | session clock when it was entered |
| `from_beat`, `direction`, `via`, `skipped` | navigation: the previous beat; `forward` / `back` / `start`; `arrow` (the “← previous” / “next: … →” links), `beat number` (the top row) or `key`; how many beats were jumped over |
| `first_interaction_s`, `first_interaction_kind` | seconds from entering to the first interaction, and its kind: `object` (hovering or pressing a physical object in the figure), `key` (a key on the figure) or `margin` (an instrument, a step, a replay, or a reading pressed) |
| `first_success_s` | seconds to the first gesture the app counts as learned (it did what the gesture is for) |
| `presses` | presses on the figure |
| `dead_taps` | presses that hit no physical object, on a beat that has physical objects |
| `gestures` | presses on physical objects, by kind: `hold`, `grab` (drag / push / move), `scan` (trace / dwell), `select` (tap) |
| `hints` | `[{key, shown_s}]`: each first-use hint and when it first appeared |
| `learned` | `[{key, s, after_hint_s}]`: each gesture learned, when, and how long after its hint appeared (**hint-to-success latency**; null if it was found before its hint) |
| `readings_pressed` | `[{label, s}]`: a margin reading pressed as if it were a slider (it points back to the physical object) |
| `settings` | `[{label, role, s}]`: margin rulers set by hand (an instrument such as the neutral amount, or a reading made precise after discovery); one entry per continuous use |
| `replays`, `resets` | `[{label, s}]`: quiet replays used, and resets (“back to the toy’s parcel”, “the toy’s velocities”) |
| `other_controls` | `[{label, role, s}]`: steps, views, baselines, toggles |
| `physics` | `[{on, s}]`: “show the physics” opened or closed |
| `microscopes` | `[{key, s}]`: “why?” microscopes opened |
| `sources` | `[{s}]`: the “sources & assumptions” sheet opened (its link to the science notes leaves the app and is not logged) |
| `keys` | keys used on the figure |
| `duration_s` | time spent in the visit (null for the visit still open; a live read adds `now_s`) |

## Hint keys

| beat | keys, in the order hints appear |
|---|---|
| 0 | `b0.beam` (move along the beam), `b0.turn` (drag the gas to turn it) |
| 2 | `b2.push` (push the atom: drag its motion) |
| 3 | `b3.warm` (hold the gas to explore warmer gas), `b3.cool` (hold and drag down: cooler gas), `b3.census` (touch the census) |
| 5 | `b5.light` (drag the light), `b5.select` (select another structure), and with “show the physics” `b5.squeeze` (hold a shadow and pull it back toward Lyα) |
| 6 | `b6.place` (move the gas along the beam), `b6.motion` (push it: drag its motion), `b6.warm` (hold the gas…), `b6.cool` |
| 7 | `b7.vpec` (push it: drag its velocity arrow) |
| 10 | `b10.loupe` (hold another part of the sheet to the light) |
| 12 | `b12.scan` (press the spectrum and slide: who ate each colour?) |
| 13 | `b13.pick` (choose the gas you think made this shadow) |

## Reading it

- **Discoverability:**
  - no `first_interaction_s`;
  - `dead_taps` and `readings_pressed` before the first success;
  - a long `after_hint_s`.
- **Pacing:** short `duration_s` with no `first_interaction_s`, or a `forward` move while a reveal is running.
- **Navigation:** `skipped` and `back` show where people jump or return.

The talk-aloud notes carry what the log cannot: what people thought they were doing.
