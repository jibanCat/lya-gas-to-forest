#!/usr/bin/env python3
"""The "same shadow" configurations of Beat 13 (SCI-DEG-001), constructed — not tuned by eye — and written to their single
source, science/validation/degeneracy/configs.json, which the app, the oracle and the test all read.

Each configuration is one or two smooth Gaussian clumps, defined in velocity space (so the lines do not depend on the
cosmology): centre u, Hubble-flow width su (1σ), bulk peculiar velocity v, extra peculiar velocity dv across +1σ (a smooth
linear flow), temperature T and neutral column N. Across a clump the line-of-sight velocity is Gaussian-distributed with
spread σ_u = su + dv, and each atom's line is thermally broadened, so the clump's H I profile is a Voigt profile whose
Doppler parameter is
    b_tot² = 2kT/m_H + 2 σ_u²        (thermal motion ⊗ the clump's bulk velocities; Gaussian ⊗ Gaussian)

(i)  one hot, compact clump at rest                         — chosen;
(ii) two cold clumps converging, each half-hidden in the other — chosen so the blend is hidden at S/N 20 and shows by
     S/N 50 (a measurement-limited degeneracy);
(iii) one cold clump with a smooth extra expansion          — COMPUTED from (i): the same column and centre, and the
     extra velocity dv that gives it the same total Doppler parameter,
        b_tot(iii) = b_tot(i)   ⇔   dv = √( su_i² + (b_T,i² − b_T,iii²)/2 ) − su_iii ,
     so that every H I Lyman-series line of (iii) equals that of (i) (an information-limited degeneracy: the H I lines
     record only the line-of-sight distribution of velocity and optical depth).

Usage: python3 science/tools/same_shadow_configs.py   (deterministic; rewrites configs.json)
"""
import json, math, os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'science', 'validation', 'degeneracy', 'configs.json')
kB, m_H = 1.380649e-16, 1.6735328e-24          # erg/K (exact); g, the ¹H atom (the app's constants, science/js/lyaphys.js)

def b_thermal(T):
    """thermal Doppler parameter [km/s]: b_T = √(2kT/m_H)"""
    return math.sqrt(2 * kB * T / m_H) / 1e5

def b_total(T, su, dv=0.0):
    """total Doppler parameter of a Gaussian clump [km/s]: b_tot² = b_T² + 2 (su + dv)²"""
    return math.sqrt(b_thermal(T) ** 2 + 2 * (su + dv) ** 2)

# the chosen configurations (velocity space, km/s; N in cm⁻²; T in K)
I = [dict(u=0.0, su=2.23, N=2.5e14, T=45000.0, v=0.0, dv=0.0)]
II = [dict(u=-39.0, su=12.8, N=9.75e13, T=10000.0, v=24.9, dv=0.0), dict(u=39.0, su=12.8, N=9.75e13, T=10000.0, v=-24.9, dv=0.0)]
III_CHOSEN = dict(u=0.0, su=11.15, N=2.5e14, T=10000.0, v=0.0)   # a cold clump at the same place, with (i)'s column

# (iii): solve the matching condition for its smooth extra velocity
i0 = I[0]
dv = math.sqrt(i0['su'] ** 2 + (b_thermal(i0['T']) ** 2 - b_thermal(III_CHOSEN['T']) ** 2) / 2) - III_CHOSEN['su']
III = [dict(III_CHOSEN, dv=dv)]
assert abs(b_total(III[0]['T'], III[0]['su'], dv) - b_total(i0['T'], i0['su'])) < 1e-12 * b_total(i0['T'], i0['su'])

out = {
    'note': "Single source for the 'same shadow' configurations (SCI-DEG-001; Beat 13), written by science/tools/same_shadow_configs.py. "
            "Defined in velocity space so the lines do not depend on the cosmology: u = Hubble-flow position [km/s], su = Hubble-flow "
            "width (1σ) [km/s], v = bulk peculiar velocity [km/s], dv = extra peculiar velocity across +1σ [km/s]. Real-space x = u/H, "
            "σx = su/H, dv/dx = dv/σx with H = aH/h per Mpc/h. Read by the app (Beat 13), science/oracle/degeneracy_oracle.py and "
            "science/tests/test_degeneracy.js.",
    'pixel_kms': 2.5, 'u_range_kms': [-150, 150], 'npix': 121,
    'configs': {'i': I, 'ii': II, 'iii': III},
    'construction': {
        'rule': 'b_tot(iii) = b_tot(i), same N and centre; b_tot² = 2kT/m_H + 2(su + dv)²; '
                'dv(iii) = √(su_i² + (b_T,i² − b_T,iii²)/2) − su_iii',
        'constants': {'kB_erg_per_K': kB, 'm_H_g': m_H},
        'b_thermal_kms': {'i': b_thermal(i0['T']), 'iii': b_thermal(III[0]['T'])},
        'b_tot_kms': {'i': b_total(i0['T'], i0['su']), 'iii': b_total(III[0]['T'], III[0]['su'], dv)},
        'sigma_u_kms': {'i': i0['su'], 'iii': III[0]['su'] + dv},
        'dv_iii_kms': dv,
    },
}
json.dump(out, open(OUT, 'w'), indent=1, ensure_ascii=False)
open(OUT, 'a').write('\n')
print(f"(iii) dv = {dv:.6f} km/s from b_tot(iii) = b_tot(i) = {out['construction']['b_tot_kms']['i']:.6f} km/s → {os.path.relpath(OUT, ROOT)}")
