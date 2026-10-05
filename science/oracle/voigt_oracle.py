"""Oracle for SCI-VOIGT-001: Voigt–Hjerting H(a,x) = Re w(x + i a) via scipy.special.wofz (Faddeeva function).

Writes science/validation/voigt/oracle_grid.json : a log-spaced grid in a and x covering, with margin, every
(a, x) the browser can reach:  a = Γλ/(4πb) for b in [1, 60] km/s  →  a ∈ [1.0e-4, 6.1e-3];
teaching exaggerations up to a = 1;  x up to 2e4 (damping wings of N ~ 1e21 at b ~ 10 km/s reach |Δu| ~ 2e3 km/s).
"""
import json, os, platform
import numpy as np, scipy
from scipy.special import wofz

a_vals = np.unique(np.concatenate([np.logspace(-6, 0, 37), [1.0e-4, 4.7e-4, 2e-3, 6.1e-3, 0.05, 0.16]]))
x_vals = np.unique(np.concatenate([[0.0], np.logspace(-3, np.log10(2e4), 160), np.linspace(0, 8, 161)]))
A, X = np.meshgrid(a_vals, x_vals, indexing="ij")
H = wofz(X + 1j * A).real
out = dict(
    oracle="scipy.special.wofz (Faddeeva function), Re w(x+ia)",
    scipy_version=scipy.__version__, numpy_version=np.__version__, python=platform.python_version(),
    a=a_vals.tolist(), x=x_vals.tolist(), H=H.tolist(),
)
os.makedirs("validation/voigt", exist_ok=True)
json.dump(out, open("validation/voigt/oracle_grid.json", "w"))
print("grid", A.shape, "a range", a_vals.min(), a_vals.max(), "x range", x_vals.min(), x_vals.max())
