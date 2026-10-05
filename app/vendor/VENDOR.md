# Vendored assets

Fonts and KaTeX are kept here so the app renders identically offline. `app/build.mjs` inlines them into
`app/dist/lya.html` as data URIs (a double-clicked page cannot load font files beside it) and fails if a vendored
stylesheet still points at the network. Typography is unchanged: the same families, weights, axes and subsets the app
loaded from Google Fonts and jsDelivr before vendoring (2026-10-03).

Redistribution was checked before anything was added. Each licence text is stored in `LICENSES/` and travels with the
files, as the licences require.

| asset | version | source | licence | licence text |
|---|---|---|---|---|
| Fraunces (variable: opsz 9–144; wght 300, 400; italic 300) | Google Fonts `v38` files | `fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;1,9..144,300` | SIL OFL 1.1, © 2018 The Fraunces Project Authors; no Reserved Font Name | `LICENSES/OFL-Fraunces.txt` (google/fonts `ofl/fraunces/OFL.txt`) |
| Inter (wght 300, 400) | Google Fonts `v20` files | `fonts.googleapis.com/css2?family=Inter:wght@300;400` | SIL OFL 1.1, © 2020 The Inter Project Authors; no Reserved Font Name | `LICENSES/OFL-Inter.txt` (google/fonts `ofl/inter/OFL.txt`) |
| IBM Plex Mono Regular (400) | 2.5.0 | IBM's release, npm `@ibm/plex-mono@2.5.0` (`fonts/complete/woff2/IBMPlexMono-Regular.woff2`), unmodified | SIL OFL 1.1, © 2017 IBM Corp., **Reserved Font Name "Plex"** — so the unmodified original is vendored, not Google's subsetted copies (a subset is a Modified Version) | `LICENSES/OFL-IBMPlexMono.txt` (from the same package) |
| KaTeX (`katex.min.js`, `katex.min.css`) | 0.16.11 | npm `katex@0.16.11` (`dist/`) | MIT, © 2013–2020 Khan Academy and other contributors | `LICENSES/MIT-KaTeX.txt` (package `LICENSE`) |
| KaTeX fonts (woff2 only) | 0.16.11 | npm `katex@0.16.11` (`dist/fonts/`); built from github.com/KaTeX/katex-fonts | MIT, © 2018 Khan Academy | `LICENSES/MIT-KaTeX-fonts.txt` (katex-fonts `LICENSE`) |

The build keeps only the woff2 entries of KaTeX's `@font-face` rules (every supported browser reads woff2); nothing else
in the vendored files is modified. `fonts/fonts.css` is Google's stylesheet with the URLs made local and the Plex Mono
faces replaced by one face for IBM's file.

## Checksums (sha256)

