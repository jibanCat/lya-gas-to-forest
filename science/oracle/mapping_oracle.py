"""Oracle for SCI-MAP-001/002/004: the real-space → velocity-space map.

Independent route: integrate the comoving distance χ(z) = ∫ c dz / H(z) numerically (flat ΛCDM, no radiation),
place gas at χ0 + Δχ, find its cosmological redshift z(Δχ) by root-finding, and express the offset as a velocity
in the two standard ways: u_lin = c Δz/(1+z0) and u_log = c ln[(1+z)/(1+z0)]. Compare to the linear map
u = a H(z0) Δχ used by lyaphys.js (and by fake_spectra, see FAKE_SPECTRA_CONVENTIONS.md).
"""
import json, os
import numpy as np
from scipy.integrate import quad
from scipy.optimize import brentq

C_KMS = 299792.458
cases = []
for (Om, OL, h) in [(0.3, 0.7, 0.7), (0.3153, 0.6847, 0.6736)]:          # toy; Planck-2018-like (values to verify in ledger)
    H = lambda z: 100 * h * np.sqrt(Om * (1 + z) ** 3 + OL)
    chi = lambda z: quad(lambda zz: C_KMS / H(zz), 0, z, epsabs=1e-10, epsrel=1e-12)[0]      # comoving Mpc
    for z0 in [2.0, 3.0, 4.0]:
        chi0 = chi(z0)
        a = 1 / (1 + z0)
        for dx_mpch in [0.5, 2.0, 5.0, 10.0, 20.0, 40.0, 100.0]:
            dchi = dx_mpch / h
            zz = brentq(lambda z: chi(z) - (chi0 + dchi), z0, z0 + 1.0, xtol=1e-14)
            u_lin_exact = C_KMS * (zz - z0) / (1 + z0)
            u_log_exact = C_KMS * np.log((1 + zz) / (1 + z0))
            u_map = a * H(z0) * dchi
            cases.append(dict(Om=Om, OL=OL, h=h, z0=z0, dx_mpch=dx_mpch, u_map=u_map,
                              u_lin_exact=u_lin_exact, u_log_exact=u_log_exact,
                              hubble_per_mpch=100 * np.sqrt(Om * (1 + z0) ** 3 + OL) / (1 + z0)))
os.makedirs("validation/mapping", exist_ok=True)
json.dump(dict(oracle="numerical comoving-distance integration (scipy.integrate.quad + brentq)", cases=cases),
          open("validation/mapping/oracle.json", "w"), indent=1)
print(len(cases), "cases written")
