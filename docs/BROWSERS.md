# Browsers and devices

The app is designed for **tablets in landscape and larger screens**, with mouse, trackpad, touch or keyboard. Narrow
phone screens show a short notice ("designed for tablet and larger screens") with a "continue anyway" button.

Only environments actually tested are listed. Automated checks:
- `app/smoke.mjs`: every scene, the probes and the rendering check;
- `app/touch.mjs`: real touch input, a cancelled touch, a drag released outside the figure, and the navigation targets;
- `app/a11y.mjs`: target sizes, keyboard, focus, screen-reader semantics, reduced motion, browser zoom and small
  screens;
- `app/study.mjs`: the study mode;
- `app/continuous_navigation.mjs`: "next →" and "← previous" read every scene both ways from one fixed place (pointer,
  keyboard, touch);
- `app/tour_check.mjs`: the guided tour, every slide in order, its captions and the declared ranges of what it animates;
- `app/pages_check.mjs`: the site served under its project path (deep links, reloads, session state, 404, fonts, KaTeX);
- `app/firefox_bidi.mjs`: a real Firefox;
- `app/safari_check.mjs`: a real Safari through its own WebDriver (`safaridriver`; needs Develop → Allow Remote
  Automation), with real pointer and keyboard input.

| environment | version | rendering (14 scenes) | interaction | sources & science notes | keyboard | touch | reduced motion | status |
|---|---|---|---|---|---|---|---|---|
| Chromium (Playwright) | 153.0 | ✓ | ✓ | ✓ | ✓ | ✓ (emulated touch input) | ✓ | tested |
| Google Chrome, macOS 14.6 | 154.0 | ✓ | ✓ | ✓ | ✓ | ✓ (emulated touch input) | ✓ | tested |
| Firefox, macOS 14.6 | 117.0.1 | ✓ | navigation and the guided tour | ✓ (67 links, 58 equations) | — | — | — | tested (load, navigation, tour) |
| Safari, macOS 14.6 | 17.6 | ✓ | ✓ (mouse: hold, drag, scan; the guided tour, also by hand) | ✓ | ✓ (focus mark, Escape) | — | — (an OS setting WebDriver cannot set) | tested |
| Safari, iPad Air (iPadOS 26) | 26.6.1 | ✓ | ✓ (by hand: hold, drag, scan; the fixed navigation and the guided tour) | ✓ (sources and Python sheets) | — | ✓ (real touch) | — | tested by hand (2026-10-05) |

**Known limitations:**
- **Phones.** Phones are not a supported layout in v0.1: the fixed stage would make body text about 4–7 px.
- **Browser zoom.** Zoom enlarges the stage, and the page then scrolls. On touch screens, pinch-zoom works outside the
  figure; inside it, touches are gestures.
- **Slow networks.** On a slow 4G connection (about 1.6 Mbps) the single 1.3 MB (gzip) page takes about 7 s to load.
- **Back button.** Moving between scenes updates the address (`#beat=N`) without adding browser-history entries, so
  the back button leaves the app rather than stepping back a scene. Use "← previous".
