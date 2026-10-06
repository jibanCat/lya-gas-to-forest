# Closure study: fake_spectra 2.2.4 vs the browser real-space τ method

Status: **study**. §7 lists the acceptance options considered; the adopted criterion is a declared-domain version of
option B (VAL-CLOSURE-FS in `science/SCIENCE_LEDGER.yaml`).
Conventions and source citations are in `science/notes/FAKE_SPECTRA_CONVENTIONS.md`.
Run date 2026-10-02. All numbers come from `metrics.json`, `validation_mode.json`, `mocksnap.json` and
`js_vs_port.json`. The full tables are generated into `TABLES.md` by `make_tables.py`.

## 0. Summary

1. **Code fidelity.** The Python port matches the unmodified `lyaphys.js`, run under node on every exported case, to ≤ 5.6e-15 in relative τ.
   A line-by-line Python emulator of fake_spectra's τ kernel matches the compiled `_Particle_Interpolate` to ≤ 1.6e-7.
2. **Gas without strong velocity structure inside a pixel, lines resolved by the pixels (C1, C2, C3a/b, C4a/b, C5, C7, C9).** Comparing the browser default with fake_spectra:
   * max|ΔF| ≤ 4.5e-3 for isolated lines and ≤ 4.9e-3 for the forest-like field;
   * |Δ⟨F⟩| ≤ 3e-4 and |ΔEW/EW| ≤ 0.28 %;
   * forest P1D agrees to within 0.4 % for k ≤ 0.1 s/km.

   **One convention dominates:** fake_spectra takes the H mass in b as 1.00794 × m_p, so its b is 0.37 % smaller.
3. **Convention-aligned check (§4).** With the constants aligned to fake_spectra's, the browser method at native skewer resolution with `point` sampling reproduces the exact reference to **≤ 3e-7 in F** for every case with b > Δu in which the gas in each pixel has a single velocity (no overlapping kernels with different v).
   What then remains between the browser and fake_spectra is **fake_spectra's own numerical error**: ≤ 1.8e-4 in F for normal kernels, 1.5e-2 for broad cold kernels.
4. **Irreducible for a real-space skewer** (one v and one T per pixel):
   * **unresolved velocity structure inside one real-space pixel**: several particles' kernels with different velocities contribute to the same pixel, and one v and one T per pixel cannot represent that spread. In the synthetic cases built to probe this: max|ΔF| 0.09 (C3c, two components at the same position with v = ±b/2), 0.023 (C4c, overlapping kernels across a velocity gradient steep enough to fold u(x)), and up to 0.19 with P1D errors of a few % (C10, a 1D Zel'dovich toy field deliberately evolved past shell crossing; an exaggerated stress test, not a model of the IGM or of an SPH run);
   * gas-like forest (C9): only 3.6e-3.
5. **Fixable:**
   * narrow lines (b < pixel) at the default settings: max|ΔF| up to **0.46** (C6). Oversampling the skewer to H·Δx ≤ b_min/2 and averaging over pixels brings this down to 0.019.
   * the mass convention, which can be switched in a validation mode;
   * the support cut (≤ 1.5e-4);
   * the Voigt approximation (≤ 1.6e-5, already measured).
6. **Findings that affect the physics we teach (flagged):**
   * `Spectra.get_velocity()` returns √a·v_pec, so its velocities are halved at z = 3;
   * both codes cut damping wings at half a box, which changes F by up to 0.28 and EW by 10 % against a periodic sum;
   * fake_spectra stores the pixel-averaged τ, not the pixel-averaged flux;
   * `turn_off_selfshield` zeroes the line's damping constant (`gamma_X`), not Γ_HI.

   See §6.

## 1. Set-up

* **Cosmology and epoch.** z = 3, flat ΛCDM, Ωm = 0.3, ΩΛ = 0.7, h = 0.7. fake_spectra imposes no constraint on these. a H(z)/h = 111.5235 km/s per Mpc/h, i.e. `velfac` = 0.11152354 km/s per kpc/h.
* **Boxes and pixels.**
  * C1–C8: 5 Mpc/h (557.62 km/s), 1024 pixels of 0.545 km/s. C6 uses 56 pixels of 9.96 km/s instead.
  * C2c, C9, C10: 20 Mpc/h (2230.5 km/s), 2048 pixels of 1.089 km/s.
