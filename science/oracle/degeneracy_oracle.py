"""Oracle for SCI-DEG-001: recompute the three 'same shadow' lines independently (exact Voigt via scipy.special.wofz,
4001 sub-cells per clump over ±5σ), in Lyα and in Lyβ, and their noise-free Δχ² against configuration (i) at
S/N = 20, 50, 100 and 200 per 2.5 km/s pixel. Lyβ is defined as the app defines it: the Lyα optical depth scaled by
(fλ)_Lyβ/(fλ)_Lyα (its natural damping, immaterial at these columns, is Lyα's)."""
import json, os
import numpy as np
from scipy.special import wofz
HUB = 100 * np.sqrt(0.3153 * 4 ** 3 + 0.6847) / 4    # Planck 2018, z = 3; the lines are cosmology-independent (configs in velocity space)
kB, mH = 1.380649e-16, 1.6735328e-24
sig_v = 2.6540e-2 * 0.4164 * 1215.6701e-8 / 1e5; gam = 6.2649e8 * 1215.6701e-8 / (4 * np.pi) / 1e5
R_LYB = 0.079142 * 1025.72221 / (0.4164 * 1215.6701)     # (fλ)_Lyβ / (fλ)_Lyα
SNRS = (20, 50, 100, 200)
_C = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "validation", "degeneracy", "configs.json")))
def to_real(p):    # velocity-space definition → real-space clump at this H
    sx = p["su"] / HUB
    return dict(x=p["u"] / HUB, sx=sx, N=p["N"], T=p["T"], v=p["v"], dvdx=p["dv"] / sx)
CONFIGS = {k: [to_real(p) for p in v] for k, v in _C["configs"].items()}
ug = np.linspace(-150, 150, 121)
def tau(cfg):
    t = np.zeros_like(ug)
    for p in cfg:
        s = np.linspace(-5, 5, 4001); w = np.exp(-0.5 * s * s); w /= w.sum()
        u = HUB * (p["x"] + s * p["sx"]) + p["v"] + p["dvdx"] * s * p["sx"]; b = np.sqrt(2 * kB * p["T"] / mH) / 1e5
        prof = wofz((ug[None, :] - u[:, None]) / b + 1j * gam / b).real / (np.sqrt(np.pi) * b)
        t += p["N"] * sig_v * (w[:, None] * prof).sum(axis=0)
    return t
TAU = {k: tau(c) for k, c in CONFIGS.items()}
F = {'lya': {k: np.exp(-t) for k, t in TAU.items()}, 'lyb': {k: np.exp(-R_LYB * t) for k, t in TAU.items()}}
def dchi2(line): return {str(snr): {k: float(np.sum((F[line][k] - F[line]["i"]) ** 2) * snr ** 2) for k in F[line]} for snr in SNRS}
out = dict(oracle="exact Voigt (wofz), 4001 sub-cells per clump over ±5σ", pixel_kms=2.5, snr=list(SNRS), lyb_over_lya_flambda=R_LYB,
           F={k: v.tolist() for k, v in F['lya'].items()}, F_lyb={k: v.tolist() for k, v in F['lyb'].items()},
           dchi2=dchi2('lya'), dchi2_lyb=dchi2('lyb'),
           max_abs_dF={k: float(np.max(np.abs(F['lya'][k] - F['lya']["i"]))) for k in TAU},
           max_abs_dF_lyb={k: float(np.max(np.abs(F['lyb'][k] - F['lyb']["i"]))) for k in TAU})
os.makedirs("validation/degeneracy", exist_ok=True)
json.dump(out, open("validation/degeneracy/oracle.json", "w"), indent=1)
for line in ('lya', 'lyb'):
    d = out['dchi2' if line == 'lya' else 'dchi2_lyb']
    print(line, ' · '.join(f"S/N {s}: ii {d[str(s)]['ii']:.3g}, iii {d[str(s)]['iii']:.2g}" for s in SNRS))
