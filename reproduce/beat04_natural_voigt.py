"""Beat 4 · the natural (Lorentzian) width, the damping parameter, and the Voigt function H(a, x) — an independent
reproduction in Python with SciPy's Faddeeva function.

Computed in the app by lya_app (science/js/lyaphys.js: C.gamma_kms, aDamp, voigtH — Humlicek's W4 approximation).
Science notes: science/#comp-voigt
Run:   python3 reproduce/beat04_natural_voigt.py
"""
# --- snippet ---
import numpy as np
from scipy.special import wofz

k_B, m_H = 1.380649e-16, 1.6735328e-24      # erg/K; g (the 1H atom)
A21 = 6.2649e8                              # 2p -> 1s decay rate, 1/s (Wiese & Fuhr 2009)
lambda0 = 1215.6701e-8                      # Lya, cm (vacuum)

gamma = A21 * lambda0 / (4 * np.pi) / 1e5   # Lorentzian half width in velocity, km/s
b = np.sqrt(2 * k_B * 1.0e4 / m_H) / 1e5    # thermal Doppler parameter at 1e4 K, km/s
a = gamma / b                               # Voigt damping parameter

def H(a, x):
    """Voigt-Hjerting function: H(a, x) = Re w(x + i a); the line profile is H(a, du/b) / (sqrt(pi) b)"""
    return wofz(x + 1j * a).real

print(f"natural half width gamma = {gamma:.4e} km/s")
print(f"damping parameter a at 1e4 K = {a:.4e}")
print(f"thermal FWHM / natural FWHM at 1e4 K = {np.sqrt(np.log(2)) * b / gamma:.0f}")
for x in (0, 1, 2, 4, 10, 100):
    print(f"H(a, {x:3d}) = {H(a, x):.3e}")
# --- end snippet ---

def expected(app):
    v, i = app['values']['natural_voigt'], app['inputs']['natural_voigt']
    return [f"natural half width gamma = {v['gamma_kms']:.4e} km/s", f"damping parameter a at 1e4 K = {v['a']:.4e}",
            f"thermal FWHM / natural FWHM at 1e4 K = {v['fwhm_thermal_over_natural']:.0f}"] + [f"H(a, {x:3d}) = {h:.3e}" for x, h in zip(i['x'], v['H'])]

def compare(app):
    v, i = app['values']['natural_voigt'], app['inputs']['natural_voigt']
    # the app's H is Humlicek's W4 (accurate to < 1e-4 relative, VAL-VOIGT-001); here the exact Faddeeva function
    return [('gamma', float(gamma), v['gamma_kms'], 1e-12), ('a', float(a), v['a'], 1e-12), ('FWHM ratio', float(np.sqrt(np.log(2)) * b / gamma), v['fwhm_thermal_over_natural'], 1e-12)] + \
           [(f"H(a, {x})", float(H(a, x)), h, 1e-4) for x, h in zip(i['x'], v['H'])]