```
a7bd44abd8419bf78185be51f34216356af1adb0806ce39d6a9ca0940bd49b70  LICENSES/MIT-KaTeX-fonts.txt
766ccc1f306c885aa45542a9846bbd0a505b27a0374f146778171c2254ce18e3  LICENSES/MIT-KaTeX.txt
bdf4c22802eaf804f998195871c6b8938aac2ac14b2d78a8bd66a6f1eced833b  LICENSES/OFL-Fraunces.txt
7e6b2818edbd8f6a01ae80641cc8f16a51080d08fb4e532be3a0b6f74adb07da  LICENSES/OFL-IBMPlexMono.txt
5b9321a4298cfeb6b34354164a1c3afc3db114569984c502b9b35d988fd58c57  LICENSES/OFL-Inter.txt
351a250ec534dd6d0fa574368ebe0092e89b486b5c1c716592d73c8541e91040  fonts/fonts.css
48282a415ec22e31beaf0a0666e6fae0c8cbddcd0b1f6e729f27c3ade8a64e43  fonts/fraunces/fraunces_v38_6NU78FyLNQOQZAnv9bYEvDiIdE9Ea92uemAk_WBq8U_9v0c2Wa0KxC9TeP2Xz5c.woff2
7e3c04662669cd2b8ee672e4e5d63146d21f6aa36654b211718af5fe0bb3bd51  fonts/fraunces/fraunces_v38_6NU78FyLNQOQZAnv9bYEvDiIdE9Ea92uemAk_WBq8U_9v0c2Wa0KxCBTeP2Xz5fU8w.woff2
f120089b9440f3e35a980a2137347b1851ad46ee4b8ad5c63b6c07e053fa40e2  fonts/fraunces/fraunces_v38_6NU78FyLNQOQZAnv9bYEvDiIdE9Ea92uemAk_WBq8U_9v0c2Wa0KxCFTeP2Xz5fU8w.woff2
8e2ee6b2cefd5761f0f39ab9d8ec892039686125ace5c4db463dfe42fd2d2409  fonts/fraunces/fraunces_v38_6NUs8FyLNQOQZAnv9ZwNjucMHVn85Ni7emAe9lKqZTnbB-gzTK0K1ChJdt9hFwpX9W37lgF_mv0iQublWII.woff2
becfc89cd22a09ee92470d0b57846c6c2288ddebf044bcabed44b538d3b45a41  fonts/fraunces/fraunces_v38_6NUs8FyLNQOQZAnv9ZwNjucMHVn85Ni7emAe9lKqZTnbB-gzTK0K1ChJdt9hFwpX9W37lgF_mvIiQublWIIkfg.woff2
4391a36d5001636d65a73fc724a70dd12945a13f0d098a334b9a6426c34dd681  fonts/fraunces/fraunces_v38_6NUs8FyLNQOQZAnv9ZwNjucMHVn85Ni7emAe9lKqZTnbB-gzTK0K1ChJdt9hFwpX9W37lgF_mvMiQublWIIkfg.woff2
ba204497f16b6d334cee9d1e963a831b73e3a56e1d6300a8489d18df7214b350  fonts/ibm-plex-mono/IBMPlexMono-Regular.woff2
aebf2ab4a4ce6810d73c1ac7be7cafb4e5ec4cee2d6db5fb3e09691747ec4bd6  fonts/inter/inter_v20_UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa0ZL7W0Q5n-wU.woff2
c940764593d0fe5d596be327ca7558855e018039fb78509aa21921fd3644c3e4  fonts/inter/inter_v20_UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa1ZL7W0Q5nw.woff2
46dd4cdca58c26ae87cc6927657bf83b2e8abfc39ffd0ab176e301a8d28d22bf  fonts/inter/inter_v20_UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa1pL7W0Q5n-wU.woff2
a28eb6d3ccb534ae0c94ca999371df024aab60b08c3c8a5720ee9e32fa0faaa2  fonts/inter/inter_v20_UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa25L7W0Q5n-wU.woff2
fccca918fea40089dacadc7045861314d1a6bc91f1f323cc1eeb22ebcdb321b5  fonts/inter/inter_v20_UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa2JL7W0Q5n-wU.woff2
a2e2c783ca6f9c20486e81e72a279203e86730bbf8f01ff6a5ee9dbd09e1c271  fonts/inter/inter_v20_UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa2ZL7W0Q5n-wU.woff2
8db00ff46c67b22cda8bed865acf7077651cac8d2841d5b40980556b48961931  fonts/inter/inter_v20_UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa2pL7W0Q5n-wU.woff2
0cdd387c9590a1a9f9794560022dbb59654a7d86f187aa0c81495ad42d3a7308  katex/fonts/KaTeX_AMS-Regular.woff2
de7701e42cf1f4cf0b766c03fb27977207eee2f4fd5d76fa82188406da43ea4c  katex/fonts/KaTeX_Caligraphic-Bold.woff2
5d53e70ad607c2352162dec9e0923fb54ecdafaccbf604cd8dcf7d00facb989b  katex/fonts/KaTeX_Caligraphic-Regular.woff2
74444efd593c005e3f4573b44524704c0af0a937fe911cca9e94068d0d140d3f  katex/fonts/KaTeX_Fraktur-Bold.woff2
51814d270d06ff0255dba0799994fa4d8c84d11f09951d47595f4abb1f3602dc  katex/fonts/KaTeX_Fraktur-Regular.woff2
0f60d1b897938ec918c8ce073092411baf9438f6739465693ff18b0f9d20b021  katex/fonts/KaTeX_Main-Bold.woff2
99cd42a3c072d918f2f44984a807cf7aa16e13545fd0875fc07c6c65f99e715b  katex/fonts/KaTeX_Main-BoldItalic.woff2
97479ca6cce906abc961ecac96faa5f9ca2e61b8e7670d475826bcdee9a7c267  katex/fonts/KaTeX_Main-Italic.woff2
c2342cd8b869e01752a9321dc17213fc40d4d04c79688c1d43f2cf316abd7866  katex/fonts/KaTeX_Main-Regular.woff2
dc47344dbb6cb5b655c8460d561f4df5f501b90c804ad3c6cec65fe322351ab1  katex/fonts/KaTeX_Math-BoldItalic.woff2
7af58c5ec8f132a2ddde9027c6d7814decce4d3b822a11192a42a20e2e973264  katex/fonts/KaTeX_Math-Italic.woff2
e99ae51144bf1232efcc1bfe5add36262c6866b0faab24fa75740e1b98577a62  katex/fonts/KaTeX_SansSerif-Bold.woff2
00b26ac825e2095056396e0553b8ac26d3f8ad158c3826e28b4c45b385c4714a  katex/fonts/KaTeX_SansSerif-Italic.woff2
68e8c73ef42afd3ccec58bf0fba302cce448938e7fc020a5e31f8a952eee1342  katex/fonts/KaTeX_SansSerif-Regular.woff2
036d4e95149b69ff9bcc0cd55771efeb25ffa3947293e69acd78d5ac328c684b  katex/fonts/KaTeX_Script-Regular.woff2
6b47c40166b6dbe21a5dfca7718413f2147fd2399be1ba605d8ad39cedf25dfe  katex/fonts/KaTeX_Size1-Regular.woff2
d04c54219f9eaec6d4d4fd42dfb28785975a4794d6b2fc71e566b9cd6db842dd  katex/fonts/KaTeX_Size2-Regular.woff2
73d591271b1604960cb10bb90fee021670af7297017e0e98480b332d11f51995  katex/fonts/KaTeX_Size3-Regular.woff2
a4af7d414440a1c1790825cfb700cf9cf43b0f2c4b04f0ebc523011ad9853ec0  katex/fonts/KaTeX_Size4-Regular.woff2
71d517d67827787cfabdf186914cc3358eda539e37931941f2b2fd4a21f68c0b  katex/fonts/KaTeX_Typewriter-Regular.woff2
717bc9ae7853b61f0f76455dddf0ecd4f527a783f42de2ac24684899c1c46258  katex/katex.min.css
e6bfe5deebd4c7ccd272055bab63bd3ab2c73b907b6e6a22d352740a81381fd4  katex/katex.min.js
```
