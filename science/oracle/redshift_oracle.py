"""Independent oracle for the redshift / frames beat (VAL-RED-001).

χ(z) = (c/H0) ∫0^z dz'/E(z') by scipy quad (flat ΛCDM, radiation neglected) for Planck 2018 and the old toy cosmology;
the inverse z(χ) by brentq; wavelength frame conversions computed directly from 1 + z = λ_obs/λ_rest.
Writes science/validation/redshift/oracle.json, read by science/tests/test_redshift.js.
"""
import json, os, sys
import numpy as np
from scipy.integrate import quad
from scipy.optimize import brentq
sys.dont_write_bytecode = True
C_KMS, LYA = 299792.458, 1215.6701
cases = []
for (Om, OL, h, tag) in [(0.3153, 0.6847, 0.6736, 'planck2018'), (0.3, 0.7, 0.7, 'toy-om0.3-h0.7')]:
    E = lambda z: np.sqrt(Om * (1 + z) ** 3 + OL)
    chi = lambda z: C_KMS / 100 * quad(lambda zz: 1 / E(zz), 0, z, epsabs=0, epsrel=1e-13, limit=200)[0]
    for z in [0.01, 0.1, 0.5, 1.0, 2.0, 2.5, 3.0, 3.4, 4.0, 5.0, 6.0]:
        c = chi(z)
        zback = brentq(lambda zz: chi(zz) - c, 0, 20, xtol=1e-14)
        cases.append(dict(cosmo=tag, Om=Om, OL=OL, h=h, z=z, chi_mpch=c, z_back=zback,
                          lambda_obs_lya=LYA * (1 + z), lambda_rest_back=LYA * (1 + z) / (1 + z)))
# quasar frame: forest absorption sits blueward of the quasar's own Lyα
qf = [dict(z_abs=za, z_q=zq, lambda_qframe=LYA * (1 + za) / (1 + zq)) for zq in [2.5, 3.4, 4.5] for za in [0.5 * zq, zq - 0.3, zq - 0.01]]
# log-λ: a stretch is a shift, and a small shift is a velocity (u = c ln((1+z_abs)/(1+z0)), SCI-MAP-004)
lg = [dict(z0=3.0, z_abs=za, u=C_KMS * np.log((1 + za) / 4.0)) for za in [2.98, 2.99, 3.0, 3.01, 3.02]]
# the forest written along the way (SCI-RED-005): an absorber at z_abs takes the part of the quasar's spectrum emitted at
# λ_e = λ_Lyα (1 + z_abs)/(1 + z_q); measured locally there it is exactly λ_Lyα; we receive it at λ_Lyα (1 + z_abs)
fw = [dict(z_q=zq, z_abs=za, lambda_emit=LYA * (1 + za) / (1 + zq), lambda_local_at_abs=(LYA * (1 + za) / (1 + zq)) * (1 + zq) / (1 + za),
           lambda_obs=(LYA * (1 + za) / (1 + zq)) * (1 + zq)) for zq in [3.2, 4.0] for za in [0.2, 1.0, 2.0, 3.0, zq - 0.05]]
os.makedirs(os.path.join(os.path.dirname(__file__), '..', 'validation', 'redshift'), exist_ok=True)
out = os.path.join(os.path.dirname(__file__), '..', 'validation', 'redshift', 'oracle.json')
json.dump(dict(generated='scipy %s' % __import__('scipy').__version__, chi=cases, quasar_frame=qf, log_shift=lg, forest=fw), open(out, 'w'), indent=1)
print('wrote', os.path.relpath(out), len(cases), 'distance cases')
