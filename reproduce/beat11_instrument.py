"""Beat 11 · the instrument acts on the transmitted light, not on the gas: a Gaussian line-spread function is applied
to F = e^(−τ) (then noise is added — not reproduced here). The line becomes shallower and wider; its equivalent width
is kept — an independent reproduction in Python.

Computed in the app by lya_app (science/js/lyaphys.js: tauFromCells, fluxFromTau, convolveLSF). Science notes:
science/#comp-instrument
Run:   python3 reproduce/beat11_instrument.py
"""
# --- snippet ---
import numpy as np
from scipy.special import wofz

sigma_v = 2.6540e-2 * 0.4164 * 1215.6701e-8 / 1e5       # cm^2 km/s
gamma = 6.2649e8 * 1215.6701e-8 / (4 * np.pi) / 1e5      # km/s
du = 2.5
u = np.arange(-300, 300 + du / 2, du)                    # km/s, 2.5 km/s pixels
N, b, fwhm = 2e14, 25.0, 70.0                            # cm^-2, km/s, the spectrograph's resolution (FWHM, km/s)

F = np.exp(-N * sigma_v * wofz(u / b + 1j * gamma / b).real / (np.sqrt(np.pi) * b))   # intrinsic transmission
s = fwhm / (2 * np.sqrt(2 * np.log(2)))                  # Gaussian LSF: sigma from FWHM
h = int(np.ceil(5 * s / du))
w = np.exp(-0.5 * (np.arange(-h, h + 1) * du / s) ** 2); w /= w.sum()
F_obs = np.convolve(np.pad(F, h, mode='edge'), w, mode='valid')   # applied to F, never to tau
EW = lambda f: np.sum(1 - f) * du
print(f"deepest point: intrinsic F = {F.min():.4f}, observed F = {F_obs.min():.4f}")
print(f"equivalent width: intrinsic {EW(F):.2f} km/s, observed {EW(F_obs):.2f} km/s")
# --- end snippet ---

def expected(app):
    v = app['values']['instrument']
    return [f"deepest point: intrinsic F = {v['F_min_intrinsic']:.4f}, observed F = {v['F_min_observed']:.4f}", f"equivalent width: intrinsic {v['EW_intrinsic_kms']:.2f} km/s, observed {v['EW_observed_kms']:.2f} km/s"]

def compare(app):
    v, i = app['values']['instrument'], app['inputs']['instrument']
    assert (du, N, b, fwhm) == (i['du_kms'], i['N_cm2'], i['b_kms'], i['fwhm_kms']) and len(u) == 241
    return [('F_min intrinsic', float(F.min()), v['F_min_intrinsic'], 1e-4), ('F_min observed', float(F_obs.min()), v['F_min_observed'], 1e-4),
            ('EW intrinsic', float(EW(F)), v['EW_intrinsic_kms'], 1e-4), ('EW observed', float(EW(F_obs)), v['EW_observed_kms'], 1e-4)]
