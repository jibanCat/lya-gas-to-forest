"""fakespectra_validation_mode.py — what a convention-aligned ("validation mode") browser run achieves on the controlled
cases (C1–C8). Writes science/validation/closure/validation_mode.json.

For each case:
  A  port defaults, but thermal-b mass = fake_spectra's 1.00794 m_p          vs fake_spectra
  B  native skewer + 'point', all FS constants, exact Voigt, no support cut   vs exact reference
  C  native skewer + exact pixel average (otherwise as B)                    vs exact reference
B vs C shows that at native resolution the real-space deposit already supplies the pixel average, so 'point' is the
consistent choice and a further pixel average double-counts it.
    python3 science/oracle/fakespectra_validation_mode.py
"""
import json
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.dont_write_bytecode = True  # keep science/oracle free of __pycache__
import fakespectra_closure as fc  # noqa: E402
import fakespectra_run_closure as R  # noqa: E402


def main():
    out = {}
    for c in R.build_cases():
        if c.get("forest"):
            continue
        box, nb = c["box"], c["nbins"]
        parts = {k: np.array(v, float) for k, v in c["parts"].items()}
        if c.get("norm"):
            t = fc.fs_call(parts, box, nb, R.Z, R.COSMO)
            parts["dens"] *= c["norm"] / t.max()
        ug, du, vbox = R.ugrid_for(box, nb)
        ref = fc.reference_tau(parts, box, nb, R.Z, R.COSMO)
        fs = fc.fs_call(parts, box, nb, R.Z, R.COSMO)
        sk, dep, P = fc.skewer_from_particles(parts, box, nb, R.Z, R.COSMO)
        run = lambda cl, **kw: fc.tau_from_cells(ug, cl, period=vbox, **{**R.PORT_OPTS, **kw})
        ph_m = dict(fc.BROWSER, mass=fc.FAKESPECTRA["mass"])
        A = run(fc.cells_from_skewer(sk, ph=ph_m), ph=ph_m)
        cfs = fc.cells_from_skewer(sk, ph=R.PH_FS_CONST)
        B = run(cfs, ph=R.PH_FS_CONST, voigt="wofz", cut=np.inf)
        Cx = run(cfs, ph=R.PH_FS_CONST, voigt="wofz", cut=np.inf, sample="exact")
        out[c["name"]] = {"A_port_mass_override_vs_FS": fc.metrics(A, fs, du),
                          "B_native_point_FSconst_wofz_nocut_vs_REF": fc.metrics(B, ref, du),
                          "C_native_exactbin_FSconst_wofz_nocut_vs_REF": fc.metrics(Cx, ref, du),
                          "FS_vs_REF": fc.metrics(fs, ref, du)}
        print(c["name"], *(f"{k[:1]} {v['max_abs_dF']:.1e}" for k, v in out[c["name"]].items()), flush=True)
    with open(os.path.join(R.OUT, "validation_mode.json"), "w") as f:
        json.dump(out, f, indent=1)


if __name__ == "__main__":
    main()
