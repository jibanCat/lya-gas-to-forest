"""Beat 1 · how few hydrogen atoms are neutral: x_HI = α_A(T) n_e / Γ_HI at the mean density — an independent
reproduction in Python.

Computed in the app by lya_app (science/js/lyaphys.js, neutralFraction; the mean density is the toy's, computed by
science/data/toy/zeldovich3d.py). Science notes: science/#comp-neutral-fraction
Run:   python3 reproduce/beat01_neutral_fraction.py
"""
# --- snippet ---
import numpy as np

# Planck 2018 (TT,TE,EE+lowE+lensing): baryon density and helium mass fraction; the redshift of the toy
Obh2, Yp, z = 0.02237, 0.2454, 3.0
G = 6.67430e-8                     # cm^3 g^-1 s^-2 (CODATA 2022)
m_H = 1.6735328e-24                # g, the 1H atom
Mpc = 3.0856775814913673e24        # cm
H100 = 100e5 / Mpc                 # 100 km/s/Mpc in 1/s

rho_crit_h2 = 3 * H100**2 / (8 * np.pi * G)            # critical density today per h^2, g/cm^3
nH_bar = Obh2 * rho_crit_h2 * (1 - Yp) / m_H * (1 + z)**3   # mean hydrogen density at z, cm^-3 (proper)
ne_over_nH = 1 + 2 * Yp / (4 * (1 - Yp))                # electrons per H nucleus, H and He fully ionised

def x_HI(T, Gamma12, Delta=1.0):
    """neutral fraction in photoionisation equilibrium (case A): alpha_A(T) n_e / Gamma_HI"""
    alpha_A = 4.2e-13 * (T / 1e4) ** -0.7               # cm^3/s
    return alpha_A * ne_over_nH * nH_bar * Delta / (Gamma12 * 1e-12)

print(f"mean hydrogen density at z = 3: {nH_bar:.4e} cm^-3")
for T in (1.0e4, 1.3e4):
    print(f"x_HI at mean density, T = {T:.1e} K, Gamma_HI = 0.8e-12 /s: {x_HI(T, 0.8):.3e}")
# --- end snippet ---

def expected(app):
    v, i = app['values']['neutral_fraction'], app['inputs']['neutral_fraction']
    return [f"mean hydrogen density at z = 3: {v['nH_bar_cm3']:.4e} cm^-3"] + [f"x_HI at mean density, T = {T:.1e} K, Gamma_HI = 0.8e-12 /s: {x:.3e}" for T, x in zip(i['T_K'], v['x_HI'])]

def compare(app):
    v, i = app['values']['neutral_fraction'], app['inputs']['neutral_fraction']
    assert (Obh2, Yp, z) == (i['Obh2'], i['Yp'], i['z']) and i['gamma12'] == 0.8
    return [('mean hydrogen density', float(nH_bar), v['nH_bar_cm3'], 1e-6), ('n_e / n_H', ne_over_nH, v['ne_over_nH'], 1e-12)] + \
           [(f"x_HI({T:g} K)", float(x_HI(T, 0.8)), x, 1e-6) for T, x in zip(i['T_K'], v['x_HI'])]
