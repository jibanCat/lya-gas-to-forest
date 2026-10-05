"""Beat 10 · light multiplies: F = e^(−τ), and a strong line saturates — an independent reproduction in Python.

Computed in the app by lya_app (science/js/lyaphys.js: fluxFromTau, tau0). Science notes: science/#comp-transmission
Run:   python3 reproduce/beat10_transmission.py
"""
# --- snippet ---
import numpy as np

sigma_v = 2.6540e-2 * 0.4164 * 1215.6701e-8 / 1e5       # (pi e^2 / m_e c) f lambda0: cm^2 km/s

for t in (1.73, 11.9, 0.37):
    print(f"tau = {t:5.2f}  ->  F = exp(-tau) = {np.exp(-t):.3e}")
N, b = 1e15, 25.0                                        # cm^-2, km/s
tau0 = N * sigma_v / (np.sqrt(np.pi) * b)                # line-centre optical depth of a Doppler line
print(f"N = 1e15 cm^-2, b = 25 km/s: tau0 = {tau0:.2f}, F at line centre = {np.exp(-tau0):.1e} (saturated)")
# --- end snippet ---

def expected(app):
    v, i = app['values']['transmission'], app['inputs']['transmission']
    return [f"tau = {t:5.2f}  ->  F = exp(-tau) = {f:.3e}" for t, f in zip(i['tau'], v['F'])] + [f"N = 1e15 cm^-2, b = 25 km/s: tau0 = {v['tau0']:.2f}, F at line centre = {v['F_core']:.1e} (saturated)"]

def compare(app):
    v, i = app['values']['transmission'], app['inputs']['transmission']
    return [(f"F({t})", float(np.exp(-t)), f, 1e-12) for t, f in zip(i['tau'], v['F'])] + [('tau0', float(tau0), v['tau0'], 1e-12)]
