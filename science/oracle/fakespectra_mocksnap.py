"""fakespectra_mocksnap.py — end-to-end check of fake_spectra 2.2.4's snapshot-unit conventions on a tiny mock
Gadget HDF5 snapshot (3 gas particles), through the public Spectra class:

  * Velocities block (Gadget internal u = v_pec / sqrt(a)) -> v_pec via abstractsnapshot.py:114-119;
  * SmoothingLength block (Gadget support H) -> fake_spectra h = H/2 (abstractsnapshot.py:275);
  * Density (1e10 Msun/h / (kpc/h)^3 comoving) -> n_H in physical 'amu'/cm^3 (gas_properties.py:105-110) and
    n_HI = n_H * X * f_HI / amumass (spectra.py:593-615);
  * InternalEnergy + ElectronAbundance -> T (abstractsnapshot.py:121-154);
  * Spectra.get_velocity / get_temp / get_col_density weighting (spectra.py:945-1013, 862-879).

The snapshot is written to science/.cache/mocksnap/ (scratch). Results -> science/validation/closure/mocksnap.json.
    python3 science/oracle/fakespectra_mocksnap.py
"""
from __future__ import annotations

import io
import json
import math
import os
import sys
import contextlib

import numpy as np
import h5py

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.dont_write_bytecode = True  # keep science/oracle free of __pycache__
import fakespectra_closure as fc  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
SNAPDIR = os.path.abspath(os.path.join(ROOT, "science", ".cache", "mocksnap"))
OUTJSON = os.path.join(ROOT, "science", "validation", "closure", "mocksnap.json")

Z = 3.0
A = 1 / (1 + Z)
COSMO = dict(Om=0.3, OL=0.7, h=0.7)
BOX = 5000.0
UNIT_DENS = 1.98892e43 / 3.085678e21 ** 3          # unitsystem.py:7,13 defaults
PROTON = 1.67262178e-24
BOLTZ_PY = 1.38066e-16                             # unitsystem.py:23 (python side)
X_H = 0.76


def u_for_T(T, ne):
    mu = 4.0 / (X_H * (3 + 4 * ne) + 1)
    return T * BOLTZ_PY / ((5.0 / 3 - 1) * PROTON * mu) / 1e10   # (km/s)^2


def rho_code_for_nHI(nHI, fHI):
    """Code density giving physical n_HI (cm^-3) under fake_spectra's own conversion."""
    conv = UNIT_DENS * COSMO["h"] ** 2 / PROTON * (1 + Z) ** 3
    return nHI * fc.FS_AMU_H / (X_H * fHI) / conv


