"""Beat 5 · stretching: λ_obs = λ0 (1 + z), the comoving distance χ(z), and how a stretch of gas maps to velocity and
to observed wavelength — an independent reproduction in Python.

Computed in the app by lya_app (science/js/lyaphys.js: lambdaObsOfRest, comovingDistance — Simpson's rule —,
hubblePerMpch, lambdaObs). Science notes: science/#comp-redshift-mapping
Run:   python3 reproduce/beat05_redshift_mapping.py
"""
# --- snippet ---
import numpy as np
from scipy.integrate import quad

c = 299792.458                   # km/s
lambda0 = 1215.6701              # Lya rest wavelength, Angstrom (vacuum)
Om, OL = 0.3153, 0.6847          # Planck 2018, flat; distances in Mpc/h do not depend on h
z = 3.0

E = lambda zz: np.sqrt(Om * (1 + zz)**3 + OL)
lambda_obs = lambda0 * (1 + z)                              # every wavelength is stretched by 1 + z
chi = c / 100 * quad(lambda zz: 1 / E(zz), 0, z)[0]          # comoving distance, Mpc/h
aH_h = 100 * E(z) / (1 + z)                                 # Hubble velocity per comoving Mpc/h at z, km/s
u = aH_h * 4.4                                              # across a 4.4 Mpc/h stretch of gas, km/s
dlambda = lambda_obs * (np.exp(u / c) - 1)                  # its width in observed wavelength (log-lambda convention)

print(f"Lya absorbed at z = 3 is observed at {lambda_obs:.2f} Angstrom")
print(f"comoving distance to z = 3: {chi:.1f} Mpc/h")
print(f"aH/h at z = 3: {aH_h:.2f} km/s per Mpc/h")
print(f"4.4 Mpc/h of Hubble flow: {u:.1f} km/s = {dlambda:.2f} Angstrom observed")
# --- end snippet ---

def expected(app):
    v = app['values']['redshift_mapping']
    return [f"Lya absorbed at z = 3 is observed at {v['lambda_obs_A']:.2f} Angstrom", f"comoving distance to z = 3: {v['chi_mpch']:.1f} Mpc/h",
            f"aH/h at z = 3: {v['aH_over_h']:.2f} km/s per Mpc/h", f"4.4 Mpc/h of Hubble flow: {v['u_kms']:.1f} km/s = {v['dlambda_A']:.2f} Angstrom observed"]

def compare(app):
    v, i = app['values']['redshift_mapping'], app['inputs']['redshift_mapping']
    assert (Om, OL, z) == (i['cosmo']['Om'], i['cosmo']['OL'], i['z'])
    return [('lambda_obs', float(lambda_obs), v['lambda_obs_A'], 1e-12), ('chi', float(chi), v['chi_mpch'], 1e-7), ('aH/h', float(aH_h), v['aH_over_h'], 1e-12),
            ('u(4.4 Mpc/h)', float(u), v['u_kms'], 1e-12), ('delta lambda', float(dlambda), v['dlambda_A'], 1e-9)]
