# Browsers and devices

The app is designed for **tablets in landscape and larger screens**, with mouse, trackpad, touch or keyboard. Narrow
phone screens show a short notice ("designed for tablet and larger screens") with a "continue anyway" button.

Only environments actually tested are listed. Automated checks:
- `app/smoke.mjs`: every scene, the probes and the rendering check;
- `app/touch.mjs`: real touch input, a cancelled touch, a drag released outside the figure, and the navigation targets;
- `app/a11y.mjs`: target sizes, keyboard, focus, screen-reader semantics, reduced motion, browser zoom and small
  screens;
- `app/study.mjs`: the study mode;
- `app/firefox_bidi.mjs`: a real Firefox;
- `app/safari_check.mjs`: a real Safari through its own WebDriver (`safaridriver`; needs Develop → Allow Remote
  Automation), with real pointer and keyboard input.

| environment | version | rendering (14 scenes) | interaction | sources & science notes | keyboard | touch | reduced motion | status |
|---|---|---|---|---|---|---|---|---|
| Chromium (Playwright) | 153.0 | ✓ | ✓ | ✓ | ✓ | ✓ (emulated touch input) | ✓ | tested |
| Google Chrome, macOS 14.6 | 154.0 | ✓ | ✓ | ✓ | ✓ | ✓ (emulated touch input) | ✓ | tested |
| Firefox, macOS 14.6 | 117.0.1 | ✓ | load and navigation | ✓ (60 links, 39 equations) | — | — | — | tested (load) |
| Safari, macOS 14.6 | 17.6 | ✓ | ✓ (mouse: hold, drag, scan) | ✓ | ✓ (focus mark, Escape) | — | — (an OS setting WebDriver cannot set) | tested |
| Safari, iPad (iPadOS) | — | — | — | — | — | — | — | **not yet tested** |

**Known limitations:**
- **Phones.** Phones are not a supported layout in v0.1: the fixed stage would make body text about 4–7 px.
- **Browser zoom.** Zoom enlarges the stage, and the page then scrolls. On touch screens, pinch-zoom works outside the
  figure; inside it, touches are gestures.
- **Slow networks.** On a slow 4G connection (about 1.6 Mbps) the single 1.3 MB (gzip) page takes about 7 s to load.
- **Back button.** Moving between scenes updates the address (`#beat=N`) without adding browser-history entries, so
  the back button leaves the app rather than stepping back a scene. Use "← previous".
