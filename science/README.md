# science/ — provenance and validation

Every scientific claim the resource teaches is traceable to a source, an explicit assumption or simplification, and,
where it is numerical, a reproducible check. This folder is that record.

## Single sources of truth (edit these)

| file | holds |
|---|---|
| `SCIENCE_LEDGER.yaml` | one entry per claim: its public anchor, claim, equations, convention, assumptions, validity, deliberate simplifications, sources (reference id + exact location + verified flag), oracle, browser implementation, validations, status; plus the oracle and validation registries |
| `REFERENCES.yaml` | the bibliography and the verification log for every reference and constant (`notes/` holds the narrative of the reference audits) |
| `PUBLIC_SCIENCE.yaml` | the framing text of the public science notes (what is modeled, what is not, toy vs oracles vs data); it cites ledger entries and types no accuracy numbers |
| `../design/canonical/BEATS.yaml` | the scenes; each is also a **scene manifest** listing the claims, validations and interactions it relies on |
| `validation/*/report.json` | measured results, written by the tests — never typed by hand |

## Generated (do not edit)

`python3 science/tools/build_provenance.py` regenerates:
- `SCIENCE_PROVENANCE.md` (per claim, with the scenes that use it);
- `validation/VALIDATION_SUMMARY.md`;
- `../design/canonical/CANONICAL_PATH.md`, `VISUAL_PROVENANCE.md`, `INTERACTION_PROVENANCE.md` and `beats.json`;
- `../design/canonical/public_provenance.json`, from which the app builds each scene's **sources & assumptions** sheet
  and the public **science notes** (`app/dist/science/index.html`).

Numbers in prose that come from a validation report are written as `{{VAL-ID:dotted.path:format}}` and filled in by the
build, so prose cannot drift from the measured value. The build exits 1 when:
- an id is broken or a validation fails;
- a claim a scene relies on lacks public fields (claim, sources or a stated check, assumptions or validity);
- a cited reference cannot be resolved (no verified DOI, ADS, arXiv or URL; books excepted);
- a typed accuracy number in public text is neither read from a report nor asserted;
- internal wording reaches public text.

## Numerical checks

| | oracle | test | report |
|---|---|---|---|
| Voigt H(a,x) | `oracle/voigt_oracle.py` (SciPy `wofz`) | `tests/test_voigt.js` | `validation/voigt/` |
| x → u mapping | `oracle/mapping_oracle.py` (comoving-distance integration) | `tests/test_mapping.js` | `validation/mapping/` |
| τ of lines | `oracle/tau_oracle.py` (exact Voigt, pixel averages) | `tests/test_tau.js` | `validation/tau/` |
| toy sightline | — | `tests/test_toy.js` | `validation/toy/` |
| toy spectrum vs its producer | the producer's own exact-Voigt τ in `data/toy/skewer.json` (`data/toy/zeldovich3d.py`) | `tests/test_toy_reference.js` | `validation/toy_reference/` |
| "same shadow" Δχ² | `oracle/degeneracy_oracle.py` (configurations: `validation/degeneracy/configs.json`) | `tests/test_degeneracy.js` | `validation/degeneracy/` |
| redshift and frames | `oracle/redshift_oracle.py` (SciPy quad + brentq) | `tests/test_redshift.js` | `validation/redshift/` |
| tracing a colour back to the gas | the spectrum's own τ | `tests/test_inverse.js` | `validation/inverse/` |
| one parcel, four separate variables | analytic expectations | `tests/test_orthogonality.js` | `validation/orthogonality/` |
| the drawing performs Beer–Lambert | e^(−τ) from the physics | `app/smoke.mjs` (reads the canvas back) | `validation/render/` |
| browser vs fake_spectra 2.2.4 | `oracle/fakespectra_*.py` | `validation/closure/` | `validation/closure/RESULTS.md`, `metrics.json` |

Run the tests and regenerate the provenance:

```
for t in science/tests/test_*.js; do node "$t"; done
python3 science/tools/build_provenance.py
```

The oracles need NumPy and SciPy (and fake_spectra for the closure study). Their outputs are committed, so the tests run
on Node alone. To recompute an oracle, run it before its test, for example
`python3 science/oracle/voigt_oracle.py && node science/tests/test_voigt.js`.

## The browser physics

`js/lyaphys.js` holds the browser physics: constants, the real-to-velocity mapping, the Doppler parameter, the Voigt
function, optical-depth accumulation, teaching parcels and observation. The app embeds it unchanged, and the tests
exercise it. Every function names the ledger ids it implements.

## Conventions

- x is comoving Mpc/h along the sightline, with the observer at small x and the quasar toward +x.
- u = aH(z) x_com + v_pec [km/s]; v_pec > 0 means moving away from the observer, so redder.
- Densities are proper cm⁻³; columns are cm⁻².
- λ_obs = λ0 (1 + z0) e^(u/c).

## Data

No data from any survey or simulation suite is used or copied here. The app runs on a declared synthetic toy
(`data/toy/`, SCI-SIM-TOY-001); every data file is recorded in `../docs/DATA.md`. The skewer interface (SCI-SIM-001) is
independent of the data set, so a later release could use simulation skewers once their redistribution is cleared.
