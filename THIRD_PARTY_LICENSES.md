# Third-party software and fonts

This resource redistributes the following third-party assets, unmodified, under their own licences. The licence texts
are in `app/vendor/LICENSES/`; the build copies them into the published site (`app/dist/licenses/`), because the app and
the science notes embed these fonts and KaTeX inside their HTML. Versions, sources and sha256 checksums are recorded in
`app/vendor/VENDOR.md` and checked by `app/release_check.mjs`.

| asset | version | licence | licence text | notes |
|---|---|---|---|---|
| Fraunces (variable font; opsz 9–144, wght 300/400, italic 300) | Google Fonts files `v38` | SIL Open Font License 1.1, © 2018 The Fraunces Project Authors | `OFL-Fraunces.txt` | no Reserved Font Name |
| Inter (wght 300, 400) | Google Fonts files `v20` | SIL Open Font License 1.1, © 2020 The Inter Project Authors | `OFL-Inter.txt` | no Reserved Font Name |
| IBM Plex Mono Regular | 2.5.0 (IBM's release, npm `@ibm/plex-mono`) | SIL Open Font License 1.1, © 2017 IBM Corp. | `OFL-IBMPlexMono.txt` | Reserved Font Name "Plex": the unmodified original file is redistributed, never a subset or conversion |
| KaTeX (`katex.min.js`, `katex.min.css`) | 0.16.11 | MIT, © 2013–2020 Khan Academy and other contributors | `MIT-KaTeX.txt` | equations rendered in the browser and, for the science notes, at build time |
| KaTeX fonts (woff2) | 0.16.11 | MIT, © 2018 Khan Academy | `MIT-KaTeX-fonts.txt` | only the woff2 files are kept |

All five licences permit redistribution, including embedding in web pages, with the licence notice. The SIL OFL forbids
selling the fonts by themselves and using a Reserved Font Name for a modified version. The fonts are not sold, and Plex
is redistributed unmodified.

## Used to build or check, not redistributed

| tool | licence | used for |
|---|---|---|
| Node.js, Python 3, PyYAML | MIT / PSF / MIT | building the site and the provenance |
| Playwright | Apache-2.0 | browser checks (`app/smoke.mjs`, `app/touch.mjs`, …) |
| NumPy, SciPy | BSD-3-Clause | the numerical oracles in `science/oracle/` (their outputs are committed as validation data) |
| fake_spectra 2.2.4 (S. Bird) | MIT | the closure comparison in `science/validation/closure/` (its outputs on synthetic test skewers are committed) |

No icons, images or other external assets are used: every figure is drawn by the app at run time.