* **fake_spectra.** The compiled core `_Particle_Interpolate` is called with its real argument list (py_module.cpp:115):
  * cubic kernel and `tautail = 1e-7`, the `Spectra` default;
  * H I Lyα line data exactly as `Spectra` passes them: λ = 1215.6701e-8 cm, Γ = 6.265e8 s⁻¹, f = 0.4164, amumass = 1.00794;
  * one sightline along x through the transverse origin;
  * particle `dens` in fake_spectra's internal unit, atoms cm⁻³ × (proper cm per kpc/h).
* **fake_spectra emulator** (`fs_emulate`). A Python re-implementation of `add_tau_particle`. It reproduces the compiled output in every case: ≤ 1.4e-14 for single particles and ≤ 1.6e-7 for many particles (float32 summation order). Because it has switches for kernel quadrature, pixel quadrature and `tautail`, it lets us attribute fake_spectra's own errors to each of them.
* **Exact reference** (`reference_tau`). It uses fake_spectra's particle model: each kernel moves rigidly with its particle's own v plus the Hubble flow across it, at the particle's own T. Within that model it evaluates everything exactly:
  * Gauss–Legendre kernel nodes spaced ≤ 0.05 b;
  * the Voigt function from `scipy.special.wofz`;
  * the exact average over each fake_spectra pixel (Gauss–Legendre on sub-intervals ≤ b/4);
  * fake_spectra's constants and half-box image window.

  It agrees with the emulator at converged quadrature to 1e-12 (4e-9 for the h = 300 kpc/h kernel). A second variant sums box images k = −3…3 instead, as a true periodic sum.
