## Headline: port (lyaphys.js default) vs fake_spectra, and both vs the exact reference

| case | description | max rel τ (core) | max\|ΔF\| | Δ⟨F⟩ | ΔEW/EW | FS−REF max\|ΔF\| | port−REF max\|ΔF\| | JS−port max rel τ |
|---|---|---|---|---|---|---|---|---|
| C1a | isolated line N=1e+12, T=1e4 K, v=0, h=30 kpc/h | 1.4e-2 | 2.1e-4 | -1.5e-7 | 6.5e-5 | 8.3e-6 | 2.0e-4 | 4.0e-15 |
| C1b | isolated line N=1e+13, T=1e4 K, v=0, h=30 kpc/h | 1.4e-2 | 1.2e-3 | -1.3e-5 | 6.7e-4 | 4.9e-5 | 1.2e-3 | 3.8e-15 |
| C1c | isolated line N=1e+14, T=1e4 K, v=0, h=30 kpc/h | 1.4e-2 | 4.5e-3 | -1.9e-4 | 2.8e-3 | 1.8e-4 | 4.3e-3 | 4.0e-15 |
| C1d | isolated line N=1e13 through the kernel at impact parameter 0.6h (dr2> | 1.3e-2 | 1.3e-3 | -8.2e-6 | 4.1e-4 | 1.5e-4 | 1.2e-3 | 4.0e-15 |
| C2a | LLS N=1e19, T=1e4 K (5 Mpc/h box) | 1.4e-2 | 1.1e-3 | -1.3e-5 | 1.8e-5 | 1.6e-6 | 1.1e-3 | 3.9e-15 |
| C2b | DLA N=2e20, T=1e4 K (5 Mpc/h box: wings truncated at half box) | 1.4e-2 | 3.8e-5 | -9.0e-8 | 9.0e-8 | 8.0e-9 | 3.8e-5 | 4.0e-15 |
| C2c | DLA N=2e20, T=1e4 K in a 20 Mpc/h box (2048 px) | 1.5e-2 | 2.0e-4 | 2.9e-6 | -3.9e-6 | 3.1e-7 | 2.0e-4 | 3.9e-15 |
| C3a | two N=1e13 lines 1b apart in real space | 1.1e-2 | 9.9e-4 | -2.3e-5 | 6.5e-4 | 3.9e-5 | 9.5e-4 | 2.7e-15 |
| C3b | two N=1e13 lines 2b apart in real space | 1.3e-2 | 1.1e-3 | -1.5e-5 | 3.8e-4 | 4.3e-5 | 1.0e-3 | 2.7e-15 |
| C3c | two N=1e13 particles at the SAME position, v = ±b/2 (velocity split in | 5.9e-1 | 8.9e-2 | 2.2e-3 | -6.2e-2 | 3.9e-5 | 8.9e-2 | 3.8e-15 |
| C4a | 81 overlapping particles (h=4x spacing), overdensity + infall v=-0.5 a | 4.5e-3 | 1.5e-3 | 9.9e-5 | -7.1e-4 | 1.7e-5 | 1.5e-3 | 1.4e-15 |
| C4b | same structure, expansion v=+0.5 aH(x-xc) (stretch x1.5 in u) | 4.9e-4 | 6.1e-4 | 4.9e-5 | -1.5e-4 | 9.5e-6 | 6.1e-4 | 1.0e-15 |
| C4c | same structure, strong tapered infall (u(x) folds; kernels with different v overlap) | 7.6e-2 | 2.1e-2 | 1.3e-3 | -1.2e-2 | 4.1e-5 | 2.1e-2 | 1.1e-15 |
| C5a | N=1e14 particle whose kernel straddles x=box (x=4995, h=30) | 1.3e-2 | 4.5e-3 | -1.9e-4 | 2.8e-3 | 1.8e-4 | 4.3e-3 | 3.9e-15 |
| C5b | N=1e14 particle at x=4950 with v=+20 km/s: wraps in velocity only | 1.3e-2 | 4.5e-3 | -1.9e-4 | 2.8e-3 | 1.8e-4 | 4.3e-3 | 3.4e-15 |
| C6a | cold line T=1e2 K (b=1.28), N=1e13, coarse pixels (56 px, 9.96 km/s) | 4.2e+0 | 4.5e-1 | -1.5e-2 | 8.8e-1 | 1.6e-3 | 4.5e-1 | 6.7e-16 |
| C6b | T=1e3 K (b=4.06), N=1e13, coarse pixels | 7.8e-1 | 2.1e-1 | -3.6e-3 | 2.0e-1 | 4.5e-4 | 2.1e-1 | 3.9e-15 |
| C6c | T=1e4 K (b=12.8), N=1e13, coarse pixels | 3.4e-1 | 4.9e-2 | -1.8e-4 | 9.2e-3 | 5.2e-3 | 5.4e-2 | 5.6e-15 |
| C6d | T=1e2 K, N=1e13, particle placed at a real-space pixel EDGE (x=2589.3) | 3.4e+0 | 4.6e-1 | -1.6e-2 | 9.3e-1 | 4.9e-6 | 4.6e-1 | 6.5e-16 |
| C7a | sign test: N=1e14, v=+30 km/s (must appear at larger u) | 1.4e-2 | 4.5e-3 | -1.9e-4 | 2.8e-3 | 1.8e-4 | 4.3e-3 | 3.2e-15 |
| C7b | sign test: N=1e14, v=-30 km/s | 1.3e-2 | 4.5e-3 | -1.9e-4 | 2.8e-3 | 1.8e-4 | 4.3e-3 | 2.5e-15 |
| C8a | broad kernel h=300 kpc/h (±33 km/s), T=1e4, N=1e14 | 7.1e-3 | 2.1e-3 | -1.0e-4 | 1.2e-3 | 6.8e-4 | 1.7e-3 | 1.8e-15 |
| C8b | broad kernel h=300 kpc/h, cold T=2e3 (b=5.7), N=1e14 | 4.7e-2 | 1.4e-2 | -2.1e-5 | 2.8e-4 | 1.5e-2 | 6.6e-4 | 8.8e-16 |
| C9s0 | forest-like 1D field, lognormal (Bi-Davidsen-like) density, sigma_g=0. | 8.5e-3 | 4.2e-3 | -2.4e-4 | 7.2e-4 | 5.0e-4 | 3.8e-3 | 4.7e-16 |
| C9s1 | forest-like 1D field, lognormal (Bi-Davidsen-like) density, sigma_g=0. | 7.9e-3 | 4.3e-3 | -2.9e-4 | 8.4e-4 | 4.8e-4 | 3.9e-3 | 4.9e-16 |
| C9s2 | forest-like 1D field, lognormal (Bi-Davidsen-like) density, sigma_g=0. | 5.7e-3 | 4.1e-3 | -1.6e-4 | 5.0e-4 | 3.8e-4 | 3.7e-3 | n/e |
| C9s3 | forest-like 1D field, lognormal (Bi-Davidsen-like) density, sigma_g=0. | 3.5e-3 | 2.5e-3 | -4.9e-5 | 1.8e-4 | 3.0e-4 | 2.4e-3 | n/e |
| C9s4 | forest-like 1D field, lognormal (Bi-Davidsen-like) density, sigma_g=0. | 9.2e-3 | 4.7e-3 | -2.3e-4 | 7.1e-4 | 6.0e-4 | 4.1e-3 | n/e |
| C9s5 | forest-like 1D field, lognormal (Bi-Davidsen-like) density, sigma_g=0. | 6.8e-3 | 3.7e-3 | -1.3e-4 | 4.1e-4 | 4.3e-4 | 3.3e-3 | n/e |
| C9s6 | forest-like 1D field, lognormal (Bi-Davidsen-like) density, sigma_g=0. | 6.4e-3 | 3.2e-3 | -1.3e-4 | 4.4e-4 | 4.3e-4 | 3.0e-3 | n/e |
| C9s7 | forest-like 1D field, lognormal (Bi-Davidsen-like) density, sigma_g=0. | 9.4e-3 | 4.9e-3 | -2.3e-4 | 6.8e-4 | 4.8e-4 | 4.7e-3 | n/e |
| C10s0 | exaggerated stress test: 1D Zel'dovich toy field past shell crossing (rms dpsi/dq=0.7) | 4.9e-1 | 1.4e-1 | 5.6e-4 | -1.8e-3 | 1.6e-4 | 1.4e-1 | 5.1e-16 |
| C10s1 | exaggerated stress test: 1D Zel'dovich toy field past shell crossing (rms dpsi/dq=0.7) | 1.8e-1 | 5.9e-2 | 1.7e-3 | -5.3e-3 | 1.9e-4 | 5.9e-2 | n/e |
| C10s2 | exaggerated stress test: 1D Zel'dovich toy field past shell crossing (rms dpsi/dq=0.7) | 4.6e-1 | 1.3e-1 | 1.9e-3 | -6.0e-3 | 1.8e-4 | 1.3e-1 | n/e |
| C10s3 | exaggerated stress test: 1D Zel'dovich toy field past shell crossing (rms dpsi/dq=0.7) | 4.4e-1 | 2.0e-1 | 3.2e-3 | -1.0e-2 | 1.5e-4 | 2.0e-1 | n/e |

## One-at-a-time toggles from the port default (max|ΔF| over the cases in each group; [ΔEW/EW] of that case)

| source | C1 | C2 | C3 | C4 | C5 | C6 | C7 | C8 | C9 | C10 |
|---|---|---|---|---|---|---|---|---|---|---|
| constants(FS m=1.00794 m_p, k_B, Gamma, sigma) | 4.3e-3 [-2.7e-3] | 3.4e-5 [-1.7e-5] | 1.5e-3 [-1.2e-3] | 2.1e-3 [-1.2e-3] | 4.3e-3 [-2.7e-3] | 1.3e-3 [1.9e-3] | 4.3e-3 [-2.7e-3] | 1.7e-3 [-1.2e-3] | 5.5e-3 [-7.5e-4] | 2.1e-3 [-3.3e-4] |
|   constants: H mass only (1.00794 m_p vs m_H) | 4.3e-3 [-2.7e-3] | 3.9e-5 [-2.3e-5] | 1.5e-3 [-1.2e-3] | 2.1e-3 [-1.2e-3] | 4.3e-3 [-2.7e-3] | 1.3e-3 [1.9e-3] | 4.3e-3 [-2.7e-3] | 1.7e-3 [-1.2e-3] | 5.5e-3 [-7.5e-4] | 2.1e-3 [-3.4e-4] |
|   constants: Gamma only (6.265e8 vs 6.2649e8) | 9.8e-9 [1.3e-8] | 5.9e-6 [4.4e-6] | 3.1e-9 [3.4e-9] | 3.1e-9 [3.2e-9] | 9.8e-9 [1.3e-8] | 2.3e-8 [-1.1e-8] | 9.8e-9 [1.3e-8] | 8.2e-9 [8.3e-9] | 1.7e-8 [3.2e-9] | 3.8e-9 [7.8e-10] |
|   constants: k_B and pi e^2/m_e c only | 1.7e-6 [1.2e-6] | 1.2e-6 [9.9e-7] | 1.2e-6 [2.4e-6] | 1.4e-6 [1.8e-6] | 1.7e-6 [1.2e-6] | 1.0e-6 [1.7e-6] | 1.7e-6 [1.2e-6] | 1.4e-6 [1.2e-6] | 2.0e-6 [1.7e-6] | 1.4e-6 [2.1e-6] |
| voigt(W4->wofz) | 1.1e-5 [-4.0e-6] | 1.6e-5 [3.4e-6] | 1.5e-5 [-3.5e-6] | 7.1e-6 [-2.4e-6] | 3.7e-6 [-4.2e-7] | 4.2e-6 [-1.0e-5] | 3.7e-6 [-4.2e-7] | 2.2e-6 [-1.6e-6] | 8.8e-6 [-2.1e-6] | 1.4e-5 [-3.1e-6] |
| truncation(cut 8b/tauFloor -> none) | 4.7e-6 [2.5e-5] | 0 [0] | 4.7e-6 [3.4e-5] | 1.9e-5 [2.5e-5] | 4.8e-6 [2.5e-5] | 1.4e-6 [1.2e-5] | 4.7e-6 [2.5e-5] | 4.6e-5 [1.5e-4] | 1.5e-4 [9.6e-5] | 2.2e-5 [3.0e-5] |
| sampling(point->JS bin nsub=8) | 1.7e-4 [1.1e-4] | 2.1e-6 [9.3e-7] | 6.0e-5 [4.8e-5] | 4.1e-5 [2.3e-5] | 1.7e-4 [1.1e-4] | 5.0e-1 [-4.8e-1] | 1.7e-4 [1.1e-4] | 1.3e-4 [8.1e-5] | 5.8e-4 [8.4e-5] | 1.7e-4 [3.1e-5] |
| sampling(point->exact pixel average) | 1.8e-4 [1.1e-4] | 1.9e-6 [9.4e-7] | 6.1e-5 [4.9e-5] | 4.1e-5 [2.4e-5] | 1.8e-4 [1.1e-4] | 5.0e-1 [-4.8e-1] | 1.8e-4 [1.1e-4] | 1.3e-4 [8.3e-5] | 5.8e-4 [8.6e-5] | 1.7e-4 [3.1e-5] |
| velocity/T assignment(HI-weighted pixel mean -> per-particle cells) | 1.7e-16 [0] | 2.2e-16 [0] | 9.0e-2 [6.6e-2] | 2.3e-2 [1.3e-2] | 1.1e-16 [0] | 0 [0] | 8.3e-17 [0] | 1.1e-16 [0] | 3.6e-3 [1.2e-4] | 1.9e-1 [1.1e-2] |
| real-space pixelisation(nx=nbins -> finer, point) | 1.8e-4 [-1.7e-4] | 1.8e-5 [-3.7e-7] | 6.1e-5 [-4.9e-5] | 1.5e-5 [7.4e-6] | 1.8e-4 [-1.7e-4] | 9.8e-1 [-1.0e+0] | 1.8e-4 [-1.7e-4] | 1.3e-4 [-1.5e-4] | 4.2e-4 [-7.9e-6] | 1.3e-2 [9.7e-4] |

## fake_spectra's own numerical error vs the exact reference (max|ΔF| over group [ΔEW/EW])

| source | C1 | C2 | C3 | C4 | C5 | C6 | C7 | C8 | C9 | C10 |
|---|---|---|---|---|---|---|---|---|---|---|
| FS_vs_REF | 1.8e-4 [-1.1e-4] | 1.6e-6 [-9.2e-7] | 4.3e-5 [-1.6e-5] | 4.1e-5 [-3.4e-5] | 1.8e-4 [-1.1e-4] | 5.2e-3 [4.0e-3] | 1.8e-4 [-1.1e-4] | 1.5e-2 [-2.6e-5] | 6.0e-4 [-1.4e-4] | 1.9e-4 [-6.5e-5] |
| kernel_quadrature_NGRID8_vs_256 | 1.0e-4 [2.6e-4] | 1.9e-10 [7.5e-11] | 1.4e-7 [-1.9e-8] | 3.1e-6 [-4.0e-7] | 2.1e-7 [1.7e-8] | 1.1e-6 [-1.7e-7] | 2.1e-7 [1.7e-8] | 1.5e-2 [5.7e-5] | — | — |
| kernel_quadrature_NGRID8_vs_32 | — | — | — | — | — | — | — | — | 4.5e-4 [-1.0e-8] | 1.6e-8 [9.5e-10] |
| pixel_quadrature_fs_vs_exact | 1.8e-4 [-1.1e-4] | 1.6e-6 [-9.2e-7] | 4.2e-5 [-1.6e-5] | 3.8e-5 [-2.2e-5] | 1.8e-4 [-1.1e-4] | 5.2e-3 [4.0e-3] | 1.8e-4 [-1.1e-4] | 2.1e-4 [-8.4e-5] | 5.9e-4 [-8.6e-5] | 1.7e-4 [-3.2e-5] |
| tautail_1e-7_vs_0 | 9.9e-8 [-1.0e-5] | 2.8e-15 [0] | 7.8e-16 [-1.8e-16] | 2.5e-6 [-1.1e-5] | 3.6e-15 [0] | 2.8e-10 [-1.2e-10] | 3.8e-15 [-3.7e-16] | 1.9e-9 [-7.4e-10] | — | — |
| half_box_window_vs_all_images(REF) | — | 2.8e-1 [-1.0e-1] | — | — | 4.4e-6 [-4.0e-5] | — | — | — | — | — |

## Cumulative ladder port → reference (max|ΔF| per step) for representative cases

| step | C1b | C1c | C2a | C3c | C4a | C4c | C5a | C6a | C6c | C8b | C9s0 | C10s0 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| L1 +FS constants | 1.2e-3 | 4.3e-3 | 3.4e-5 | 1.5e-3 | 9.8e-4 | 2.1e-3 | 4.3e-3 | 1.0e-3 | 8.3e-4 | 6.6e-4 | 4.9e-3 | 2.0e-3 |
| L2 +wofz | 1.1e-5 | 3.6e-6 | 1.6e-5 | 1.5e-5 | 2.1e-6 | 7.1e-6 | 3.7e-6 | 8.6e-8 | 4.0e-6 | 1.9e-6 | 7.6e-6 | 1.1e-5 |
| L3 +no truncation | 2.4e-6 | 4.7e-6 | 0 | 4.7e-6 | 1.4e-5 | 9.9e-6 | 4.8e-6 | 1.2e-6 | 1.2e-6 | 4.6e-5 | 8.6e-5 | 1.7e-5 |
| L4 +per-particle v,T | 1.1e-16 | 1.1e-16 | 0 | 9.1e-2 | 1.9e-3 | 2.3e-2 | 1.1e-16 | 0 | 0 | 1.1e-16 | 3.1e-3 | 1.4e-1 |
| L5 +finer real-space pixels | 4.9e-5 | 1.8e-4 | 1.7e-5 | 3.9e-5 | 1.6e-5 | 3.8e-5 | 1.8e-4 | 9.8e-1 | 6.4e-2 | 1.3e-4 | n/a | n/a |
| L6 +exact pixel average | 4.9e-5 | 1.8e-4 | 1.6e-6 | 3.9e-5 | 1.6e-5 | 3.8e-5 | 1.8e-4 | 5.3e-1 | 1.1e-2 | 1.3e-4 | n/a | n/a |
| residual vs REF (last step vs exact reference) | 1.9e-7 | 6.9e-7 | 1.1e-3 | 1.5e-7 | 6.1e-8 | 1.5e-7 | 6.9e-7 | 4.8e-5 | 2.5e-6 | 5.3e-7 | 4.4e-6 | 1.4e-3 |

(Forest cases C9/C10 stop at L4; their residual is L4 vs REF, i.e. native-resolution pixelisation + point sampling.)

## Practical browser configurations (browser constants) vs fake_spectra: max|ΔF| [ΔEW/EW] (worst case in group)

| configuration | C1 | C2 | C3 | C4 | C5 | C6 | C7 | C8 | C9 | C10 |
|---|---|---|---|---|---|---|---|---|---|---|
| K1 native skewer, point (current default) | 4.5e-3 [2.8e-3] | 1.1e-3 [1.8e-5] | 8.9e-2 [-6.2e-2] | 2.1e-2 [-1.2e-2] | 4.5e-3 [2.8e-3] | 4.6e-1 [9.3e-1] | 4.5e-3 [2.8e-3] | 1.4e-2 [2.8e-4] | 4.9e-3 [6.8e-4] | 2.0e-1 [-1.0e-2] |
| K2 native skewer, JS bin nsub=8 | 4.7e-3 [2.9e-3] | 1.1e-3 [1.9e-5] | 8.9e-2 [-6.2e-2] | 2.1e-2 [-1.2e-2] | 4.7e-3 [2.9e-3] | 1.2e-1 [4.7e-3] | 4.7e-3 [2.9e-3] | 1.4e-2 [3.6e-4] | 5.3e-3 [7.9e-4] | 2.0e-1 [-1.0e-2] |
| K3 native skewer + sigv broadening, point | 4.5e-3 [2.8e-3] | 1.1e-3 [1.8e-5] | 1.7e-2 [-2.7e-3] | 2.1e-3 [9.3e-4] | 4.5e-3 [2.8e-3] | 4.6e-1 [9.3e-1] | 4.5e-3 [2.8e-3] | 1.4e-2 [2.8e-4] | 6.1e-3 [8.1e-4] | 1.7e-1 [2.0e-3] |
| K4 4x oversampled skewer, point | 4.3e-3 [2.6e-3] | 1.1e-3 [1.7e-5] | 8.9e-2 [-6.2e-2] | 2.1e-2 [-1.2e-2] | 4.3e-3 [2.6e-3] | 5.3e-1 [-1.0e+0] | 4.3e-3 [2.6e-3] | 1.4e-2 [1.3e-4] | 4.9e-3 [6.9e-4] | 1.9e-1 [-9.0e-3] |
| K5 4x oversampled skewer, JS bin nsub=8 | 4.5e-3 [2.8e-3] | 1.1e-3 [1.8e-5] | 8.9e-2 [-6.2e-2] | 2.1e-2 [-1.2e-2] | 4.5e-3 [2.8e-3] | 6.9e-2 [-1.7e-2] | 4.5e-3 [2.8e-3] | 1.4e-2 [2.1e-4] | 5.3e-3 [7.8e-4] | 1.9e-1 [-9.0e-3] |
| K6 4x oversampled skewer, exact pixel average | 4.5e-3 [2.8e-3] | 1.1e-3 [1.8e-5] | 8.9e-2 [-6.2e-2] | 2.1e-2 [-1.2e-2] | 4.5e-3 [2.8e-3] | 6.4e-2 [-1.5e-2] | 4.5e-3 [2.8e-3] | 1.4e-2 [2.2e-4] | 5.3e-3 [7.8e-4] | 1.9e-1 [-9.0e-3] |
| K7 4x oversampled skewer + sigv, JS bin nsub=8 | 4.5e-3 [2.8e-3] | 1.1e-3 [1.8e-5] | 1.7e-2 [-2.7e-3] | 2.1e-3 [9.3e-4] | 4.5e-3 [2.8e-3] | 6.9e-2 [-1.7e-2] | 4.5e-3 [2.8e-3] | 1.4e-2 [2.1e-4] | 6.1e-3 [8.1e-4] | 1.5e-1 [2.0e-3] |
| K8 adaptive oversampling (H dx <= b_min/2), exact pixel average | 4.5e-3 [2.8e-3] | 1.1e-3 [1.8e-5] | 8.9e-2 [-6.2e-2] | 2.1e-2 [-1.2e-2] | 4.5e-3 [2.8e-3] | 1.9e-2 [-1.5e-3] | 4.5e-3 [2.8e-3] | 1.4e-2 [2.2e-4] | 5.3e-3 [7.8e-4] | 1.9e-1 [-9.0e-3] |
| floor: K8 with FS constants + wofz + no cut | 1.9e-4 [1.2e-4] | 1.1e-3 [5.0e-6] | 9.0e-2 [-6.3e-2] | 2.3e-2 [-1.3e-2] | 1.9e-4 [1.2e-4] | 1.9e-2 [-1.5e-3] | 1.9e-4 [1.2e-4] | 1.5e-2 [3.2e-5] | 3.7e-3 [1.2e-4] | 1.9e-1 [-9.3e-3] |

## forest_C9: mean flux and P1D band ratios (8 sightlines)

| tau set | ⟨F⟩ | P1D/P1D_FS−1, k∈(0.001,0.01] | (0.01,0.02] | (0.02,0.05] | (0.05,0.1] s/km | same, both rescaled to ⟨F⟩=0.68: (0.001,0.01] | (0.01,0.02] | (0.02,0.05] | (0.05,0.1] |
|---|---|---|---|---|---|---|---|---|---|
| tau_fs | 0.67997 | | | | | | | | |
| tau_port | 0.67979 | +0.0017 | +0.0016 | +0.0003 | -0.0032 | +0.0007 | +0.0008 | -0.0005 | -0.0037 |
| tau_ref | 0.67993 | +0.0002 | +0.0001 | +0.0001 | -0.0003 | +0.0000 | -0.0000 | -0.0001 | -0.0004 |
| K1 | 0.67979 | +0.0017 | +0.0016 | +0.0003 | -0.0032 | +0.0007 | +0.0008 | -0.0005 | -0.0037 |
| K2 | 0.67977 | +0.0019 | +0.0018 | +0.0004 | -0.0035 | +0.0007 | +0.0009 | -0.0005 | -0.0041 |
| K3 | 0.67976 | +0.0021 | +0.0022 | +0.0008 | -0.0028 | +0.0009 | +0.0012 | -0.0000 | -0.0034 |
| K4 | 0.67979 | +0.0017 | +0.0016 | +0.0003 | -0.0031 | +0.0007 | +0.0008 | -0.0004 | -0.0036 |
| K5 | 0.67977 | +0.0019 | +0.0018 | +0.0004 | -0.0034 | +0.0007 | +0.0009 | -0.0005 | -0.0040 |
| K6 | 0.67977 | +0.0019 | +0.0018 | +0.0004 | -0.0034 | +0.0007 | +0.0009 | -0.0005 | -0.0040 |
| K7 | 0.67976 | +0.0021 | +0.0022 | +0.0009 | -0.0028 | +0.0009 | +0.0012 | -0.0000 | -0.0034 |
| K8 | 0.67977 | +0.0019 | +0.0018 | +0.0004 | -0.0034 | +0.0007 | +0.0009 | -0.0005 | -0.0040 |

## forest_C10: mean flux and P1D band ratios (4 sightlines)

| tau set | ⟨F⟩ | P1D/P1D_FS−1, k∈(0.001,0.01] | (0.01,0.02] | (0.02,0.05] | (0.05,0.1] s/km | same, both rescaled to ⟨F⟩=0.68: (0.001,0.01] | (0.01,0.02] | (0.02,0.05] | (0.05,0.1] |
|---|---|---|---|---|---|---|---|---|---|
| tau_fs | 0.67999 | | | | | | | | |
| tau_port | 0.68184 | -0.0259 | +0.0107 | +0.0463 | -0.0065 | -0.0142 | +0.0221 | +0.0589 | +0.0055 |
| tau_ref | 0.67997 | +0.0001 | +0.0000 | -0.0000 | -0.0004 | -0.0000 | -0.0001 | -0.0002 | -0.0005 |
| K1 | 0.68184 | -0.0259 | +0.0107 | +0.0463 | -0.0065 | -0.0142 | +0.0221 | +0.0589 | +0.0055 |
| K2 | 0.68183 | -0.0258 | +0.0108 | +0.0463 | -0.0069 | -0.0142 | +0.0221 | +0.0588 | +0.0051 |
| K3 | 0.67918 | +0.0077 | +0.0060 | +0.0057 | -0.0816 | +0.0023 | +0.0010 | +0.0005 | -0.0865 |
| K4 | 0.68166 | -0.0243 | +0.0106 | +0.0414 | -0.0106 | -0.0137 | +0.0208 | +0.0527 | +0.0002 |
| K5 | 0.68165 | -0.0242 | +0.0106 | +0.0414 | -0.0109 | -0.0137 | +0.0208 | +0.0526 | -0.0002 |
| K6 | 0.68165 | -0.0242 | +0.0106 | +0.0414 | -0.0109 | -0.0137 | +0.0208 | +0.0526 | -0.0002 |
| K7 | 0.67928 | +0.0063 | +0.0057 | +0.0035 | -0.0725 | +0.0016 | +0.0014 | -0.0011 | -0.0768 |
| K8 | 0.68165 | -0.0242 | +0.0106 | +0.0414 | -0.0109 | -0.0137 | +0.0208 | +0.0526 | -0.0002 |

## Coarse pixels: pixel-averaged τ (fake_spectra) vs pixel-averaged flux (what a detector records)

| case | FS exp(−⟨τ⟩) vs ⟨e^{−τ}⟩: max\|ΔF\| | ΔEW/EW | port vs ⟨e^{−τ}⟩: max\|ΔF\| | ΔEW/EW |
|---|---|---|---|---|
| C6a | 3.1e-1 | 1.4e+0 | 7.7e-1 | 3.6e+0 |
| C6b | 1.0e-1 | 2.6e-1 | 3.1e-1 | 5.2e-1 |
| C6c | 7.4e-3 | 1.3e-2 | 5.6e-2 | 2.2e-2 |
| C6d | 2.9e-1 | 1.5e+0 | 7.5e-1 | 3.7e+0 |
