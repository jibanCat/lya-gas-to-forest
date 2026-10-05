"""Beat 3 · the thermal Doppler width b = √(2kT/m_H) — an independent reproduction in Python.

Computed in the app by lya_app (science/js/lyaphys.js, dopplerB). Science notes: science/#comp-thermal-width
Run:   python3 reproduce/beat03_thermal_width.py
Check: python3 reproduce/check.py   (compares with the app's own values, science/validation/computations/app_values.json)
"""
# --- snippet ---
import numpy as np

k_B = 1.380649e-16      # Boltzmann constant, erg/K (exact, SI 2019)
m_H = 1.6735328e-24     # mass of the 1H atom, g (1.00782503223 u, NIST)

def b_thermal(T):
    """Doppler parameter of the thermal (Gaussian) profile, km/s: b = sqrt(2 k_B T / m_H)"""
    return np.sqrt(2 * k_B * T / m_H) / 1e5

for T in (4.0e3, 1.0e4, 4.2e4):
    print(f"T = {T:7.0f} K  ->  b = {b_thermal(T):.3f} km/s")
# --- end snippet ---

def expected(app):
    v, i = app['values']['thermal_width'], app['inputs']['thermal_width']
    return [f"T = {T:7.0f} K  ->  b = {b:.3f} km/s" for T, b in zip(i['T_K'], v['b_kms'])]

def compare(app):
    v, i = app['values']['thermal_width'], app['inputs']['thermal_width']
    return [(f"b({T:g} K)", float(b_thermal(T)), b, 1e-12) for T, b in zip(i['T_K'], v['b_kms'])]
