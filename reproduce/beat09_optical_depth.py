"""Beat 9 · optical depths add: τ(u) = Σ_j N_j σ_v φ(u − u_j; b_j) for three overlapping contributions, and the
transmitted light is the product of their transmissions — an independent reproduction in Python with exact Voigt
profiles (SciPy's Faddeeva function).

Computed in the app by lya_app (science/js/lyaphys.js: tauFromCells with Humlicek's W4). Science notes:
science/#comp-optical-depth
Run:   python3 reproduce/beat09_optical_depth.py
"""
# --- snippet ---
import numpy as np
from scipy.special import wofz

sigma_v = 2.6540e-2 * 0.4164 * 1215.6701e-8 / 1e5       # (pi e^2 / m_e c) f lambda0: cm^2 km/s
gamma = 6.2649e8 * 1215.6701e-8 / (4 * np.pi) / 1e5      # natural half width, km/s

def tau(u, u0, N, b):
    """one contribution: N sigma_v phi(u - u0), phi = H(a, x) / (sqrt(pi) b) with x = (u - u0)/b, a = gamma/b"""
    return N * sigma_v * wofz((u - u0) / b + 1j * gamma / b).real / (np.sqrt(np.pi) * b)

cells = [(-20.0, 5e13, 15.0), (0.0, 1e14, 20.0), (25.0, 3e13, 12.0)]   # (u0 km/s, N cm^-2, b km/s)
for u in (0.0, 20.0):
    each = [tau(u, *c) for c in cells]
    total = sum(each)
    print(f"u = {u:4.0f} km/s: tau = " + " + ".join(f"{t:.4f}" for t in each) + f" = {total:.4f};  F = exp(-tau) = {np.exp(-total):.5f} = product of exp(-tau_j) = {np.prod(np.exp(-np.array(each))):.5f}")
# --- end snippet ---

def expected(app):
    v, i = app['values']['optical_depth'], app['inputs']['optical_depth']
    return [f"u = {u:4.0f} km/s: tau = " + " + ".join(f"{t[k]:.4f}" for t in v['tau_each']) + f" = {v['tau_total'][k]:.4f};  F = exp(-tau) = {v['F_total'][k]:.5f} = product of exp(-tau_j) = {v['F_product'][k]:.5f}"
            for k, u in enumerate(i['u_kms'])]

def compare(app):
    v, i = app['values']['optical_depth'], app['inputs']['optical_depth']
    assert [(c['u'], c['N'], c['b']) for c in i['cells']] == cells
    out = []
    for k, u in enumerate(i['u_kms']):
        each = [tau(u, *c) for c in cells]
        out += [(f"tau_{j}({u:g})", float(t), v['tau_each'][j][k], 1e-4) for j, t in enumerate(each)] + [(f"tau({u:g})", float(sum(each)), v['tau_total'][k], 1e-4)]
    return out
