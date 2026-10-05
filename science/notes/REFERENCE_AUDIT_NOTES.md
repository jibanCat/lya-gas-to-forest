# Reference & constants audit — notes

Audit date: 2026-10-02. Machine-readable ledger: `REFERENCE_AUDIT.yaml` (35 references, 26 constant entries).

## How things were verified

- **Atomic data:** I used the live NIST ASD v5.12 output, both tab-separated and HTML with bibliography pop-ups. I also read the NIST-hosted reprint of Wiese & Fuhr (2009).
- **Constants:** I downloaded NIST CUU `allascii.txt` for the 2022 CODATA adjustment and the 2018 archive for comparison. ¹H masses come from the NIST isotopic-composition page.
- **Bibliographic data:** Crossref API (journal, volume, pages, DOI).
- **ADS bibcodes:** I only list a bibcode when a search restricted to `ui.adsabs.harvard.edu` returned that record. The ADS UI blocks automated access.
- **Equation and section locations:** I read these in arXiv full text and recorded the arXiv version. Exceptions:
  - Gunn & Peterson: ADS scanned pages.
  - Rybicki & Lightman ch. 1: course-hosted scan.
  - Draine 2011: publisher table of contents plus the official errata.
- **Books:** Rybicki & Lightman ch. 10, Draine and Osterbrock & Ferland are verified to section and page only. No equation numbers are claimed except R&L ch. 1 and the Draine equations quoted in the errata.
- **Unverified items:** marked `location_verified: false` and/or `status: unverified`. Nothing was filled in from memory.

## Differences from the values you assumed

| quantity | assumed | verified | verdict |
|---|---|---|---|
| λ(Lyα) | 1215.6701 Å | NIST unresolved 1s–2 line 1215.6701 Å; 2p gf-weighted centroid 1215.67004 Å; components 1215.668237 / 1215.673645 Å | OK. The comment "fine-structure weighted" is slightly wrong: 1215.6701 is the NIST multiplet value, whose upper level includes 2s. The difference is 0.015 km/s. |
| f | 0.4164 | 0.41641 (NIST; W&F 2009 Table 6) | OK |
| A₂ₚ = Γ | 6.2649e8 s⁻¹ | W&F 2009: 6.2649e8. NIST v5.12 after CODATA-2018 rescaling: 6.2648e8 (2p₁/₂) and 6.2647e8 (2p₃/₂) | OK, but cite W&F 2009 Table 6. **Do not use** NIST's combined-line A = 4.6986e8: it is g-averaged over all 8 n=2 substates. |
| m_H | 1.6735575e-24 g | 1.00782503 u × m_u = **1.6735328e-24 g** | **Wrong by 1.5e-5.** The assumed number is about 1.00784 u (the lower bound of the IUPAC standard-atomic-weight interval), not the ¹H mass named in the code comment. Physically negligible, but the value and comment disagree. |
| πe²/(m_e c) | 0.026540 | 0.026540089 cm² s⁻¹ (CODATA 2022 and 2018) | OK |

Other checks: k_B, c and e are exact. 2p lifetime = 1.5962 ns. b(10⁴ K) = 12.845 km/s. a(10⁴ K) = 4.72e-4. τ₀ = 0.379 for N = 10¹³ cm⁻² and b = 20 km/s, which agrees with Meiksin Eq. (19) and Dijkstra Eq. (15).

## Claims that are wrong or need rewording

1. **The "fake_spectra spectra method" paper** is Bird et al. 2015 (MNRAS 447, 1834), §2.6, Eqs. (6)–(7). Bird et al. 2014 (MNRAS 445, 2313) covers DLA grid projection and points to `DLA_script`.
2. **fake_spectra 2.2.4 as an oracle:**
   - Thermal mass: it uses 1.00794 × m_p = 1.68590e-24 g. At the same T, its b is 0.37 % smaller than with m(¹H).
   - Line data come from VPFIT `atom.dat`: Γ = 6.265e8, f = 0.4164, λ = 1215.6701.
   - k_B = 1.3806504e-16 (the CODATA 2006 value).
   - Newer releases exist (2.3.1, 2026-09-17), so pin 2.2.4 explicitly.
   - The README asks for no citation; cite Bird et al. 2015 plus the repository URL and version.