def main():
    os.makedirs(SNAPDIR, exist_ok=True)
    fn = os.path.join(SNAPDIR, "snap_003.hdf5")
    # three well-separated particles on the sightline y = z = 0 (axis 1 = x)
    xs = np.array([1000.3, 2501.3, 4000.7])
    vpec = np.array([0.0, +40.0, -25.0])               # physical peculiar km/s
    Hgad = np.array([60.0, 60.0, 120.0])                # Gadget SmoothingLength (support) -> fake_spectra h = H/2
    T = np.array([1e4, 2e4, 5e3])
    ne = np.full(3, 1.16)
    fHI = np.full(3, 1e-5)
    nHI = np.array([3e-11, 3e-11, 1e-11])              # physical cm^-3
    rho = rho_code_for_nHI(nHI, fHI)
    with h5py.File(fn, "w") as f:
        H = f.create_group("Header")
        H.attrs["BoxSize"] = BOX
        H.attrs["Time"] = A
        H.attrs["Redshift"] = Z
        H.attrs["HubbleParam"] = COSMO["h"]
        H.attrs["Omega0"] = COSMO["Om"]
        H.attrs["OmegaLambda"] = COSMO["OL"]
        H.attrs["MassTable"] = np.array([0, 1.0, 0, 0, 0, 0], dtype=np.float64)
        H.attrs["NumPart_ThisFile"] = np.array([3, 0, 0, 0, 0, 0], dtype=np.int32)
        H.attrs["NumPart_Total"] = np.array([3, 0, 0, 0, 0, 0], dtype=np.int64)  # uint32 (as Gadget writes) overflows under numpy 2 in abstractsnapshot.py:228
        H.attrs["NumPart_Total_HighWord"] = np.zeros(6, dtype=np.int64)
        g = f.create_group("PartType0")
        pos = np.zeros((3, 3), np.float32)
        pos[:, 0] = xs
        vel = np.zeros((3, 3), np.float32)
        vel[:, 0] = vpec / math.sqrt(A)                   # Gadget-2/3 internal velocity convention
        g["Coordinates"] = pos
        g["Velocities"] = vel
        g["Density"] = rho.astype(np.float32)
        g["SmoothingLength"] = Hgad.astype(np.float32)
        g["InternalEnergy"] = u_for_T(T, ne).astype(np.float32)
        g["ElectronAbundance"] = ne.astype(np.float32)
        g["NeutralHydrogenAbundance"] = fHI.astype(np.float32)
        g["Masses"] = np.full(3, 1e-4, np.float32)

    from fake_spectra import spectra
    nbins = 1024
    vmax = BOX * fc.fs_velfac(Z, COSMO)[0]
    with contextlib.redirect_stdout(io.StringIO()):
        sp = spectra.Spectra(3, SNAPDIR, cofm=np.array([[0.0, 0.0, 0.0]]), axis=np.array([1]), res=None,  # passing both res and nbins leaves self.nbins unset (spectra.py:220-232)
                             nbins=nbins, reload_file=True, savedir=SNAPDIR, quiet=True)
        tau = sp.get_tau("H", 1, 1215)[0]
        colden = sp.get_col_density("H", 1)[0]
        tempw = sp.get_temp("H", 1)[0]
        # Under numpy 2, Spectra.get_velocity raises "One of the data arrays does not have 32-bit float type"
        # (spectra.py:952-955: phys is a float64 numpy scalar, so elem_den*weight/phys is promoted to float64).
        # In-process dtype shim only (no file is modified): cast the weight array to float32 before the C call, so the
        # upstream Python logic of _vel_single_file (incl. its sqrt(a) factor) runs exactly as written.
        try:
            velw = sp.get_velocity("H", 1)[0][:, 0]
            shim = False
        except TypeError:
            import types
            orig = spectra.Spectra._do_interpolation_work

            def _f32(self, pos, vel, elem_den, temp, hh, amumass, line, get_tau):
                return orig(self, pos, vel, np.asarray(elem_den, dtype=np.float32), temp, hh, amumass, line, get_tau)
            sp._do_interpolation_work = types.MethodType(_f32, sp)
            sp.velocity = {}
            velw = sp.get_velocity("H", 1)[0][:, 0]
            shim = True
    out = dict(nbins=int(sp.nbins), dvbin=float(sp.dvbin), velfac=float(sp.velfac), vmax=float(sp.vmax),
               kernel_int=int(sp.kernel_int), tautail=float(sp.tautail),
               get_velocity_needed_float32_shim_under_numpy2=shim)
    # direct call with my reading of the conventions
    velfac, rscale, _ = fc.fs_velfac(Z, COSMO)
    parts = dict(pos=np.stack([xs, np.zeros(3), np.zeros(3)], 1), vel=np.stack([vpec, np.zeros(3), np.zeros(3)], 1),
                 dens=nHI * rscale, temp=T, h=Hgad / 2)
    # the code's own n_HI (float32 chain) for an exact comparison
    tau_direct = fc.fs_call(parts, BOX, sp.nbins, Z, COSMO)
    out["direct_vs_Spectra_get_tau_max_rel"] = float(np.max(np.abs(tau_direct - tau) / np.maximum(tau, 1e-300)))
    # line centres
    ug = (np.arange(sp.nbins) + 0.5) * sp.dvbin
    exp_u = np.mod(velfac * xs + vpec, vmax)
    found = []
    for u0 in exp_u:
        m = np.abs(ug - u0) < 30
        found.append(float(ug[m][np.argmax(tau[m])]))
    out["expected_line_centres_kms"] = exp_u.tolist()
    out["argmax_tau_near_expected_kms"] = found
    out["line_centre_offsets_in_pixels"] = ((np.array(found) - exp_u) / sp.dvbin).tolist()
    # column density of each particle and real-space extent (tests SmoothingLength/2)
    dx = BOX / sp.nbins
    xc = (np.arange(sp.nbins) + 0.5) * dx
    ext = []
    cols = []
    for x0, Hg in zip(xs, Hgad):
        m = np.abs(xc - x0) < Hg * 1.2
        nz = xc[m][colden[m] > 0]
        ext.append([float(nz.min() - x0), float(nz.max() - x0)])
        cols.append(float(colden[m].sum()))
    out["colden_support_relative_to_particle_kpch"] = ext
    out["gadget_SmoothingLength_kpch"] = Hgad.tolist()
    out["column_per_particle_cm2"] = cols
    out["column_expected_nHI_x_rscale_x_6overpi_x_H/2"] = (nHI * rscale * 6 / math.pi * Hgad / 2).tolist()
    # weighted fields at the particle centres
    j = [int(x0 // dx) for x0 in xs]
    out["get_velocity_at_particles_kms"] = [float(velw[i]) for i in j]
    out["true_vpec_kms"] = vpec.tolist()
    out["get_velocity_over_vpec"] = [float(velw[i] / v) if v else None for i, v in zip(j, vpec)]
    out["sqrt_a"] = math.sqrt(A)
    out["get_temp_at_particles_K"] = [float(tempw[i]) for i in j]
    out["true_T_K"] = T.tolist()
    with open(OUTJSON, "w") as f:
        json.dump(out, f, indent=1)
    print(json.dumps(out, indent=1))


if __name__ == "__main__":
    main()
