# fake_spectra 2.2.4 — convention audit

Audit of the conventions in Simeon Bird's **fake_spectra** (MIT licence) as they bear on validating the browser's
real-space τ method (`science/js/lyaphys.js`). Every claim cites `file:line` in the **v2.2.4 sdist**. Claims marked
**[verified numerically]** were also confirmed by running the installed package (see
`science/validation/closure/`). Anything I could not verify is marked as unverified.

## 0. Provenance

| item | value |
|---|---|
| source read | PyPI sdist `fake_spectra-2.2.4.tar.gz`, from `https://files.pythonhosted.org/packages/c0/e4/1d2e2ef9ec4ab536a3806264cf2b3cf0bc29964b2481c3bc6d0b8d57fb14/fake_spectra-2.2.4.tar.gz` |
| sha256 | `4cc80e6cb30a7292700a6b90a3161196b37d3b514e8272ba993cc8479091eb84` (same as PyPI's published digest) |
| unpacked at | `science/.cache/fake_spectra-2.2.4/` (gitignored, not redistributed) |
| how it was fetched | `pip download --no-binary :all:` hung while building metadata, so the file was fetched with `curl` from the URL PyPI's JSON API gives, and its checksum was compared with PyPI's. |
| installed copy that was run | a user-level pip install of `fake_spectra` 2.2.4 (Python 3.10), numpy 2.2.6, scipy 1.15.2, h5py 3.16.0 |
| installed copy vs sdist | 2 files differ: `spectra.py:210` (installed: `rscale` cast to `np.float32`) and `ratenetworkspectra.py` (float32 casts). Both are local numpy-2 dtype patches and change rounding only, at about 1e-7. The compiled `_spectra_priv` cannot be compared byte for byte with the sources. Instead, a line-by-line Python re-implementation of the τ kernel (`science/oracle/fakespectra_closure.py::fs_emulate`) reproduces its output to ≤ 1.4e-14 relative for single particles and ≤ 2e-7 for many particles (summation order), across all closure cases. **[verified numerically]** |
| build flags | `setup.py` compiles with `-ffast-math` (sdist `setup.py`, `extra_compile_args=['-ffast-math',]`). |

Call chain for τ: `Spectra.get_tau` (spectra.py:881-893) → `compute_spectra` (801-831) →
`_interpolate_single_file` (501-548) → `_read_particle_data` (550-617) → `_do_interpolation_work` (666-673) →
C `_Particle_Interpolate` = `Py_Particle_Interpolation` (py_module.cpp:103-233) → `ParticleInterp::compute_tau`
(part_int.cpp:20-51) → `LineAbsorption::add_tau_particle` (absorption.cpp:212-279) →
`SingleAbsorber::tau_kern_outer / tau_kern_inner` (singleabs.h:104-167) → `profile` = Re `Faddeeva::w`
(singleabs.h:56-61).

The C entry point's real signature (py_module.cpp:115):
`_Particle_Interpolate(compute_tau:int, nbins:int, kernel:int, box:double, velfac, atime, lambda[cm], gamma[s^-1],
fosc, amumass, tautail, pos f32[N,3], vel f32[N,3], dens f32[N], temp f32[N], h f32[N], axis int32[NLOS],
cofm f64[NLOS,3])`. Type checks are at py_module.cpp:122-133. The module docstring (py_module.cpp:359-362) is
**out of date**: it leaves out `kernel` and `tautail`.

## 1. Units read from snapshots; h factors

| quantity | convention | citation |
|---|---|---|
| positions, box | comoving kpc/h (Gadget internal), float32 | absorption.h:15-20; spectra.py:552, 182 |
| unit system | default `UnitLength_in_cm=3.085678e21`, `UnitMass_in_g=1.98892e43`, `UnitVelocity=1e5`. Overridden by header attrs if present. | unitsystem.py:7; abstractsnapshot.py:102-112 |
| proper length per code length | `rscale = UnitLength_in_cm * a / h` (cm per comoving kpc/h) | spectra.py:210 |
| velocities (HDF5 / Gadget) | snapshot `Velocities` × **√a** → physical peculiar km/s | abstractsnapshot.py:114-119 **[verified numerically: line appears at velfac·x + v_pec]** |
| velocities (BigFile / MP-Gadget) | `Velocity / a` unless header `UsePeculiarVelocity` is set | abstractsnapshot.py:399-406 (not exercised) |
| velocity passed to C | LOS component `Vel[3*ipart+axis-1]`, physical km/s, no further factors in C | part_int.cpp:41; absorption.h:44. The comment at absorption.cpp:214-217 ("gadget velocities come comoving, so we need the sqrt(a) conversion factor") is stale: no √a is applied in C. |
| smoothing length | fake_spectra's `h` is the kernel **support radius** (K=0 for q ≥ 1, singleabs.h:20). For Gadget HDF5 it is `SmoothingLength/2`. For Arepo it is `Volume^(1/3)` or `(Masses/Density)^(1/3)`. | abstractsnapshot.py:253-282 (also 93-100) **[verified numerically: column support = ±SmoothingLength/2]**. Whether halving is right depends on how the simulation code defines `SmoothingLength`; this audit did not check that. |
| gas density → n_H | `Density × UnitDensity × h² / m_p × (1+z)³` = physical "amu"/cm³ (really proton masses/cm³) | gas_properties.py:105-110 |
| n_HI per particle | `elem_den = den · rscale · X_H · f_HI / amumass`. Units are atoms cm⁻³ × (cm per kpc/h), so that × (kernel integral in kpc/h) gives cm⁻². `X_H` comes from `GFM_Metals` or falls back to 0.76. `f_HI` comes from `NeutralHydrogenAbundance`, with the Rahmati self-shielding correction applied above the SF threshold. | spectra.py:576, 591-597, 615; spectra.py:687-711; gas_properties.py:116-146 |
| temperature | `T = (γ-1) m_p/k_B · 4/(X(3+4 n_e)+1) · u`. Uses `k_B = 1.38066e-16`, `m_p = 1.67262178e-24` (Python side). T ≤ 0 is set to 1 K. | abstractsnapshot.py:121-154; unitsystem.py:21-23; spectra.py:585-589 **[verified numerically]** |
| kernel choice | HDF5 with `SmoothingLength` gives **cubic spline (1)**, whatever kernel the simulation used. With `Volume`, or without `SmoothingLength` (Arepo), it gives top hat (0). Override with `kernel=`. | abstractsnapshot.py:284-301; spectra.py:139-153 |

## 2. Velocity-space mapping

* `Hz = 100 h sqrt(Ωm/a³ + ΩΛ)` km/s/Mpc: flat, no radiation. It can be overridden with `use_external_Hz`. (spectra.py:212-214, 197-203)
* `velfac = rscale · Hz / 3.085678e24` = a H(z)/h /1000 km/s per comoving kpc/h. This is identical to the browser's `100 E(z)/(1+z)` per Mpc/h, up to the Mpc constant (1.4e-7). (spectra.py:216; absorption.h:18-19)
* `vmax = box · velfac` (periodic velocity length, spectra.py:217). `nbins = int(vmax/res)` (230). `dvbin = vmax/nbins` (232), so `dvbin ≥ res` because of the truncation. **Quirk:** if both `res` and `nbins` are passed with `reload_file=True`, `self.nbins` is never set and line 232 raises `AttributeError` (spectra.py:220-232). **[hit in the mock-snapshot test]**
* Particle velocity coordinate: `vel = velfac · pos + pvel` (absorption.cpp:234). **Sign:** positive LOS peculiar velocity (along +axis, away from an observer at small x) goes to larger u, which is the browser's convention. **[verified numerically, cases C7a/b]**
* **Pixel edges/centres:** pixel j covers u ∈ [j·dvbin, (j+1)·dvbin) and u = 0 at x = 0 (absorption.cpp:240, 246, 252: `zmax = floor(vel/bintov)`, `vlow = z·bintov − vel`). The pixel centre is (j+½)·dvbin. The real-space column grid uses the same edges, [j, j+1)·box/nbins (absorption.cpp:188-196).
* **Periodicity:** the bin index is wrapped with `j = z % nbins` (absorption.cpp:257-259, 271-273). Each particle is added only over the bins `zmax − nbins/2 … zmax + nbins/2 − 1` around its own pixel, i.e. its nearest image (loops at absorption.cpp:250, 266). Damping wings wider than half a box are cut (comment at 248-249). With odd `nbins` the two loops cover only nbins−1 bins (integer division), so one bin opposite the particle is skipped. Transverse distances are wrapped periodically (index_table.cpp:70-87).
* The sightline runs along `axis` (1-indexed, 1 = x; particles_near_lines asserts 1..3, spectra.py:681-683). `cofm`'s along-axis coordinate is ignored. A particle counts if `dr² ≤ h²` (index_table.cpp:44-47) and `h² − dr² > 0` (absorption.cpp:232).

## 3. Thermal broadening

* `btherm = bfac · sqrt(T)` with `bfac = sqrt(2 k_B /(amumass · PROTONMASS)) / 1e5` (absorption.cpp:155, 220).
* `amumass` for H is **1.00794** (`LineData.masses`, line_data.py:21; passed at spectra.py:579, 673). `PROTONMASS = 1.67262178e-24` g (absorption.h:4, whose comment says "1 a.m.u", although the value is the proton mass). So m = 1.00794 m_p = **1.68590e-24 g**. The ¹H atom mass is 1.6735328e-24 g (1.00782503 u; the browser value since the 2026-10-02 correction), so fake_spectra's H mass is **0.739 % too heavy** (an atomic-mass-unit vs proton-mass mix-up). As a result its b is **0.367 % smaller** than `sqrt(2kT/m_H)` at fixed T. The same 1.00794·m_p appears in n_H (spectra.py:615 with gas_properties.py:108), so n_H is 0.74 % low. **[verified numerically: this one constant accounts for essentially all of the 'constants' discrepancy]**
* `k_B = 1.3806504e-16` in C (absorption.cpp:24), against the browser's 1.380649e-16 (1e-6 relative).
* Temperature: the particle's own `temp` (one value per particle; spectra.py:585). No turbulent b term.

## 4. Line profile, pixel treatment, tail cutoff

* **Profile:** `profile(T0, aa) = Re Faddeeva::w(T0 + i·aa)`, i.e. the exact Voigt–Hjerting H(a,x), using S. G. Johnson's MIT Faddeeva package with default `relerr` = machine ε (singleabs.h:56-61; Faddeeva.h:35; Faddeeva.cpp:679-698). `aa = voigt_fac/btherm` with `voigt_fac = Γ λ /(4π)/1e5` km/s (absorption.cpp:156, 238), which is the same as the browser's `a = Γλ/(4πb)`.
* **Normalisation:** `amp = sigma_a/√π · (c/1e5)/btherm` with `sigma_a = sqrt(3π σ_T/8) λ f` = π r_e λ f (absorption.cpp:154, 244). So τ = N (π r_e c f λ) H(a,x)/(√π b), the same form as the browser's `N σ_v H/(√π b)` with σ_v = (πe²/m_e c) f λ. The constants agree to 3.3e-6 (σ_T is the CODATA-2006 value, absorption.cpp:21).
* **Pixel treatment (`tau_kern_outer`, singleabs.h:104-126):** if `dvbin < b/2`, τ is evaluated **at the pixel centre** (110-113). Otherwise it is the trapezoid-rule **average of τ over the pixel**, with `npoints = 2·ceil(dvbin/(b/2)/2)+1` (spacing ≤ b/2, at 114-125). So `get_tau` returns the pixel-averaged **τ**, not −ln of the pixel-averaged flux.
* **Tail cutoff:** for each particle, the bins are walked outward from the particle's pixel. A bin's τ is added, and the walk stops once that bin's τ is `< tautail` (absorption.cpp:250-278). The default is `Spectra.tautail = 1e-7` (spectra.py:135). The walk also stops at half a box in each direction (see §2).
* **`turn_off_selfshield=True` sets the damping constant Γ to 0** (pure Gaussian profiles) in `_do_interpolation_work` (spectra.py:669-672), as well as acting on self-shielding. This is surprising, and anyone setting that flag should know about it.

## 5. SPH kernel along the line of sight; velocity across a kernel

* Kernel: cubic spline with support q < 1, `K(q) = (8/π)(1 − 6q² + 6q³)` for q < ½ and `(8/π)·2(1−q)³` for ½ ≤ q < 1, normalised to 4π∫K q² dq = 1 (singleabs.h:17-26; absorption.cpp:44-52). Quintic, top-hat and Voronoi kernels also exist (singleabs.h:9-12, 28-42; absorption.cpp:109-148).
* **Particle content:** the density field is n(r) = Σ n_p K(|r−r_p|/h_p). So the column through the centre is n_p·(6/π)·h_p (proper). A particle carries n_p·h_p³ atoms, not m_p/ρ_p·n_p (abstractsnapshot.py:257-258 states the normalisation "ρ_p = m_p/h³"). **[verified numerically: column = n_HI·rscale·(6/π)·SmoothingLength/2]**
* **τ (`tau_kern_inner`, singleabs.h:143-167):** the kernel is integrated along the LOS in velocity units, with chord half-width `m_vhigh = velfac·sqrt(h² − dr²)`. The rule is a trapezoid with **NGRID = 8** intervals, so **7 interior nodes** (the endpoints have K = 0 and are skipped) (singleabs.h:8, 146-150). Each node carries K(q) and a Voigt profile centred on `vel + vv`, where `vv = velfac·z` (152-157).
  * **Every part of a particle's kernel moves with the particle's single peculiar velocity plus the Hubble flow across the kernel.** There is no velocity gradient inside a particle. Velocity structure comes only from the superposition of overlapping particles.
  * With dr² = 0 and the cubic kernel, the 7 nodes fall on the kernel's breakpoints, so the total column is exact. The *shape* is a sum of 7 profiles spaced by 2 m_vhigh/8, which ripples when that spacing is comparable to or larger than b (broad kernels and cold gas; see closure case C8b).
* Column density (`compute_tau=0`): the kernel is integrated over each real-space pixel with a trapezoid of 8 intervals (absorption.cpp:53-74, 188-209).

## 6. Line data and physical constants (H I Lyα)

| | fake_spectra 2.2.4 | browser (`lyaphys.js` C) | relative |
|---|---|---|---|
| λ | 1215.6701 Å (atom.dat:7 → `line_data.read_vpfit`, line_data.py:59-111; ×1e-8 at spectra.py:673) | 1215.6701 Å | 0 |
| f | 0.416400 (atom.dat:7) | 0.4164 | 0 |
| Γ | 6.265E8 s⁻¹ (atom.dat:7) | 6.2649e8 | 1.6e-5 |
| H mass for b | 1.00794 × 1.67262178e-24 g (line_data.py:21; absorption.h:4) | 1.6735328e-24 g | **+0.739 %** |
| k_B (C) | 1.3806504e-16 (absorption.cpp:24) | 1.380649e-16 | 1e-6 |
| π e²/(m_e c) | sqrt(3πσ_T/8)·c, σ_T = 6.652458558e-25 (absorption.cpp:21, 154) → 0.0265400882 | 2.6540e-2 | 3.3e-6 |
| c | 2.99792458e10 (C, absorption.cpp:26). **`UnitSystem.light = 2.99e10`** (unitsystem.py:19) is used only in Python helpers (`equivalent_width`, spectra.py:839; absorption distance, unitsystem.py:42) and is 0.27 % low. | 299792.458 km/s | — |
| Mpc | 3.085678e24 cm (spectra.py:216) | 3.0856775814913673e24 | 1.4e-7 |
| atom.dat line 7 comment | "Morton(03), 2cpts sep by 1.3 km/s" — the two fine-structure components are treated as one line (as in the browser) | | |

## 7. What `get_tau` returns; normalisation

* `get_tau` returns raw τ[NumLos, nbins] from `compute_spectra` (spectra.py:881-893). Each value is the pixel-averaged τ (or the centre value when dvbin < b/2, §4). **No mean-flux rescaling and no instrumental smoothing are applied.**
* Mean-flux rescaling is opt-in through the `mean_flux_desired` arguments of `get_flux_power_1D`, `get_flux_pdf` and `get_flux_power_3D` (spectra.py:1278-1321 → fluxstatistics.py:26-39, 71-108). It solves for a single constant τ scale factor by Newton–Raphson (py_module.cpp:235-262). `get_mean_flux` does not rescale (spectra.py:1272-1276). `get_curvature` always rescales to `obs_mean_tau(z) = 0.0023 (1+z)^3.65` (fluxstatistics.py:21-24; spectra.py:1517).
* `spec_res` is a Gaussian **FWHM** applied to the **flux** (spec_utils.py:5-25). It is used only in `get_observer_tau` and the window correction of `flux_power`, never in `get_tau`. The class docstring calls it an "rms" (spectra.py:60-61), which disagrees with the code.

## 8. Real-space fields (if skewers are ever generated with fake_spectra)

* `get_col_density` gives the real-space column per pixel in cm⁻² (pixel edges as in §2, peculiar velocities ignored; part_int.h:39-42). `get_density` = colden / (dvbin/velfac·rscale), the proper pixel length (spectra.py:875-879).
* `get_temp` gives the HI-column-weighted T per real-space pixel (spectra.py:994-1013, 958-981). **[verified numerically]**
* **`get_velocity` returns √a × v_pec, not v_pec.** `_read_particle_data` already converts to peculiar velocity (√a at abstractsnapshot.py:118, called from spectra.py:573), and `_vel_single_file` multiplies by `np.sqrt(self.atime)` again (spectra.py:954). At z = 3 this halves the velocities. **[verified numerically: get_velocity/v_pec = 0.5000 at a = 0.25]** The same line is still in upstream `master` (fetched 2026-10-02; `science/.cache/upstream_master_spectra.py:992`, sha256 `1e9b5feb…`). **Any browser skewer built from `Spectra.get_velocity()` must be divided by √a**, or the velocities must be computed independently.
* Under numpy 2, `get_velocity` fails outright with "One of the data arrays does not have 32-bit float type": `phys` is a float64 numpy scalar, so `elem_den*weight/phys` is promoted to float64 (spectra.py:952-955). The test used an in-process float32 shim, without modifying any file.
* Under numpy 2, `HDF5Snapshot.get_npart` overflows (`2**32 * uint32`) for headers whose `NumPart_Total` is `uint32`, which is how Gadget writes it (abstractsnapshot.py:226-228). The mock snapshot uses int64 to get past this.

## 9. Differences from the browser convention (summary)

| aspect | fake_spectra | browser (`lyaphys.js`) | effect on τ / F (closure study) |
|---|---|---|---|
| H mass in b | 1.00794 m_p (0.74 % heavy) | m_H | b −0.37 %; relative τ in the core up to 1.4 %; max\|ΔF\| up to 4.3e-3 (N=1e14 line) and 5.5e-3 (forest); the dominant difference wherever the gas in each pixel has a single velocity |
| Γ, σ, k_B, c, Mpc | see §6 | — | max\|ΔF\| ≤ 6e-6 (Γ; only in DLA wings) and ≤ 2e-6 (k_B, σ) |
| Voigt | exact (Faddeeva) | Humlicek W4 (≤ 8.5e-5 rel.) | ≤ 4e-5 rel. in τ; max\|ΔF\| ≤ 1.6e-5 |
| matter model | particles: own v, own T, kernel moves rigidly + Hubble | one v, T per real-space pixel (HI-weighted) | irreducible for a skewer with one v and one T per pixel: several kernels with different velocities overlapping one real-space pixel cannot be represented. max\|ΔF\|: 0.09 (C3c, two components at the same position), 0.023 (C4c, kernels overlapping across a velocity gradient that folds u(x)), up to 0.19 (C10, a 1D Zel'dovich toy field deliberately evolved past shell crossing: an exaggerated stress test, not a model of the IGM or of SPH runs), 3.6e-3 (gas-like forest, C9) |
| pixel value | pixel-average of τ (centre value if dv < b/2) | `point`: τ at the pixel centre; `bin`: 8 midpoint sub-samples | With a native-resolution skewer, `point` reproduces the exact pixel average to ≤ 3e-7 once constants are aligned. `bin` double-counts the pixel (5e-4 relative τ). Fails badly for b < dv (C6: ΔF up to 0.46) |
| tails | per-particle stop when the bin's τ < 1e-7, ±½ box | core 8b plus wing until τ < 1e-6, nearest image | max\|ΔF\| ≤ 1.5e-4, \|ΔEW/EW\| ≤ 1.5e-4 |
| periodicity | nearest image (particle-based window) | nearest image (`d − P·round(d/P)`, cell-based) | identical except the one pixel opposite a strong line (ΔF 1.1e-3 for N=1e19 in a 5 Mpc/h box). Both differ from the true periodic sum by up to 0.28 in F (LLS/DLA wings) |
| u grid | pixel j ↔ [j, j+1)·dvbin, centre (j+½)·dvbin | ugrid supplied by the caller | pass `ugrid = (j+½)·period/nbins` |