* **Real-space skewer** (the browser's input).
  * Each particle's kernel column is deposited exactly into pixels whose edges match fake_spectra's: pixel j ↔ [j, j+1)·box/nbins.
  * n_HI,j = ΣN / Δx_proper.
  * T_j and v_j are HI-column-weighted means. This is what `Spectra.get_temp/get_velocity` compute, without the latter's extra √a.

  The deposited columns agree with fake_spectra's own `compute_colden` to within that routine's trapezoid accuracy (≤ 4e-3 of the peak, worst in coarse C6c).
* **Port and JS.** `tau_from_cells` and `cells_from_skewer` reproduce lyaphys.js, including the m_H = 1.6735328e-24 g correction and W4 everywhere. `run_js.js` runs the real module on the exported JSON.
* **Metrics.** Candidate A is compared with baseline B using:
  * the maximum of |τA−τB|/τB in the **core**, defined as τB ≥ 0.1 max τB;
  * the maximum of |ΔF|, with its location;
  * Δ⟨F⟩ over the whole box;
  * EW = Σ(1−F)Δu in km/s, reported as ΔEW/EW;
  * for the forest families, ⟨F⟩ and the ratio of 1D flux power in k-bands. Each ratio is given raw and after both spectra are rescaled to ⟨F⟩ = 0.68.

| case | content |
|---|---|
| C1a–c | isolated particle, N_HI = 1e12 / 1e13 / 1e14 cm⁻², T = 1e4 K, v = 0, h = 30 kpc/h (kernel ±3.3 km/s) |
| C1d | N = 1e13 at impact parameter 0.6 h (the dr² > 0 code path) |
| C2a/b | N = 1e19 / 2e20 in the 5 Mpc/h box (wings reach the half-box window) |
| C2c | N = 2e20 in a 20 Mpc/h box |
| C3a/b | two N = 1e13 lines 1 b / 2 b apart in real space |
| C3c | two N = 1e13 particles at the **same** position with v = ±b/2 (two velocity components inside one real-space pixel) |
| C4a/b/c | 81 overlapping particles (spacing 25 kpc/h, h = 100 kpc/h) forming a Gaussian overdensity (δ0 = 4), T ∝ (1+δ)^0.5. Velocity −0.5 aH(x−xc) (infall, ×2 compression in u) / +0.5 aH(x−xc) (expansion) / a strong tapered infall that folds u(x). Peak τ_FS normalised to 3 |
| C5a/b | N = 1e14 line whose kernel straddles x = box / one that wraps in velocity only (x = 4950, v = +20 km/s) |
| C6a–d | narrow lines in coarse pixels (9.96 km/s): T = 1e2, 1e3, 1e4 K; C6d is the 1e2 K line at a real-space pixel edge |
| C7a/b | sign test: N = 1e14 with v = ±30 km/s |
| C8a/b | broad kernel h = 300 kpc/h (±33 km/s), T = 1e4 / 2e3 K |
| C9s0–7 | gas-like forest: 1D lognormal density (Bi–Davidsen-like, σ_g = 0.8), linear-theory velocities; particles keep their order in x (the toy field is not evolved past shell crossing), while u(x) may fold in redshift space; 2048 particles at equal-mass spacing, h = 2.5 local spacings, T = 1e4 Δ^0.6, n_HI ∝ Δ²T^−0.7, ⟨F⟩_FS tuned to 0.68 |
| C10s0–3 | deliberately exaggerated stress test: a 1D Zel'dovich toy field evolved past shell crossing, so particles from different initial positions share the same x with different velocities. It probes the limit of one v per pixel; it is not a model of the IGM or of an SPH simulation. ⟨F⟩_FS = 0.68 |

**Sign test (C7).** In fake_spectra, the port and the reference alike, a particle with v = +30 km/s peaks at u = 309.03 km/s and one with v = −30 km/s at 249.13 km/s. The expected values are 308.95 and 248.95 km/s; the residual offset is pixel quantisation. A positive v means larger u in both codes.
**End-to-end on a mock Gadget snapshot** (`mocksnap.json`, written by `fakespectra_mocksnap.py`):
* `Spectra.get_tau` agrees with the direct call made under my reading of the units to 5.6e-7.
* Lines sit at velfac·x + v_pec.
* The column support is ±SmoothingLength/2.
* `get_temp` is correct.
* **`get_velocity` returns 0.5000 × v_pec at a = 0.25.**

## 2. Headline: browser default vs fake_spectra

The browser default is a native-resolution skewer, `sample:'point'`, `cut:8`, `tauFloor:1e-6`. FS denotes fake_spectra and REF the exact reference.

| case | max rel τ (core) | max\|ΔF\| | Δ⟨F⟩ | ΔEW/EW | FS−REF max\|ΔF\| | port−REF max\|ΔF\| |
|---|---|---|---|---|---|---|
| C1a N=1e12 | 1.4e-2 | 2.1e-4 | -1.5e-7 | 6.5e-5 | 8.3e-6 | 2.0e-4 |
| C1b N=1e13 | 1.4e-2 | 1.2e-3 | -1.3e-5 | 6.7e-4 | 4.9e-5 | 1.2e-3 |
| C1c N=1e14 | 1.4e-2 | 4.5e-3 | -1.9e-4 | 2.8e-3 | 1.8e-4 | 4.3e-3 |
| C1d impact parameter | 1.3e-2 | 1.3e-3 | -8.2e-6 | 4.1e-4 | 1.5e-4 | 1.2e-3 |
| C2a LLS 1e19 | 1.4e-2 | 1.1e-3 | -1.3e-5 | 1.8e-5 | 1.6e-6 | 1.1e-3 |
| C2b DLA 2e20 | 1.4e-2 | 3.8e-5 | -9.0e-8 | 9.0e-8 | 8.0e-9 | 3.8e-5 |
| C2c DLA, 20 Mpc/h | 1.5e-2 | 2.0e-4 | 2.9e-6 | -3.9e-6 | 3.1e-7 | 2.0e-4 |
| C3a blend 1b | 1.1e-2 | 9.9e-4 | -2.3e-5 | 6.5e-4 | 3.9e-5 | 9.5e-4 |
| C3b blend 2b | 1.3e-2 | 1.1e-3 | -1.5e-5 | 3.8e-4 | 4.3e-5 | 1.0e-3 |
| **C3c two components, one position** | 5.9e-1 | **8.9e-2** | 2.2e-3 | -6.2e-2 | 3.9e-5 | 8.9e-2 |
| C4a infall | 4.5e-3 | 1.5e-3 | 9.9e-5 | -7.1e-4 | 1.7e-5 | 1.5e-3 |
| C4b expansion | 4.9e-4 | 6.1e-4 | 4.9e-5 | -1.5e-4 | 9.5e-6 | 6.1e-4 |
| **C4c fold** | 7.6e-2 | **2.1e-2** | 1.3e-3 | -1.2e-2 | 4.1e-5 | 2.1e-2 |
| C5a/b periodic | 1.3e-2 | 4.5e-3 | -1.9e-4 | 2.8e-3 | 1.8e-4 | 4.3e-3 |
| **C6a T=1e2, coarse** | 4.2 | **4.5e-1** | -1.5e-2 | +0.88 | 1.6e-3 | 4.5e-1 |
| **C6b T=1e3, coarse** | 7.8e-1 | **2.1e-1** | -3.6e-3 | +0.20 | 4.5e-4 | 2.1e-1 |
| C6c T=1e4, coarse | 3.4e-1 | 4.9e-2 | -1.8e-4 | 9.2e-3 | 5.2e-3 | 5.4e-2 |
| **C6d T=1e2 at pixel edge** | 3.4 | **4.6e-1** | -1.6e-2 | +0.93 | 4.9e-6 | 4.6e-1 |
| C7a/b sign ±30 km/s | 1.4e-2 | 4.5e-3 | -1.9e-4 | 2.8e-3 | 1.8e-4 | 4.3e-3 |
| C8a broad kernel | 7.1e-3 | 2.1e-3 | -1.0e-4 | 1.2e-3 | 6.8e-4 | 1.7e-3 |
| C8b broad kernel, cold | 4.7e-2 | 1.4e-2 | -2.1e-5 | 2.8e-4 | **1.5e-2** | **6.6e-4** |
| C9 forest (worst of 8) | 9.4e-3 | 4.9e-3 | -2.9e-4 | 8.4e-4 | 6.0e-4 | 4.7e-3 |
| **C10 Zel'dovich stress test (worst of 4)** | 4.9e-1 | **2.0e-1** | 3.2e-3 | -1.0e-2 | 1.9e-4 | 2.0e-1 |

C8b is the one case where the **browser is closer to the truth than fake_spectra**. fake_spectra's 7-node kernel quadrature turns a broad cold kernel into a rippled profile.

## 3. Discrepancies by source

Each row switches **one thing** in the browser default (except FS-side rows, which switch one thing in the emulator). Values are max|ΔF|, worst case in the group, with [ΔEW/EW] in brackets. Every case is listed in `metrics.json → one_at_a_time_from_port` and `fs_internal`. The cumulative ladder (constants → wofz → no cut → per-particle cells → finer pixels → exact pixel average) ends ≤ 7e-7 from the reference for every controlled case. The exceptions are the periodic-seam pixel of the LLS/DLA cases C2a/b/c (1.1e-3 / 3.9e-5 / 2.2e-4, S9) and C6a/b/c (≤ 4.8e-5). The forest ladders stop at native-resolution per-particle cells and end ≤ 7.2e-6 (C9) and ≤ 3.7e-3 (C10, where the velocity structure inside each pixel is lost) from the reference; see `TABLES.md`.

| # | source | how measured | magnitude, max\|ΔF\| [ΔEW/EW] | where in the line | type | what would shrink it |
|---|---|---|---|---|---|---|
| S1 | **H mass in b**: fake_spectra 1.00794·m_p vs browser m_H (b −0.37 %) | mass-only override | isolated lines 2e-4 (1e12) / 1.2e-3 (1e13) / 4.3e-3 (1e14) [−2.7e-3]; forest 5.5e-3 [−7.5e-4]; relative τ in the core 1.3–1.4 % | line centre if unsaturated; flanks at x ≈ 1.6 b if saturated | convention (the browser value is the physically right one) | for validation only, a `mass` option in `cellsFromSkewer` (see §8). Keep m_H as the default. |
| S2 | Γ = 6.265e8 vs 6.2649e8 | Γ-only override | ≤ 5.9e-6 (only in LLS/DLA wings), elsewhere ≤ 2e-8 | damping wings | convention | none needed |
| S3 | k_B and πe²/m_e c values | override | ≤ 2e-6 | everywhere, ∝ τ | convention | none needed |
| S4 | Voigt: Humlicek W4 vs exact | `voigt='wofz'` | ≤ 1.6e-5 [≤ 1e-5]; relative τ ≤ 4.1e-5 | x ≈ 0.6–0.7 b; wing transition for LLS | numerical, already measured (~1e-4 relative in H) | none needed |
| S5 | support cut (8 b core + wing to τ = 1e-6) vs none | `cut = ∞` | ≤ 1.5e-4 (forest) [≤ 1.5e-4]; isolated lines ≤ 5e-6 | beyond 8 b, where many weak wings add up | numerical, fixable | lower `tauFloor` to 1e-8 or raise `cut`; the cost grows with the wing reach |
| S6 | point vs pixel average | `sample = 'bin'` or exact, at native resolution | ≤ 5.8e-4 when b ≫ Δu, **but moving away from the reference** (see §4); C6: **0.50** | flanks, x ≈ 1.6 b | interacts with S8 | keep `point` with native-resolution skewers; average over pixels only with oversampled skewers |
| S7 | **velocity/T assignment**: one HI-weighted v, T per pixel vs per-particle | per-particle cells | one velocity per pixel 1e-16; C4a 1.9e-3, C4c **2.3e-2**, C3c **9.0e-2**, forest 3.6e-3 [1.2e-4], C10 **0.19** [1.1e-2] | wherever kernels of particles with different v overlap one real-space pixel: two components at one position (C3c), kernels overlapping across steep or folding velocity gradients (C4, C9), the Zel'dovich stress test (C10) | **irreducible** for a skewer with one v per pixel | partly: optional per-pixel HI-weighted σ_v added in quadrature (K3/K7, §5) cuts C3c to 0.017 and C4c to 0.0021, but worsens the forest (6.1e-3) and the high-k P1D in C10 (−8 %). Not recommended as the default. |
| S8 | real-space pixelisation: native vs 16× (C6: 64×, forest: 4×) | finer skewer | resolved lines 1.8e-4; C6 **0.98** (a narrow line falls between u points); C10 1.3e-2 | sub-pixel line positions | fixable | H·Δx ≤ b_min/2 together with pixel averaging. K8: C6 from 0.46 to 0.019 |
| S9 | periodic seam: cell-based vs particle-based nearest image | ladder residual | 1.1e-3 in one pixel (C2a), 2.2e-4 (C2c), ≤ 7e-7 otherwise | the single pixel opposite a strong line | convention, negligible | none (document) |
| S10 | half-box window (both codes) vs a true periodic sum | REF with images vs without | LLS/DLA: **0.26–0.28 [−10 %]**; N=1e14: 4.4e-6 | far damping wings | physics or modelling choice shared by both codes | not a closure issue; see §6 |
| F1 | fake_spectra kernel quadrature, NGRID = 8 (7 nodes) | emulator NGRID 256 (forest 32) | normal kernels ≤ 2e-7; impact parameter (C1d) 1.0e-4 [2.6e-4]; forest 4.5e-4; broad cold kernel **1.5e-2** | ±(1–4) b ripples | fake_spectra numerics | n/a. Do not chase it: the browser is better here. |
| F2 | fake_spectra pixel rule: centre value if Δu < b/2; trapezoid with spacing ≤ b/2 otherwise | emulator, exact pixel average | 1.8e-4 (N=1e14, 0.54 km/s pixels); forest 5.9e-4; C6c 5.2e-3 | flanks | fake_spectra numerics | n/a. This is the floor for any browser-vs-fake_spectra comparison. |
| F3 | fake_spectra `tautail = 1e-7` | emulator, tautail = 0 | ≤ 2.5e-6 [≤ 1.1e-5] | far wings | fake_spectra numerics | n/a |

## 4. Validation mode: what is left once conventions are aligned (`validation_mode.json`)

| case | A: browser default with fake_spectra's mass, vs FS | B: native + `point`, FS constants, wofz, no cut, vs REF | C: as B with exact pixel average, vs REF | FS vs REF |
|---|---|---|---|---|
| C1a / C1b / C1c | 8.6e-6 / 5.1e-5 / 1.8e-4 | 5.6e-10 / 3.7e-9 / 1.6e-8 | 8.3e-6 / 4.9e-5 / 1.8e-4 | 8.3e-6 / 4.9e-5 / 1.8e-4 |
| C1d | 1.5e-4 | 2.7e-7 | 4.9e-5 | 1.5e-4 |
| C3a / C3b | 3.9e-5 / 4.6e-5 | 5.3e-9 / 3.8e-9 | 3.9e-5 / 4.2e-5 | 3.9e-5 / 4.3e-5 |
| C5a / C5b / C7a / C7b | 1.8e-4 | ≤ 2.5e-8 | 1.8e-4 | 1.8e-4 |
| C8a / C8b | 6.8e-4 / 1.5e-2 | 1.9e-7 / 1.8e-7 | 7.1e-5 / 1.3e-4 | 6.8e-4 / 1.5e-2 |
| C2a / C2c (seam, S9) | 1.1e-3 / 1.9e-4 | 1.1e-3 / 2.0e-4 | 1.1e-3 / 2.0e-4 | 1.6e-6 / 3.1e-7 |
| C4a / C4c (S7) | 1.9e-3 / 2.3e-2 | 1.9e-3 / 2.3e-2 | 1.9e-3 / 2.3e-2 | 1.7e-5 / 4.1e-5 |

Two conclusions follow.

1. **Column B.** At native resolution, depositing the column into real-space pixels and sampling at pixel centres together reproduce the exact pixel average. The agreement is ≤ 3e-7 whenever b > Δu, the gas in each pixel has a single velocity, and pixels are aligned (x_j = (j+½)Δx, ugrid = (j+½)·period/nbins). Adding a pixel average on top (column C) counts the pixel twice and moves the result ~5e-4 in relative τ *away* from the truth.
2. **Column A.** After the single mass change, the browser-vs-fake_spectra difference in cases with one velocity per pixel equals fake_spectra's own error (last column). The browser method is then as accurate as fake_spectra, or more so.

## 5. Practical configurations (browser constants) vs fake_spectra

max|ΔF| [ΔEW/EW], worst case in each group. Full table and P1D in `TABLES.md`.

| configuration | C1/C5/C7 | C3 | C4 | C6 | C8 | C9 forest | C10 |
|---|---|---|---|---|---|---|---|
| K1 native, point (**current default**) | 4.5e-3 [2.8e-3] | 8.9e-2 | 2.1e-2 | **4.6e-1 [+93 %]** | 1.4e-2 | 4.9e-3 [6.8e-4] | 2.0e-1 |
| K2 native, JS `bin` nsub=8 | 4.7e-3 | 8.9e-2 | 2.1e-2 | 1.2e-1 | 1.4e-2 | 5.3e-3 | 2.0e-1 |
| K3 native + σ_v broadening, point | 4.5e-3 | **1.7e-2** | **2.1e-3** | 4.6e-1 | 1.4e-2 | 6.1e-3 | 1.7e-1 |
| K6 4× oversampled, exact pixel average | 4.5e-3 | 8.9e-2 | 2.1e-2 | 6.4e-2 | 1.4e-2 | 5.3e-3 | 1.9e-1 |
| K8 oversampled to H·Δx ≤ b_min/2, exact pixel average | 4.5e-3 | 8.9e-2 | 2.1e-2 | **1.9e-2 [−0.15 %]** | 1.4e-2 | 5.3e-3 | 1.9e-1 |
| floor: K8 with FS constants, wofz, no cut | 1.9e-4 | 9.0e-2 | 2.3e-2 | 1.9e-2 | 1.5e-2 (FS error) | 3.7e-3 [1.2e-4] | 1.9e-1 |

**Forest P1D (C9, 8 sightlines).** P1D_port/P1D_FS − 1 is +0.17 %, +0.16 %, +0.03 % and −0.32 % in the k-bands (0.001,0.01], (0.01,0.02], (0.02,0.05] and (0.05,0.1] s/km. After both are rescaled to ⟨F⟩ = 0.68 it is +0.07 %, +0.08 %, −0.05 % and −0.37 %. ⟨F⟩ is 0.67979 for the port and 0.67997 for fake_spectra. The reference agrees with fake_spectra to ≤ 0.05 %.
**C10 (Zel'dovich stress test).** The P1D ratio deviates by −2.6 %, +1.1 %, +4.6 % and −0.7 % in the same bands; after rescaling by +5.9 % in (0.02,0.05].
**Pixel-averaged τ vs pixel-averaged flux (coarse C6).** fake_spectra returns exp(−⟨τ⟩), which differs from the detector-like ⟨e^{−τ}⟩ by max|ΔF| = 7.4e-3 for T = 1e4 K with 10 km/s pixels. For narrow lines the difference is 0.10–0.31, with EW off by a factor of up to ×2.5.

## 6. Findings that would change the physics we teach (flagged)

1. **`Spectra.get_velocity()` gives √a·v_pec** (spectra.py:954 multiplies by √a a second time; it is still present upstream). **Any skewer whose v comes from this method has its peculiar velocities halved at z = 3.** That would understate infall compression, redshift-space distortions and line shifts. Use particle velocities directly, or divide by √a. Under numpy 2 the method also crashes on a dtype check.
2. **One v and one T per real-space pixel cannot represent velocity structure inside the pixel.** In fake_spectra each SPH particle's kernel carries that particle's own velocity, so several kernels with different velocities can overlap the same pixel; the skewer keeps only their HI-weighted mean.
   * For gas-like flows the effect is small: max|ΔF| 3.6e-3, P1D ≤ 0.4 %.
   * In the synthetic cases built to stress it (two components at one position, C3c; kernels overlapping across a velocity gradient steep enough to fold u(x), C4c; a 1D Zel'dovich toy field deliberately evolved past shell crossing, C10) it reaches ΔF ≈ 0.02–0.2 and P1D errors of a few %. These cases are exaggerated by construction; C10 is shell crossing of the toy field only and is not offered as a picture of the IGM or of SPH runs.
   * "Each x maps to one u" is correct for a fluid with one velocity at each place. Teach the map; where kernels overlap across steep velocity gradients, do not treat fake_spectra as ground truth.
3. **Damping wings are cut at half a box in both codes.** For an LLS or DLA in a 5 or 20 Mpc/h box, the true periodic sum differs by up to 0.28 in F and 10 % in EW. A DLA figure needs a box much wider than the wing, or an explicitly non-periodic treatment.
4. **Pixel averaging.** fake_spectra stores the pixel-averaged τ, but an instrument records the pixel-averaged F. The two agree when lines are resolved. They differ by ≥ 7e-3 at 10 km/s pixels, and by up to 0.3 for narrow saturated lines. Teaching "F = e^{−τ} per pixel" needs the caveat "for resolved pixels". The LSF must act on F, which lyaphys.js `convolveLSF` already does.
5. **Cold or narrow lines in coarse pixels** are badly wrong in the current default: ΔF = 0.46 and EW +93 % at T = 100 K with 10 km/s pixels. If a temperature slider can go that low, the S8 fix is required.
6. **H mass.** The browser's m_H is correct. fake_spectra's b is 0.37 % low (equivalently, its T inferred from b is 0.74 % high). This is invisible in a plot but is the main systematic between the codes. **Do not "fix" the browser to match.**
7. fake_spectra's `turn_off_selfshield=True` also sets the line's damping constant (`gamma_X`, not Γ_HI) to 0, giving pure Gaussian lines (spectra.py:669-672).

## 7. Tolerance proposal (options, not a decision)

The scales against which a discrepancy should be judged:

* Observed per-pixel noise at S/N 10–50 is σ_F ≈ 0.1–0.02.
* Recent P1D measurements (DESI-era) quote statistical errors of order one to a few % per k-bin at z ≈ 3. I did not re-check the exact values in this task.
* Observational uncertainties on ⟨F⟩ at z ≈ 3 are of order a few %.
* If the spectrum panel is ~300 screen pixels tall for F ∈ [0, 1], one screen pixel is ΔF ≈ 3e-3. This is an assumption about the teaching visual, not a measured fact.

| option | what it certifies | proposed limits | applies to | current status |
|---|---|---|---|---|
| **A. Code verification** (tight) | the JS implements the intended physics exactly | (i) JS vs Python port: max rel τ ≤ 1e-12. (ii) Validation mode (FS mass and Γ via an option, native `point`), JS vs **REF**: max\|ΔF\| ≤ 1e-6, \|ΔEW/EW\| ≤ 1e-6. (iii) Same against **fake_spectra**: max\|ΔF\| ≤ 3e-4 (bounded by F2), relaxed to 2e-2 for broad cold kernels (F1) | C1–C5, C7, C8, excluding the seam pixel (S9) | (i) 5.6e-15 ✓. (ii) ≤ 3e-7 ✓ in the Python port; needs the `mass` option in JS. (iii) ≤ 1.8e-4 ✓ |
| **B. Observational equivalence** (recommended for sign-off against fake_spectra) | the default browser spectra are indistinguishable from fake_spectra's in real data | max\|ΔF\| ≤ 1e-2 per pixel (≤ 0.5σ at S/N 50); \|Δ⟨F⟩\| ≤ 1e-3 (≈ 0.15 % of ⟨F⟩); \|ΔEW/EW\| ≤ 1 % per line; forest P1D ratio within ±1 % for k ≤ 0.05 s/km and ±2 % to 0.1 s/km | gas without strong velocity structure inside a pixel, with b ≥ 2Δu: C1, C2, C3a/b, C4a/b, C5, C7, C8, C9 | max\|ΔF\| 4.9e-3 (C9), 4.5e-3 (C1c); Δ⟨F⟩ 2.9e-4; EW 0.28 %; P1D ≤ 0.37 % ✓ (about 2× margin). C8b is 1.4e-2, but that is fake_spectra's error: it passes against REF (6.6e-4). |
| **C. Visual / teaching** (loose) | a student cannot tell the browser figure from a fake_spectra figure | max\|ΔF\| ≤ 2e-2 (≈ σ_F at S/N 50, ~6 screen pixels); line centroid within 1 pixel; EW within 2 % | all controlled cases; the cases with velocity structure inside a pixel (C3c, C10) listed as a **documented model difference**, not failures | passes everything except C3c (0.089), C10 (≤ 0.20), C4c (0.021, borderline) and C6 (0.46 now; 0.019 with the S8 fix) |

*Note (2026-10-03).* The adopted criterion is a declared-domain version of option B (see `science/SCIENCE_LEDGER.yaml`, VAL-CLOSURE-FS). Option A's case list above (C1–C5, C7, C8) includes C3c and C4c, which have velocity structure inside a pixel; their validation-mode values (C4: 1.9e-3, 2.3e-2) exceed A(iii), so that list should have read "C1, C2, C3a/b, C4a/b, C5, C7, C8". Option A was not adopted.

* **Irreducible** for a real-space method: S7, plus the S10-type modelling choice the two codes share.
* **Fixable**: S1 (validation option), S5, S6/S8 (pixel and resolution handling), S4 (already at 1e-5).
* fake_spectra's own floor (F1–F3) means a browser-vs-fake_spectra tolerance tighter than ~3e-4 in F, for normal kernels, would partly be testing fake_spectra itself.

## 8. Suggested lyaphys.js changes (described only; the file was not edited)

1. `cellsFromSkewer(sk, {nHIScale, bScale, mass, bTurb})`: pass `mass` (and optionally a per-pixel `bTurb` array, e.g. √2·σ_v) to `dopplerB`. This gives a validation mode against fake_spectra (`mass = 1.00794 × 1.67262178e-24`) without touching the physical default. A Γ override is unnecessary (≤ 6e-6).
2. Make the sampling choice depend on resolution:
   * keep `point` for native-resolution skewers, where the deposit already averages over the pixel;
   * when a skewer is oversampled (k real-space pixels per u pixel), use `bin` with nsub ≥ max(8, ⌈Δu/(b/4)⌉) per cell, so narrow lines are sampled (the fixed nsub = 8 under-samples b < Δu/2);
   * optionally an `'auto'` mode that picks `point` when Δu < b/2, as fake_spectra does.
3. Skewer generation: require H·Δx ≤ b_min/2 when cold gas (T ≲ 1e3 K) or coarse u pixels are possible, and down-average with exact pixel averaging (K8). Otherwise clamp a T floor in the teaching UI.
4. Optional: lower `tauFloor` to ~1e-8, removing the S5 ≤ 1.5e-4 forest wing deficit at modest cost.
5. Document that `tauFromCells` takes Δu from the endpoints of `ugrid`, so `ugrid` must be uniform.
6. Document the periodic image convention: cell-based nearest image, which differs from fake_spectra only in the antipodal pixel.

## 9. Files and reproduction

| file | content |
|---|---|
| `science/oracle/fakespectra_closure.py` | constants, port, fake_spectra driver, emulator, reference, deposit, metrics |
| `science/oracle/fakespectra_run_closure.py` | cases and driver → `cases/*.json`, `metrics.json` (~17 min) |
| `science/oracle/fakespectra_validation_mode.py` | → `validation_mode.json` (~3 min) |
| `science/oracle/fakespectra_mocksnap.py` | mock Gadget HDF5 snapshot (in `science/.cache/mocksnap/`) → `mocksnap.json` |
| `science/validation/closure/run_js.js` | runs the real `lyaphys.js` on every case → `js_vs_port.json` |
| `science/validation/closure/make_tables.py` | → `TABLES.md` |
| `cases/<case>.json` | z, cosmo{Om,OL,h}, dx_mpch, x[], nHI[], T[], v[], ugrid[], period_kms, port_options, tau_fake_spectra[], tau_port[], tau_reference[], particles{…}, notes. Exported for C1–C8, C9s0–1 and C10s0. |

```
python3 science/oracle/fakespectra_run_closure.py
python3 science/oracle/fakespectra_validation_mode.py
python3 science/oracle/fakespectra_mocksnap.py
node science/validation/closure/run_js.js
python3 science/validation/closure/make_tables.py > science/validation/closure/TABLES.md
```
