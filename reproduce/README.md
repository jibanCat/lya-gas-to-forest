# Reproduce in Python

Short, independent reproductions of the calculations this resource implements. Each one rewrites the published
equation in Python, using NumPy and SciPy only. None of them calls the app.

The app's physics is JavaScript (`science/js/lyaphys.js`). These scripts are a second implementation, in a second
language, and they are checked against the app automatically.

## Setup

- Python 3.10 or later, with NumPy and SciPy.
- Tested with Python 3.10 (NumPy 2.2.6, SciPy 1.15.2) and, in continuous integration, with the same NumPy and SciPy
  versions on the runner's Python 3.

```bash
python3 -m pip install numpy scipy
```

## Run one

```bash
python3 reproduce/beat03_thermal_width.py
```

Each script prints a few lines.

- **The snippet.** The part of the file between `# --- snippet ---` and `# --- end snippet ---` is exactly the code shown
  on the site, under "show the physics" → "reproduce in Python" and in the science notes. Copy it into any Python, a
  notebook or Colab.
- **The rest of the file.** It holds the comparison with the app.

## Check them all against the app

```bash
node science/tests/test_computations.js   # the app's own values at the same inputs → science/validation/computations/app_values.json
python3 reproduce/check.py                # every snippet run alone, every script, every value compared
```

`check.py` requires three things:

- **The printed output.** Each snippet, run on its own, must print exactly the expected output, formatted from the
  app's own values.
- **The exit code.** Each script must exit 0.
- **The values.** Every full-precision value must agree with the app's within the tolerance the script states.

The two most common tolerances:

- 1e-12 for closed forms, where the app and Python compute the same expression;
- 1e-4 where the app uses an approximation (Humlíček's W4 Voigt function), and Python uses the exact Faddeeva function.

The release gate (`tools/validate.sh`) and continuous integration run this check. Its report is
`science/validation/reproduce/report.json`, published as the "Python reproductions" check in the science notes.

## What each script reproduces

| script | quantity on the site | computation (science notes) |
|---|---|---|
| `beat01_neutral_fraction.py` | the mean hydrogen density at z = 3; x_HI at mean density for the measured Γ_HI | `#comp-neutral-fraction` |
| `beat03_thermal_width.py` | the thermal Doppler width b = √(2kT/m_H) | `#comp-thermal-width` |
| `beat04_natural_voigt.py` | the natural width γ, the damping parameter a, the Voigt function H(a, x), the thermal-to-natural width ratio | `#comp-voigt` |
| `beat05_redshift_mapping.py` | λ_obs = λ₀(1 + z), the comoving distance to z = 3, aH/h, a 4.4 Mpc/h stretch in km/s and Å | `#comp-redshift-mapping` |
| `beat06_parcel_profile.py` | Beat 6's widths (thermal, size, together), its peak optical depth, and the same parcel with its own velocity gradient | `#comp-parcel-width` |
| `beat07_velocity_mapping.py` | where Beat 7's three parcels land, with expansion alone and with their own motion | `#comp-velocity-mapping` |
| `beat09_optical_depth.py` | optical depths of overlapping contributions add; the transmission is their product | `#comp-optical-depth` (also Beat 12's trace and the toy sightline) |
| `beat10_transmission.py` | F = e^(−τ) and a saturated line | `#comp-transmission` |
| `beat11_instrument.py` | the spectrograph's line-spread function acting on F: a shallower, wider line with the same equivalent width | `#comp-instrument` |
| `beat13_degeneracy.py` | the constructed "same shadow": (iii) from the matching condition; the lines summed over each clump's sub-cells (no closed form), so (iii)'s match is computed; Δχ² in Lyα and Lyβ at S/N 20–200 | `#comp-same-shadow` |

Not reproduced here:

- **Teaching visuals.** They compute nothing; the science notes describe them.
- **The noise draw of the instrument.** It depends on the app's random-number generator.

## The external reference package (advanced)

The comparison with **fake_spectra 2.2.4** (S. Bird, MIT) is in `science/oracle/fakespectra_*.py`, with its inputs and
results in `science/validation/closure/`. It needs fake_spectra installed and the mock snapshots those scripts write.

That comparison is an independent check of the app's sightline model. It is not part of the minimal reproductions
above, and the app never shows a fake_spectra spectrum.