3. **Tepper-García 2006:**
   - An erratum exists (MNRAS 382, 1375). It changes footnote 4 to Q = 1.5 x⁻².
   - The paper claims validity only for a ≲ 1e-4. Its own §5.2 says the error peaks near x ≈ 4 at roughly 1 %.
   - My check against `wofz` gives 1.5–2 % relative error near x ≈ 3.7–4.
   - Lyα forest lines have a ≈ 3–5e-4, so the method is outside its stated domain.
   - The current `lyaphys.js` already uses Humlíček W4 everywhere. My check: maximum relative error 5.4e-5 over a ∈ [1e-5, 5e-3], x ∈ [0, 30].
   - I did not compare the W4 coefficients against the original (paywalled) paper.
4. **"Γ_HI ~ 1e-12 s⁻¹ at z = 3":** Becker & Bolton 2013 Table 1 gives 0.86e-12 at z = 2.8 and 0.79e-12 at z = 3.2, with ±0.13 dex. Say "≈ 0.8 × 10⁻¹² s⁻¹".
5. **Mean flux at z = 3:** the Becker et al. 2013 Eq. (5) fit gives τ_eff = 0.40 (F = 0.669). Their Table 2 bins bracket F ≈ 0.68. Quote "F ≈ 0.67–0.68".
6. **T₀ at z ≈ 3:** Becker et al. 2011 Table 3 gives 1.1–1.2 × 10⁴ K for γ ≈ 1.55 and 1.4–1.6 × 10⁴ K for γ = 1.3. McQuinn 2016 §2.3 gives (10–20) × 10³ K. "1–2 × 10⁴ K" is fine, but state that it depends on γ.
7. **Recombination coefficient:** "α_A ≈ 4 × 10⁻¹³ (T/10⁴ K)^-0.7" is verbatim Hui & Gnedin 1997 Eq. (12). Values at 10⁴ K vary by source:

   | source | α_A(10⁴ K), cm³ s⁻¹ |
   |---|---|
   | Draine 2011 Eq. (14.3) | 4.13e-13 |
   | Draine Table 14.1, revised in errata | 4.17e-13 |
   | Hui & Gnedin 1997 App. A fit | 4.30e-13 |
   | Osterbrock & Ferland 2006 Table 2.1 | 4.18e-13 (unverified) |

   Local slope is −0.71 at 10⁴ K and −0.73 to −0.75 at 2 × 10⁴ K.
8. **Neutral fraction ~1e-5:**
   - Citable wording: McQuinn 2016 §2.1, "the Lyα forest is sensitive to x_HI ∼ 10⁻⁵ at z = 3".
   - My calculation gives x_HI ≈ (0.55–0.74) × 10⁻⁵ at mean density, z = 3, using these inputs:
     - Planck 2018: Ω_b h² = 0.02237, Y_P = 0.2454, so n_H = 1.213e-5 cm⁻³
     - helium fully ionised: n_e = 1.164 n_H
     - α_A = 4.13–4.30e-13 cm³ s⁻¹
     - Γ = 0.82–1.0e-12 s⁻¹
   - Caution: McQuinn's Eq. (1) prefactor of 1.3 is not reproduced. A direct τ_GP calculation with Planck 2018 gives 1.63 for x_HI = 1e-5. Do not mix the two.
