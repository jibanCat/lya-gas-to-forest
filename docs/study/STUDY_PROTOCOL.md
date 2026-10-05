# Naïve-user study: protocol

**Aim.** This is a diagnostic test of the frozen surface interaction design, with 2–3 first-time users. It asks three
questions:
- Can people find the physical interactions?
- Do they read the right variable into each one?
- Can they explain the physics afterwards?

It is not a performance study, and nothing is scored on screen.

**Freeze.** The surface interaction design is frozen at the commit that adds this file. Between participants the app does
not change, with two exceptions (see *Deciding what to change*):
- a blocking defect;
- a severe science misconception.

## Before the session

1. Use the participant's usual kind of device if possible (laptop with trackpad or mouse, or a tablet). Note which.
2. Open **a new browser tab** at `app/dist/lya.html#cold=1`. The file works offline. A new tab means a new session:
   - it forgets every hint and reveal;
   - it begins at Beat 0;
   - it shows no provenance ids.

   Make the window full screen and close other tabs.
3. Ask for verbal consent to take notes on what they do and say. Record no names. Use a participant code (P1, P2, P3)
   on your notes only; the app's log contains no identity.
4. Start a timer when they first see the screen. Your notes use its times; the log uses its own clock from the same
   moment, approximately.

## The opening instruction (say it, then stop)

> “Explore this on your own. Please say out loud what you think is happening and what you think you can interact with.”

## During the session

- **Do not teach gestures.** Never demonstrate, point at, or name an interaction. Do not explain the physics.
- Neutral prompts only, when they fall silent:
  - “What are you thinking?”
  - “What do you expect to happen?”
  - “What do you think that shows?”
- **If they are completely blocked**, meaning no interaction and visibly stuck for about 60 s on a beat:
  1. Ask: “What would you try?”
  2. If they are still blocked: “You can move on whenever you like.”

  Note the time and the beat whenever you say either.
- Write down, per beat:
  - what they say they can touch;
  - what they think changed;
  - any wrong expectation or explanation, verbatim where possible.
- If they open “show the physics” or a “why?” microscope, let them; the log records it.

## Ending

At Beat 13 a quiet link reads “the end · save the session log for the facilitator”. If they stop earlier, press
**Shift+L** at any time. Either one downloads `lya-study-<date-time>.json`. Keep it with your notes under the
participant code.

If the page is reloaded by accident, the session resumes in the same tab: the log continues, and hints already learned
stay learned.

## After the session: conceptual prompts

Ask these after the session, never during it, and in this order. Accept any wording. Do not ask for formulas unless
the participant opened “show the physics” and used one themselves.

| concept | question | what a good answer contains |
|---|---|---|
| temperature | Why does hotter gas produce a broader line? | hotter gas, atoms faster in random directions; a wider spread of speeds along the beam; each speed absorbs a slightly different colour; so a wider range of colours is absorbed |
| redshift / stretch | Why do different structures along the way produce Lyman-α absorption at different observed wavelengths? | the light stretches as it travels; each structure absorbs where the light is at Lyα *for that structure*; nearer structures meet light that has stretched less by then |
| velocity space | Can two features next to each other in the spectrum come from gas that is not next to each other in space? | yes: position sets the recession, and the gas's own motion adds to it; gas far apart can land at nearly the same velocity, and the order can even reverse |
| one parcel (Beat 6) | In the scene with one parcel, what did each thing you changed do to its line? | place and motion: where it lands; temperature: how wide; amount: how deep (how much); the others stayed the same |
| optical depth / flux | When light passes through several layers of gas, what adds, and what multiplies? | optical depths add; the transmitted fractions multiply (F = e^−τ) |
| inverse problem | Can one observed colour be absorbed by gas in more than one place? What does that mean for reading a spectrum backward? | yes, several regions can contribute to one colour; so one spectrum does not determine a single arrangement of gas |
| degeneracy | If two models of the gas produce almost the same spectrum, is the reason always that the data are noisy? | no: some differences are hidden by noise and better data can reveal them; some the light does not record at all (heat versus smooth motion in hydrogen) |

Then, without pointing at anything: “If you wanted to check where one of these science claims came from, where would you look?” Note whether they find “sources & assumptions” unaided, whether they understand it, and whether the route to the science notes is clear.

Then two questions about the interface:
- “What could you touch or move? Was there anything you expected to work that didn’t?”
- “What were the rulers and numbers in the left margin for?”

## Classifying what you saw

Write every observation in the notes template (`REVIEW_NOTES_TEMPLATE.md`) with one class:

| class | definition | typical evidence |
|---|---|---|
| **discoverability** | cannot find the intended physical interaction | no `first_interaction_s` or a late one; dead taps; readings pressed; “I can’t do anything here” |
| **mapping** | performs the gesture but misreads which physical variable changed | “holding it made more gas”; says the push moved the gas in space |
| **causal understanding** | sees the response but gives the wrong physical explanation | “hotter gas is denser, so the line is wider” |
| **presentation** | understands the physics but misses a label, reading or readout | the right answer, but never noticed the ruler or the measured comparison |
| **pacing** | impatient, or skips before the effect is clear | leaves a beat before a reveal ends; short `duration_s` with no interaction; “too slow” |
| **accessibility / input** | the gesture works poorly on their device or input method | repeated attempts on touch or trackpad; a long press opening something else |
| **science misconception** | the design itself appears to teach a false or misleading model | “the finger heats the gas”; “pulling the shadow moves the gas”; “the box is a container” |

## Deciding what to change

- After each participant, record the observations, classify them, and look for recurrence across participants.
- Decide whether each one is a local usability issue or a conceptual issue.
- **Fix immediately**, before the next participant, only in two cases:
  - a severe science misconception attributable to the design, even if seen once;
  - a blocking defect, such as a crash or a gesture that does not work on the device.
- **Wait for recurrence** (2 of 3 participants) for discoverability, presentation, pacing and minor mapping issues. One
  hesitation is not evidence.
- Do not add interaction features during the study. Afterwards: evidence-based micro-fixes, then freeze, then
  release-data integration and content polish.
- Scripted walk-throughs (`app/record.mjs`) show that the instrument works. They are never usability evidence.
