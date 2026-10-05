"""Beat 7 · real space to velocity space: u = aH x_comoving + v_pec for the three parcels — an independent
reproduction in Python. Positions are comoving Mpc/h from the near edge of the stretch; v_pec > 0 is motion away from
us (redder).

Computed in the app by lya_app (science/js/lyaphys.js: uOfX). Science notes: science/#comp-velocity-mapping
Run:   python3 reproduce/beat07_velocity_mapping.py
"""
# --- snippet ---
import numpy as np

Om, OL, z = 0.3153, 0.6847, 3.0
aH_h = 100 * np.sqrt(Om * (1 + z)**3 + OL) / (1 + z)    # km/s per comoving Mpc/h (independent of h)

x = np.array([1.9303074084405747, 3.175154331970289, 3.8278357071063325])   # parcels a, b, c: comoving Mpc/h
v_pec = np.array([62.0, 87.0, 20.0])                                         # their own motion, km/s

u_hubble = aH_h * x              # expansion alone: the order in velocity follows the order in space
u = aH_h * x + v_pec             # with their own motion: b and c land close together
for name, uh, uu in zip("abc", u_hubble, u):
    print(f"parcel {name}: expansion alone {uh:.1f} km/s, with its own motion {uu:.1f} km/s")
# --- end snippet ---

def expected(app):
    v = app['values']['velocity_mapping']
    return [f"parcel {n}: expansion alone {uh:.1f} km/s, with its own motion {uu:.1f} km/s" for n, uh, uu in zip("abc", v['u_hubble_kms'], v['u_kms'])]

def compare(app):
    v, i = app['values']['velocity_mapping'], app['inputs']['velocity_mapping']
    assert list(x) == i['x_mpch'] and list(v_pec) == i['v_pec_kms']
    return [(f"u_hubble({n})", float(a), b, 1e-12) for n, a, b in zip("abc", u_hubble, v['u_hubble_kms'])] + [(f"u({n})", float(a), b, 1e-12) for n, a, b in zip("abc", u, v['u_kms'])]