9. **Lyman-limit systems:** σ₉₁₂ = 6.304e-18 cm² is the exact non-relativistic hydrogenic value (computed). The Verner et al. 1996 fit gives 6.35e-18. N(τ₉₁₂ = 1) = 1.59e17 cm⁻².
   - Wolfe et al. 2005 and Meiksin Table I use 10¹⁷ as the boundary. Wolfe et al. 2005 say 10¹⁷ is only "about unity" optical depth.
   - Suggested wording: "LLS: τ₉₁₂ ≥ 1, i.e. N ≳ 1.6 × 10¹⁷ cm⁻². Survey conventions vary (10¹⁷, 10^17.2)."
10. **Resonant scattering:** these are citable as statements, not just inference:
    - Meiksin 2009 footnote 7 and the opening of §II.A
    - Dijkstra 2014 §4 opening: "absorption followed by (practically) instant reemission … resembles pure scattering"
    - Gunn & Peterson 1965 p. 1633: photons "can be scattered by neutral hydrogen"

    Gunn & Peterson's equations are unnumbered, so cite the page. Note that GP infer n_HI ≈ 6 × 10⁻¹¹ cm⁻³; a web-search summary wrongly said 2e-12.
11. **Instrument resolution:** Palanque-Delabrouille et al. 2013 state it in Fourier space, §4 Eq. (6): W = exp(−k²R²/2) · sinc(kΔv/2). R is the Gaussian **rms** in km/s, not the resolving power. Saying "convolution with a Gaussian LSF of rms R, then pixelisation" is an exact restatement.
12. **Atomic data from reviews:** Meiksin 2009 (f = 0.4162, Γ = 6.262e8) and Draine's first printing (f = 0.4162) carry outdated values. Take atomic data only from NIST ASD or W&F 2009.
13. **H(a,x) = Re w(x+ia):** I verified this numerically against the integral definition. I found no explicit text source for the identity, apart from a comment in fake_spectra `singleabs.h`.
14. **Cosmology:** `lyaphys.js` COSMO_DEFAULT (0.3/0.7/0.7) is not Planck 2018. E(z=3) is 2.3 % lower and aH/h is 111.5 rather than 114.2 km/s per Mpc/h. Say "illustrative cosmology", or switch to Planck 2018 Table 2: Ω_m = 0.3153, h = 0.6736, Ω_b h² = 0.02237.

## Where the reviews cover each topic (arXiv versions read)

| topic | Rauch 1998 | Meiksin 2009 | McQuinn 2016 |
|---|---|---|---|
| redshift-space / peculiar velocities | §5.2 Eq. (17) (dv_pec/dr term) | §II.A text; §VI.C.1 Eq. (104) | §2.1 fn. 1 (FGPA ignores v_pec) |
| thermal broadening / b | §2.4 Eq. (5); §3.3 | §II.A Eqs. (10)–(11); §II.B (b distributions) | §2.1.3; §2.3 |
| photoionisation equilibrium | §5.2 Eq. (17) | §III.A.1 Eqs. (40)–(42); §II.B; §VI.B | §2.1 Eq. (2) |
| curve of growth | passing mentions only | §II.A Eqs. (20)–(26) | not covered |

The best explicit source for u = aHx + v_pec is Hui, Gnedin & Zhang 1997, Eq. (3). Bird et al. 2015 Eq. (6) is the same mapping with x proper. For line-formation physics, use Rybicki & Lightman (ch. 1 equations; §10.6 by section) and Draine ch. 6 and 9 by section.

## Not verified (need a library copy or a decision)

- Rybicki & Lightman §10.6 equation numbers.
- Draine equation numbers other than 14.3 and 14.4, including the σ_pi(H) equation in §13.1.
- All of Osterbrock & Ferland 2006.
- Humlíček 1982 W4 coefficients against the original paper.
- ADS bibcodes for: Becker & Bolton 2013, Becker et al. 2013, Bird et al. 2014, Faucher-Giguère et al. 2008, Verner et al. 1996, Jitrik & Bunge 2004, Kramida 2010, Sansonetti et al. 2004, and the books. Their DOIs are verified.
- IAU au/pc definitions behind Mpc_cm (the value was computed, not fetched).
