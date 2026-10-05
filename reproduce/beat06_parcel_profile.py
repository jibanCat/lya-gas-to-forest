"""Beat 6 · one parcel's line: thermal width, the width from its size (the Hubble flow across it), and its peak
optical depth — an independent reproduction in Python. In this scene the parcel's own peculiar-velocity gradient is
switched off (dv/dx = 0); the last line shows the same parcel with its own gradient.

Computed in the app by lya_app (science/js/lyaphys.js: parcelWidths, tau0). Science notes: science/#comp-parcel-width
Run:   python3 reproduce/beat06_parcel_profile.py
"""
# --- snippet ---
import numpy as np

k_B, m_H = 1.380649e-16, 1.6735328e-24                  # erg/K; g (the 1H atom)
sigma_v = 2.6540e-2 * 0.4164 * 1215.6701e-8 / 1e5       # (pi e^2 / m_e c) f lambda0: cm^2 km/s
Om, OL, z = 0.3153, 0.6847, 3.0
aH_h = 100 * np.sqrt(Om * (1 + z)**3 + OL) / (1 + z)    # km/s per comoving Mpc/h

# the toy's parcel b, as Beat 6 starts it
T, sigma_x, N = 27744.0, 0.14721893675599934, 10**14.27  # K; comoving Mpc/h (1 sigma); cm^-2

def widths(dvdx):
    """thermal b, size b (Gaussian clump with a linear velocity field), and their quadrature sum, km/s"""
    b_th = np.sqrt(2 * k_B * T / m_H) / 1e5
    b_size = np.sqrt(2) * abs(aH_h + dvdx) * sigma_x
    return b_th, b_size, np.hypot(b_th, b_size)

b_th, b_size, b = widths(0.0)                           # this scene: the parcel's own gradient switched off
tau0 = N * sigma_v / (np.sqrt(np.pi) * b)                # peak optical depth of the Doppler profile
print(f"thermal b = {b_th:.2f} km/s, size b = {b_size:.2f} km/s, together b = {b:.2f} km/s")
print(f"peak optical depth tau0 = {tau0:.2f}")
_, b_size_own, b_own = widths(-70.41475616076316)       # the same parcel with its own (infalling) gradient
print(f"with its own gradient: size b = {b_size_own:.2f} km/s, b = {b_own:.2f} km/s")
# --- end snippet ---

def expected(app):
    v = app['values']['parcel_profile']
    return [f"thermal b = {v['b_thermal_kms']:.2f} km/s, size b = {v['b_size_kms']:.2f} km/s, together b = {v['b_kms']:.2f} km/s",
            f"peak optical depth tau0 = {v['tau0']:.2f}", f"with its own gradient: size b = {v['b_size_own_gradient_kms']:.2f} km/s, b = {v['b_own_gradient_kms']:.2f} km/s"]

def compare(app):
    v, i = app['values']['parcel_profile'], app['inputs']['parcel_profile']
    assert (T, sigma_x, -70.41475616076316) == (i['T_K'], i['sigma_x_mpch'], i['own_dvdx']) and abs(N / i['N_cm2'] - 1) < 1e-12
    return [('thermal b', float(b_th), v['b_thermal_kms'], 1e-12), ('size b', float(b_size), v['b_size_kms'], 1e-12), ('b', float(b), v['b_kms'], 1e-12),
            ('tau0', float(tau0), v['tau0'], 1e-12), ('size b, own gradient', float(b_size_own), v['b_size_own_gradient_kms'], 1e-12), ('b, own gradient', float(b_own), v['b_own_gradient_kms'], 1e-12)]
