"""Beat 13 · the constructed "same shadow": three gases, one H I line. (iii) is computed from (i) by the matching
condition b_tot(iii) = b_tot(i), with the same column — so its H I lines equal (i)'s at every S/N, while the blend
(ii) shows as the signal-to-noise grows. An independent reproduction in Python: the matching condition uses
b_tot² = 2kT/m_H + 2σ_u² (a Gaussian clump with a smooth, linear velocity field); the lines do not — each clump is
summed over sub-cells, each a thermal Voigt line at its own velocity, so that (iii) matches (i) is computed, not assumed.

Computed in the app by lya_app (configs: science/tools/same_shadow_configs.py; lines: science/js/lyaphys.js
parcelToCells + tauFromCells, sub-cells and Humlicek's W4). Science notes: science/#comp-same-shadow
Run:   python3 reproduce/beat13_degeneracy.py
"""
# --- snippet ---
import numpy as np
from scipy.special import wofz

k_B, m_H = 1.380649e-16, 1.6735328e-24
sigma_v = 2.6540e-2 * 0.4164 * 1215.6701e-8 / 1e5       # Lya: (pi e^2 / m_e c) f lambda0, cm^2 km/s
gamma = 6.2649e8 * 1215.6701e-8 / (4 * np.pi) / 1e5      # km/s
lyb = 0.079142 * 1025.72221 / (0.4164 * 1215.6701)       # Lyb optical depth relative to Lya: (f lambda) ratio
b_T = lambda T: np.sqrt(2 * k_B * T / m_H) / 1e5         # thermal Doppler parameter, km/s

# gases in velocity space: centre u, Hubble-flow width su (1 sigma), bulk velocity v, extra smooth velocity dv across 1 sigma
I = [dict(u=0.0, su=2.23, N=2.5e14, T=45000.0, v=0.0, dv=0.0)]                       # one hot, compact clump
II = [dict(u=-39.0, su=12.8, N=9.75e13, T=1e4, v=24.9, dv=0.0),                      # two cold clumps, converging
      dict(u=39.0, su=12.8, N=9.75e13, T=1e4, v=-24.9, dv=0.0)]
dv = np.sqrt(2.23**2 + (b_T(45000.0)**2 - b_T(1e4)**2) / 2) - 11.15                 # matching: b_T^2 + 2 sigma_u^2 equal
III = [dict(u=0.0, su=11.15, N=2.5e14, T=1e4, v=0.0, dv=dv)]                         # one cold clump, expanding

u = np.linspace(-150, 150, 121)                                                      # 2.5 km/s pixels
s = np.linspace(-5, 5, 401); w = np.exp(-s**2 / 2); w /= w.sum()                    # a clump in sub-cells over +-5 sigma
def tau(gas, scale=1.0):                       # no closed form here: every sub-cell is a thermal line at its own velocity
    t = np.zeros_like(u)
    for c in gas:
        b = b_T(c['T']); x = (u[:, None] - c['u'] - c['v'] - (c['su'] + c['dv']) * s) / b
        t += scale * c['N'] * sigma_v * (w * wofz(x + 1j * gamma / b).real).sum(1) / (np.sqrt(np.pi) * b)
    return t

sig3 = lambda x: f"{float(f'{x:.3g}'):g}"
print(f"(iii)'s smooth extra velocity from the matching condition: dv = {dv:.4f} km/s")
for line, scale in (("Lya", 1.0), ("Lyb", lyb)):
    F = {k: np.exp(-tau(g, scale)) for k, g in (("i", I), ("ii", II), ("iii", III))}
    for snr in (20, 50, 100, 200):
        chi2 = {k: np.sum((F[k] - F["i"]) ** 2) * snr**2 for k in ("ii", "iii")}          # noise-free, against (i)
        print(f"{line} S/N {snr:3d}: dchi2(ii) = {sig3(chi2['ii']):>6}   dchi2(iii) = {chi2['iii']:.2f}")
# --- end snippet ---

def expected(app):
    v, i = app['values']['same_shadow'], app['inputs']['same_shadow']
    out = [f"(iii)'s smooth extra velocity from the matching condition: dv = {v['dv_iii_kms']:.4f} km/s"]
    for line, key in (("Lya", 'dchi2_lya'), ("Lyb", 'dchi2_lyb')):
        out += [f"{line} S/N {s:3d}: dchi2(ii) = {sig3(v[key]['ii'][j]):>6}   dchi2(iii) = {v[key]['iii'][j]:.2f}" for j, s in enumerate(i['snr'])]
    return out

def compare(app):
    v, i = app['values']['same_shadow'], app['inputs']['same_shadow']
    assert i['configs']['i'] == I and i['configs']['ii'] == II and abs(i['configs']['iii'][0]['dv'] - dv) < 1e-12
    out = [('dv(iii)', float(dv), v['dv_iii_kms'], 1e-12)]
    for line, scale, key in (("Lya", 1.0, 'dchi2_lya'), ("Lyb", lyb, 'dchi2_lyb')):
        F = {k: np.exp(-tau(g, scale)) for k, g in (("i", I), ("ii", II), ("iii", III))}
        for j, snr in enumerate(i['snr']):
            c3 = float(np.sum((F['iii'] - F['i'])**2) * snr**2)
            out.append((f"{line} dchi2(ii) S/N {snr}", float(np.sum((F['ii'] - F['i'])**2) * snr**2), v[key]['ii'][j], 1e-3))   # the app's sub-cells and W4: within 1e-3
            out.append((f"{line} dchi2(iii) S/N {snr} (absolute, both < 1e-2)", c3, v[key]['iii'][j], 'abs<1e-2'))
            out.append((f"{line} dchi2(iii) S/N {snr}: Python's exact-Voigt sub-cell sum < 1e-4", c3, v[key]['iii'][j], 'py<1e-4'))
    return out
