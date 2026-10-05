"""Oracle for SCI-DEG-001: recompute the three 'same shadow' Lyα lines independently (exact Voigt via
scipy.special.wofz, 4001 sub-cells per parcel over ±5σ) and their noise-free Δχ² against configuration (i)."""
import json, os
import numpy as np
from scipy.special import wofz
HUB = 100 * np.sqrt(0.3153 * 4 ** 3 + 0.6847) / 4    # Planck 2018, z = 3; the lines are cosmology-independent (configs in velocity space)
kB, mH = 1.380649e-16, 1.6735328e-24
sig_v = 2.6540e-2 * 0.4164 * 1215.6701e-8 / 1e5; gam = 6.2649e8 * 1215.6701e-8 / (4 * np.pi) / 1e5
_C = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "validation", "degeneracy", "configs.json")))
def to_real(p):    # velocity-space definition → real-space parcel at this H
    sx = p["su"] / HUB
    return dict(x=p["u"] / HUB, sx=sx, N=p["N"], T=p["T"], v=p["v"], dvdx=p["dv"] / sx)
CONFIGS = {k: [to_real(p) for p in v] for k, v in _C["configs"].items()}
ug = np.linspace(-150, 150, 121)
def tau(cfg):
    t = np.zeros_like(ug)
    for p in cfg:
        s = np.linspace(-5, 5, 4001); w = np.exp(-0.5 * s * s); w /= w.sum()
        x = p["x"] + s * p["sx"]; u = HUB * x + p["v"] + p["dvdx"] * s * p["sx"]; b = np.sqrt(2 * kB * p["T"] / mH) / 1e5
        for uj, wj in zip(u, w):
            t += p["N"] * wj * sig_v * wofz((ug - uj) / b + 1j * gam / b).real / (np.sqrt(np.pi) * b)
    return t
F = {k: np.exp(-tau(c)) for k, c in CONFIGS.items()}
out = dict(oracle="exact Voigt (wofz), 4001 sub-cells/parcel over ±5σ", pixel_kms=2.5,
           F={k: v.tolist() for k, v in F.items()},
           dchi2={str(snr): {k: float(np.sum((F[k] - F["i"]) ** 2) * snr ** 2) for k in F} for snr in (20, 50)},
           max_abs_dF={k: float(np.max(np.abs(F[k] - F["i"]))) for k in F})
os.makedirs("validation/degeneracy", exist_ok=True)
json.dump(out, open("validation/degeneracy/oracle.json", "w"), indent=1)
print("Δχ² (S/N=20):", {k: round(v, 2) for k, v in out["dchi2"]["20"].items()}, " (S/N=50):", {k: round(v, 1) for k, v in out["dchi2"]["50"].items()})
