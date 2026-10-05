"""Oracle for SCI-TAU-001/002/003, SCI-SAT-001: single- and multi-line τ(u) with the exact Voigt function
(scipy.special.wofz), both at pixel centres and averaged over pixels (fine quadrature), independent of lyaphys.js.
Constants are typed in here independently (values documented in SCIENCE_LEDGER.yaml, SCI-ATOM-001)."""
import json, os
import numpy as np
from scipy.special import wofz

pie2_mec = 2.6540e-2; f = 0.4164; lam_cm = 1215.6701e-8; A21 = 6.2649e8
sigma_v = pie2_mec * f * lam_cm / 1e5                    # cm^2 km/s
gamma_v = A21 * lam_cm / (4 * np.pi) / 1e5               # km/s
def tau_line(u, uc, N, b, period=0.0):
    d = u - uc
    if period: d = d - period * np.round(d / period)
    return N * sigma_v * wofz(d / b + 1j * gamma_v / b).real / (np.sqrt(np.pi) * b)
def tau_binned(ug, uc, N, b, period=0.0, nsub=401):
    du = ug[1] - ug[0]; off = (np.arange(nsub) + 0.5) / nsub - 0.5
    return np.array([tau_line(u + du * off, uc, N, b, period).mean() for u in ug])
cases = []
def add(name, ug, lines, period=0.0):
    ug = np.asarray(ug, float)
    tp = sum(tau_line(ug, uc, N, b, period) for uc, N, b in lines)
    tb = sum(tau_binned(ug, uc, N, b, period) for uc, N, b in lines)
    cases.append(dict(name=name, ugrid=ug.tolist(), lines=[dict(u=uc, N=N, b=b) for uc, N, b in lines], period=period,
                      tau_point=tp.tolist(), tau_bin=tb.tolist()))
add("forest line N=1e13 b=20, fine pixels", np.linspace(-150, 150, 601), [(0.0, 1e13, 20.0)])
add("weak line N=1e12 b=12.85 (T=1e4)", np.linspace(-100, 100, 401), [(3.0, 1e12, 12.85)])
add("saturated N=1e15 b=25", np.linspace(-250, 250, 1001), [(0.0, 1e15, 25.0)])
add("LLS N=1e18 b=25 (wings start)", np.linspace(-600, 600, 1201), [(0.0, 1e18, 25.0)])
add("DLA N=2e20 b=25 (damping wings)", np.linspace(-3000, 3000, 3001), [(0.0, 2e20, 25.0)])
add("blend: two lines 1.2b apart", np.linspace(-150, 150, 601), [(-12.0, 3e13, 20.0), (12.0, 2e13, 20.0)])
add("narrow line, coarse pixels (b=3, du=10)", np.linspace(-200, 200, 41), [(4.0, 5e12, 3.0)])
add("periodic wrap: line at 5 km/s from edge", np.linspace(0, 1000, 501)[:-1], [(995.0, 3e13, 20.0)], period=1000.0)
os.makedirs("validation/tau", exist_ok=True)
json.dump(dict(oracle="exact Voigt via scipy.special.wofz; pixel average by 401-point midpoint rule",
               sigma_v=sigma_v, gamma_v=gamma_v, cases=cases), open("validation/tau/oracle.json", "w"))
print(len(cases), "cases; sigma_v", sigma_v, "gamma_v", gamma_v)
