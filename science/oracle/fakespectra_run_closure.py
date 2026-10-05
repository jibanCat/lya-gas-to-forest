"""fakespectra_run_closure.py — run the closure study: fake_spectra 2.2.4 vs the browser real-space method.

    python3 science/oracle/fakespectra_run_closure.py            # all cases
    python3 science/oracle/fakespectra_run_closure.py C1b C6a    # selected cases

Writes  science/validation/closure/cases/<case>.json  (inputs for the JS implementation + fake_spectra / port / reference
tau) and  science/validation/closure/metrics.json.  RESULTS.md is written by hand from metrics.json.
"""
from __future__ import annotations

import json
import math
import os
import sys
import time

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.dont_write_bytecode = True  # keep science/oracle free of __pycache__
import fakespectra_closure as fc  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
OUT = os.path.join(ROOT, "science", "validation", "closure")
CASEDIR = os.path.join(OUT, "cases")

Z = 3.0
COSMO = dict(Om=0.3, OL=0.7, h=0.7)
VELFAC, RSCALE, ATIME = fc.fs_velfac(Z, COSMO)
FSD = fc.derived(fc.FAKESPECTRA)
BRD = fc.derived(fc.BROWSER)
B_FS_1E4 = FSD["bfac"] * 100.0
# browser run options for the "default" port tau exported to JSON
PORT_OPTS = dict(sample="point", cut=8, tauFloor=1e-6)
# constants toggle: fake_spectra's line/thermal constants but the browser's Mpc (used only for n_HI <-> N, which cancels)
PH_FS_CONST = dict(fc.FAKESPECTRA, Mpc_cm=fc.BROWSER["Mpc_cm"], name="fs-constants")


def col_to_dens(N, h, dr2=0.0):
    """dens such that the column through the kernel at impact parameter^2 dr2 equals N (cubic kernel, exact)."""
    z, w = fc._kernel_nodes(dr2, h, h / 64.0, order=16)
    return N / w.sum()


def single(x, N, T=1e4, v=0.0, h=30.0, y=0.0):
    dr2 = y * y
    return dict(pos=np.array([[x, y, 0.0]]), vel=np.array([[v, 0.0, 0.0]]), dens=np.array([col_to_dens(N, h, dr2)]),
                temp=np.array([T]), h=np.array([h]))


def concat(*ps):
    return {k: np.concatenate([p[k] for p in ps]) for k in ps[0]}


def structure(sgn, amp_v, taper=None, n=81, x0=1500.0, dxp=25.0, h=100.0, delta0=4.0, sig=300.0):
    xc = x0 + dxp * (n - 1) / 2
    x = x0 + dxp * np.arange(n)
    dlt = delta0 * np.exp(-0.5 * ((x - xc) / sig) ** 2)
    T = 1e4 * (1 + dlt) ** 0.5
    v = sgn * amp_v * VELFAC * (x - xc)
    if taper:
        v = v * np.exp(-0.5 * ((x - xc) / taper) ** 2)
    col = (1 + dlt) ** 2 * (T / 1e4) ** -0.7 * 1e12
    return dict(pos=np.stack([x, np.zeros(n), np.zeros(n)], 1), vel=np.stack([v, np.zeros(n), np.zeros(n)], 1),
                dens=np.array([col_to_dens(c, h) for c in col]), temp=T, h=np.full(n, h))


def zeldovich(seed, box=20000.0, npart=2048, R=100.0, srms=0.7, eta=2.5, A=1.0, mode="lognormal"):
    """1D toy forests.
    mode='lognormal' (Bi & Davidsen 1997-like, gas-like): Gaussian field g(x) (P ~ k^-1 e^{-(kR)^2}, rms srms) on a
      fine Eulerian grid; Delta = exp(g - srms^2/2); linear-theory velocity dv/dx = -f aH g (f = 1); particles placed
      at equal-mass positions (spacing ∝ 1/Delta), each with the local v, Delta.  One velocity per position: no
      multi-streaming; redshift-space folds (dv/dx < -aH) occur where g > 1.
    mode='zeldovich' (stress test): Gaussian displacement psi(q), rms(dpsi/dq) = srms, x = q + psi, v = f aH psi ->
      shell crossing (multi-streaming) where 1 + dpsi/dq < 0.
    Both: T = 1e4 Delta^0.6 (cap 1e5), h = eta * (box/npart)/Delta, particle HI column ∝ Delta^2 T^-0.7 x (dq/Delta)."""
    rng = np.random.default_rng(seed)
    dq = box / npart
    q = (np.arange(npart) + 0.5) * dq
    if mode == "zeldovich":
        k = 2 * np.pi * np.fft.rfftfreq(npart, d=dq)
        amp = np.zeros_like(k)
        amp[1:] = k[1:] ** -1.0 * np.exp(-0.5 * (k[1:] * R) ** 2)  # psi spectrum ~ k^-2 e^{-(kR)^2}
        modes = (rng.normal(size=k.size) + 1j * rng.normal(size=k.size)) * amp
        psi = np.fft.irfft(modes, n=npart)
        dpsi = np.fft.irfft(1j * k * modes, n=npart)
        s = srms / dpsi.std()
        psi *= s
        dpsi *= s
        x = np.mod(q + psi, box)
        v = 1.0 * VELFAC * psi
        Delta = np.minimum(1.0 / np.abs(1.0 + dpsi), 30.0)
    else:
        ng = 16 * npart
        dxg = box / ng
        k = 2 * np.pi * np.fft.rfftfreq(ng, d=dxg)
        amp = np.zeros_like(k)
        amp[1:] = k[1:] ** -0.5 * np.exp(-0.5 * (k[1:] * R) ** 2)
        modes = (rng.normal(size=k.size) + 1j * rng.normal(size=k.size)) * amp
        g = np.fft.irfft(modes, n=ng)
        g *= srms / g.std()
        g -= g.mean()
        xg = (np.arange(ng) + 0.5) * dxg
        Dg = np.exp(g - 0.5 * srms ** 2)
        vg = -1.0 * VELFAC * np.cumsum(g) * dxg
        vg -= vg.mean()
        Mg = np.concatenate([[0.0], np.cumsum(Dg)]) / Dg.sum() * box   # mass coordinate at grid edges
        xe = np.arange(ng + 1) * dxg
        x = np.interp(q, Mg, xe)
        v = np.interp(x, xg, vg, period=box)
        Delta = np.minimum(np.interp(x, xg, Dg, period=box), 30.0)
    T = np.minimum(1e4 * Delta ** 0.6, 1e5)
    h = eta * dq / Delta
    col = A * Delta * (T / 1e4) ** -0.7 * dq * 1e10  # n_HI ∝ Δ² T^-0.7 times Eulerian length dq/Δ
    dens = col / (6.0 / math.pi * h)
    return dict(pos=np.stack([x, np.zeros(npart), np.zeros(npart)], 1),
                vel=np.stack([v, np.zeros(npart), np.zeros(npart)], 1), dens=dens, temp=T, h=h)


def build_cases():
    bx = 5000.0
    C = []
    # C1 isolated lines
    for tag, N in (("a", 1e12), ("b", 1e13), ("c", 1e14)):
        C.append(dict(name="C1" + tag, desc=f"isolated line N={N:.0e}, T=1e4 K, v=0, h=30 kpc/h", box=bx, nbins=1024,
                      parts=single(2501.3, N)))
    C.append(dict(name="C1d", desc="isolated line N=1e13 through the kernel at impact parameter 0.6h (dr2>0 path)",
                  box=bx, nbins=1024, parts=single(2501.3, 1e13, y=18.0)))
    # C2 damping wings
    C.append(dict(name="C2a", desc="LLS N=1e19, T=1e4 K (5 Mpc/h box)", box=bx, nbins=1024, parts=single(2501.3, 1e19),
                  images=True))
    C.append(dict(name="C2b", desc="DLA N=2e20, T=1e4 K (5 Mpc/h box: wings truncated at half box)", box=bx, nbins=1024,
                  parts=single(2501.3, 2e20), images=True))
    C.append(dict(name="C2c", desc="DLA N=2e20, T=1e4 K in a 20 Mpc/h box (2048 px)", box=20000.0, nbins=2048,
                  parts=single(10001.3, 2e20), images=True))
    # C3 blends
    db = B_FS_1E4 / VELFAC
    C.append(dict(name="C3a", desc="two N=1e13 lines 1b apart in real space", box=bx, nbins=1024,
                  parts=concat(single(2501.3 - db / 2, 1e13), single(2501.3 + db / 2, 1e13))))
    C.append(dict(name="C3b", desc="two N=1e13 lines 2b apart in real space", box=bx, nbins=1024,
                  parts=concat(single(2501.3 - db, 1e13), single(2501.3 + db, 1e13))))
    C.append(dict(name="C3c", desc="two N=1e13 particles at the SAME position, v = ±b/2 (two velocity components inside one "
                  "real-space pixel)", box=bx, nbins=1024,
                  parts=concat(single(2501.3, 1e13, v=-B_FS_1E4 / 2), single(2501.3, 1e13, v=+B_FS_1E4 / 2))))
    # C4 smooth structures
    C.append(dict(name="C4a", desc="81 overlapping particles (h=4x spacing), overdensity + infall v=-0.5 aH(x-xc) "
                  "(compression x2 in u)", box=bx, nbins=1024, parts=structure(-1, 0.5), norm=3.0))
    C.append(dict(name="C4b", desc="same structure, expansion v=+0.5 aH(x-xc) (stretch x1.5 in u)", box=bx, nbins=1024,
                  parts=structure(+1, 0.5), norm=3.0))
    C.append(dict(name="C4c", desc="same structure, strong tapered infall (overlapping kernels across a gradient steep enough to fold u(x))",
                  box=bx, nbins=1024, parts=structure(-1, 1.6, taper=400.0), norm=3.0))
    # C5 periodic boundary
    C.append(dict(name="C5a", desc="N=1e14 particle whose kernel straddles x=box (x=4995, h=30)", box=bx, nbins=1024,
                  parts=single(4995.0, 1e14), images=True))
    C.append(dict(name="C5b", desc="N=1e14 particle at x=4950 with v=+20 km/s: wraps in velocity only", box=bx,
                  nbins=1024, parts=single(4950.0, 1e14, v=20.0), images=True))
    # C6 narrow lines, coarse pixels
    C.append(dict(name="C6a", desc="cold line T=1e2 K (b=1.28), N=1e13, coarse pixels (56 px, 9.96 km/s)", box=bx,
                  nbins=56, parts=single(2501.3, 1e13, T=1e2, h=10.0), fine=64))
    C.append(dict(name="C6b", desc="T=1e3 K (b=4.06), N=1e13, coarse pixels", box=bx, nbins=56,
                  parts=single(2501.3, 1e13, T=1e3, h=10.0), fine=64))
    C.append(dict(name="C6c", desc="T=1e4 K (b=12.8), N=1e13, coarse pixels", box=bx, nbins=56,
                  parts=single(2501.3, 1e13, T=1e4, h=10.0), fine=64))
    C.append(dict(name="C6d", desc="T=1e2 K, N=1e13, particle placed at a real-space pixel EDGE (x=2589.3), coarse",
                  box=bx, nbins=56, parts=single(2589.29, 1e13, T=1e2, h=10.0), fine=64))
    # C7 sign
    C.append(dict(name="C7a", desc="sign test: N=1e14, v=+30 km/s (must appear at larger u)", box=bx, nbins=1024,
                  parts=single(2501.3, 1e14, v=+30.0)))
    C.append(dict(name="C7b", desc="sign test: N=1e14, v=-30 km/s", box=bx, nbins=1024,
                  parts=single(2501.3, 1e14, v=-30.0)))
    # C8 broad kernels (fake_spectra's 7-node kernel quadrature)
    C.append(dict(name="C8a", desc="broad kernel h=300 kpc/h (±33 km/s), T=1e4, N=1e14", box=bx, nbins=1024,
                  parts=single(2501.3, 1e14, h=300.0)))
    C.append(dict(name="C8b", desc="broad kernel h=300 kpc/h, cold T=2e3 (b=5.7), N=1e14", box=bx, nbins=1024,
                  parts=single(2501.3, 1e14, T=2e3, h=300.0)))
    # C9 forest-like, gas-like (lognormal density, monotonic x(q): no shell crossing), several sightlines
    for s in range(8):
        C.append(dict(name=f"C9s{s}", desc=f"forest-like 1D field, lognormal (Bi-Davidsen-like) density, sigma_g=0.8, "
                      f"linear velocities, NO shell crossing; seed {s}, 20 Mpc/h, 2048 px, 2048 particles (h=2.5 local "
                      "spacings), T=1e4 Delta^0.6, n_HI ~ Delta^2 T^-0.7, <F> tuned to 0.68", box=20000.0, nbins=2048,
                      parts=zeldovich(s, srms=0.8, mode="lognormal"), forest="C9", export=(s < 2)))
    # C10 stress test: a 1D Zel'dovich toy field evolved past shell crossing — deliberately exaggerated; not a model of the IGM or of SPH runs
    for s in range(4):
        C.append(dict(name=f"C10s{s}", desc=f"stress test: 1D Zel'dovich toy field past shell crossing (rms dpsi/dq=0.7; "
                      f"velocity structure inside pixels), seed {100 + s}, 20 Mpc/h, 2048 px, <F> tuned to 0.68", box=20000.0,
                      nbins=2048, parts=zeldovich(100 + s, srms=0.7, mode="zeldovich"), forest="C10",
                      export=(s < 1)))
    return C


def ugrid_for(box, nbins):
    du = box * VELFAC / nbins
    return (np.arange(nbins) + 0.5) * du, du, box * VELFAC


def run_case(c, A_forest=None):
    t0 = time.time()
    box, nbins, parts = c["box"], c["nbins"], {k: np.array(v, float) for k, v in c["parts"].items()}
    if c.get("forest") and A_forest is not None:
        parts["dens"] = parts["dens"] * A_forest
    ug, du, vbox = ugrid_for(box, nbins)
    if c.get("norm"):  # rescale amplitude so that the fake_spectra peak tau = norm
        t = fc.fs_call(parts, box, nbins, Z, COSMO)
        parts["dens"] = parts["dens"] * c["norm"] / t.max()
    res = dict(name=c["name"], desc=c["desc"], box_kpch=box, nbins=nbins, du_kms=du, vbox_kms=vbox)
    P = fc.particle_arrays(parts, box)
    centres = np.mod(VELFAC * P["ppos"] + P["pvel"], vbox)
    bref = float(np.median(FSD["bfac"] * np.sqrt(P["temp"])))
    M = lambda A, B: fc.metrics(A, B, du, centres if len(centres) <= 4 else None, bref, vbox)

    tau_fs = fc.fs_call(parts, box, nbins, Z, COSMO)
    tau_emu = fc.fs_emulate(parts, box, nbins, Z, COSMO)
    res["emulator_vs_fs_max_rel"] = float(np.max(np.abs(tau_emu - tau_fs) / np.maximum(tau_fs, 1e-300)))
    tau_ref = fc.reference_tau(parts, box, nbins, Z, COSMO)
    col_fs = fc.fs_call(parts, box, nbins, Z, COSMO, compute_tau=False)

    # ---- fake_spectra internal errors (emulator toggles, each alone, vs FS; and FS vs reference)
    fsint = {}
    fsint["FS_vs_REF"] = M(tau_fs, tau_ref)
    if not c.get("forest"):
        e_kq = fc.fs_emulate(parts, box, nbins, Z, COSMO, ngrid=256)
        e_px = fc.fs_emulate(parts, box, nbins, Z, COSMO, pixel="exact")
        e_tl = fc.fs_emulate(parts, box, nbins, Z, COSMO, tautail=0.0)
        fsint["kernel_quadrature_NGRID8_vs_256"] = M(tau_fs, e_kq)
        fsint["pixel_quadrature_fs_vs_exact"] = M(tau_fs, e_px)
        fsint["tautail_1e-7_vs_0"] = M(tau_fs, e_tl)
    else:
        e_kq = fc.fs_emulate(parts, box, nbins, Z, COSMO, ngrid=32)
        e_px = fc.fs_emulate(parts, box, nbins, Z, COSMO, pixel="exact")
        fsint["kernel_quadrature_NGRID8_vs_32"] = M(tau_fs, e_kq)
        fsint["pixel_quadrature_fs_vs_exact"] = M(tau_fs, e_px)
    if c.get("images"):
        tau_ref_all = fc.reference_tau(parts, box, nbins, Z, COSMO, images="all")
        fsint["half_box_window_vs_all_images(REF)"] = M(tau_ref, tau_ref_all)
        res["tau_ref_all_images_max_minus_ref"] = float(np.max(tau_ref_all - tau_ref))
    res["fs_internal"] = fsint

    # ---- browser side
    sk, dep, Pd = fc.skewer_from_particles(parts, box, nbins, Z, COSMO)
    res["deposit_column_vs_fs_colden_max_rel"] = float(
        np.max(np.abs(sk["nHI"] * sk["dx_mpch"] * ATIME / COSMO["h"] * fc.BROWSER["Mpc_cm"] - col_fs)
               / max(col_fs.max(), 1e-300)))
    cells = fc.cells_from_skewer(sk)
    run = lambda cl, **kw: fc.tau_from_cells(ug, cl, period=vbox, **{**PORT_OPTS, **kw})
    B0 = run(cells)
    res["headline_port_vs_FS"] = M(B0, tau_fs)
    res["port_vs_REF"] = M(B0, tau_ref)

    cells_fsb = fc.cells_from_skewer(sk, ph=PH_FS_CONST)
    fine = c.get("fine", 16 if not c.get("forest") else 4)
    skF, depF, PF = fc.skewer_from_particles(parts, box, nbins * fine, Z, COSMO)
    cells_F = fc.cells_from_skewer(skF)
    pp = fc.per_particle_cells(dep, Pd, box, nbins, Z, COSMO)
    pp_fs = fc.per_particle_cells(dep, Pd, box, nbins, Z, COSMO, ph=PH_FS_CONST)
    ppF_fs = None if c.get("forest") else fc.per_particle_cells(depF, PF, box, nbins * fine, Z, COSMO, ph=PH_FS_CONST)

    one = {}
    one["constants(FS m=1.00794 m_p, k_B, Gamma, sigma)"] = M(run(cells_fsb, ph=PH_FS_CONST), B0)
    ph_m = dict(fc.BROWSER, mass=fc.FAKESPECTRA["mass"], name="mass-only")
    ph_G = dict(fc.BROWSER, Gamma=fc.FAKESPECTRA["Gamma"], name="Gamma-only")
    ph_r = dict(fc.BROWSER, kB=fc.FAKESPECTRA["kB"], pie2_mec=fc.FAKESPECTRA["pie2_mec"], name="kB+sigma")
    one["  constants: H mass only (1.00794 m_p vs m_H)"] = M(run(fc.cells_from_skewer(sk, ph=ph_m), ph=ph_m), B0)
    one["  constants: Gamma only (6.265e8 vs 6.2649e8)"] = M(run(cells, ph=ph_G), B0)
    one["  constants: k_B and pi e^2/m_e c only"] = M(run(fc.cells_from_skewer(sk, ph=ph_r), ph=ph_r), B0)
    one["voigt(W4->wofz)"] = M(run(cells, voigt="wofz"), B0)
    one["truncation(cut 8b/tauFloor -> none)"] = M(run(cells, cut=np.inf), B0)
    one["sampling(point->JS bin nsub=8)"] = M(run(cells, sample="bin"), B0)
    one["sampling(point->exact pixel average)"] = M(run(cells, sample="exact"), B0)
    one["velocity/T assignment(HI-weighted pixel mean -> per-particle cells)"] = M(run(pp), B0)
    one[f"real-space pixelisation(nx=nbins -> {fine}x nbins, point)"] = M(run(cells_F), B0)
    res["one_at_a_time_from_port"] = one

    lad = {}
    L = [("L0 port default", B0)]
    L.append(("L1 +FS constants", run(cells_fsb, ph=PH_FS_CONST)))
    L.append(("L2 +wofz", run(cells_fsb, ph=PH_FS_CONST, voigt="wofz")))
    L.append(("L3 +no truncation", run(cells_fsb, ph=PH_FS_CONST, voigt="wofz", cut=np.inf)))
    L.append(("L4 +per-particle v,T", run(pp_fs, ph=PH_FS_CONST, voigt="wofz", cut=np.inf)))
    if not c.get("forest"):
        L.append((f"L5 +{fine}x real-space pixels", run(ppF_fs, ph=PH_FS_CONST, voigt="wofz", cut=np.inf)))
        L.append(("L6 +exact pixel average", run(ppF_fs, ph=PH_FS_CONST, voigt="wofz", cut=np.inf, sample="exact")))
    for (n1, t1), (n0, t0_) in zip(L[1:], L[:-1]):
        lad[f"{n1}  vs  {n0}"] = M(t1, t0_)
    lad[f"{L[-1][0].split()[0]} vs REF (residual)"] = M(L[-1][1], tau_ref)
    res["ladder"] = lad

    # ---- practical browser configurations (browser constants), each vs fake_spectra
    osf = 4
    sk4, _, _ = fc.skewer_from_particles(parts, box, nbins * osf, Z, COSMO)
    bmin = float(np.min(fc.dopplerB(P["temp"])))
    osa = max(osf, int(math.ceil(du / (0.5 * bmin))))
    ska, _, _ = fc.skewer_from_particles(parts, box, nbins * osa, Z, COSMO) if osa != osf else (sk4, None, None)
    K = {}
    K["K1 native skewer, point (current default)"] = B0
    K["K2 native skewer, JS bin nsub=8"] = run(cells, sample="bin")
    K["K3 native skewer + sigv broadening, point"] = run(fc.cells_with_sigv(sk))
    K[f"K4 {osf}x oversampled skewer, point"] = run(fc.cells_from_skewer(sk4))
    K[f"K5 {osf}x oversampled skewer, JS bin nsub=8"] = run(fc.cells_from_skewer(sk4), sample="bin")
    K[f"K6 {osf}x oversampled skewer, exact pixel average"] = run(fc.cells_from_skewer(sk4), sample="exact")
    K[f"K7 {osf}x oversampled skewer + sigv, JS bin nsub=8"] = run(fc.cells_with_sigv(sk4), sample="bin")
    K[f"K8 adaptive oversampling ({osa}x: H dx <= b_min/2), exact pixel average"] = \
        run(fc.cells_from_skewer(ska), sample="exact")
    res["configurations_vs_FS"] = {k: M(v, tau_fs) for k, v in K.items()}
    res["configurations_vs_FS_constants_aligned_floor"] = M(
        run(fc.cells_from_skewer(ska, ph=PH_FS_CONST), sample="exact", ph=PH_FS_CONST, voigt="wofz", cut=np.inf), tau_fs)

    # coarse-pixel cases: fake_spectra returns the pixel-averaged TAU; an observed pixel records the pixel-averaged FLUX
    if c.get("fine"):
        mf = c["fine"]
        tf = fc.reference_tau(parts, box, nbins * mf, Z, COSMO)
        F_obs = np.exp(-tf).reshape(nbins, mf).mean(axis=1)
        tau_eff = -np.log(F_obs)
        res["pixel_flux_average_vs_exp_mean_tau"] = dict(
            note="F_obs = <exp(-tau)> over each pixel (exact, from a reference at %dx resolution) vs exp(-<tau>) as "
                 "returned by fake_spectra; metrics: candidate=exp(-<tau>)_FS, baseline=F_obs" % mf,
            metrics=M(tau_fs, tau_eff))
        res["pixel_flux_average_vs_port"] = M(B0, tau_eff)

    # sign / position diagnostics
    res["argmax_u"] = dict(fs=float(ug[np.argmax(tau_fs)]), port=float(ug[np.argmax(B0)]), ref=float(ug[np.argmax(tau_ref)]),
                           expected_centre=[float(x) for x in centres[:4]] if len(centres) <= 4 else None)
    res["runtime_s"] = time.time() - t0

    arrays = dict(tau_fs=tau_fs, tau_port=B0, tau_ref=tau_ref)
    for k, v in K.items():
        arrays[k.split()[0]] = v
    if c.get("export", True):
        os.makedirs(CASEDIR, exist_ok=True)
        js = dict(case=c["name"], description=c["desc"], z=Z, cosmo=COSMO, dx_mpch=sk["dx_mpch"],
                  x=sk["x"].tolist(), nHI=sk["nHI"].tolist(), T=sk["T"].tolist(), v=sk["v"].tolist(),
                  ugrid=ug.tolist(), period_kms=vbox,
                  port_options=PORT_OPTS,
                  tau_fake_spectra=tau_fs.tolist(), tau_port=B0.tolist(), tau_reference=tau_ref.tolist(),
                  notes=dict(
                      coordinates="x = real-space pixel centres (comoving Mpc/h), pixel j spans [j, j+1)*dx_mpch; "
                                  "ugrid = (j+0.5)*period_kms/nbins = fake_spectra pixel centres (pixel j spans "
                                  "[j, j+1)*dvbin, absorption.cpp:246-255).",
                      nHI="proper cm^-3, = column in pixel / (dx_mpch*a/h*Mpc_cm[browser]).",
                      T_v="HI-column-weighted per pixel; v physical km/s, + = away from observer.",
                      tau_port="Python port of lyaphys.js tauFromCells(ugrid, cellsFromSkewer(sk), {period: "
                               "period_kms, sample:'point', cut:8, tauFloor:1e-6})",
                      tau_fake_spectra="fake_spectra._spectra_priv._Particle_Interpolate (v2.2.4), kernel=1 (cubic), "
                                       "tautail=1e-7, amumass=1.00794, lambda=1215.6701e-8 cm, Gamma=6.265e8, f=0.4164",
                      tau_reference="exact per-particle kernel x wofz Voigt, exact pixel average, fake_spectra "
                                    "constants and half-box image window"),
                  particles=dict(box_kpch=box, nbins=nbins, kernel="cubic, support radius h",
                                 pos_kpch=parts["pos"].tolist(), vel_kms=parts["vel"].tolist(),
                                 dens_fs_units=parts["dens"].tolist(), temp=parts["temp"].tolist(),
                                 h_kpch=parts["h"].tolist()))
        with open(os.path.join(CASEDIR, c["name"] + ".json"), "w") as f:
            json.dump(js, f)
    return res, arrays


def p1d(tau, vbox, rescale_to=None):
    F = np.exp(-tau)
    if rescale_to is not None:
        from fake_spectra.fluxstatistics import mean_flux
        s = mean_flux(tau, rescale_to)
        F = np.exp(-s * tau)
    dF = F / F.mean() - 1
    pk = np.abs(np.fft.rfft(dF, axis=1)) ** 2 / dF.shape[1] ** 2 * vbox
    k = 2 * np.pi * np.fft.rfftfreq(dF.shape[1], d=vbox / dF.shape[1])
    return k, pk.mean(axis=0)


def main(sel):
    cases = build_cases()
    if sel:
        cases = [c for c in cases if c["name"] in sel or c["name"][:2] in sel]
    out_path = os.path.join(OUT, "metrics.json")
    allres = {}
    if os.path.exists(out_path) and sel:
        with open(out_path) as f:
            allres = json.load(f).get("cases", {})
    # forest amplitude: per family, tune A so that the fake_spectra mean flux over the family's sightlines = 0.68
    from scipy.optimize import brentq
    Afam = {}
    for fam in sorted({c["forest"] for c in cases if c.get("forest")}):
        taus = [fc.fs_call(c["parts"], c["box"], c["nbins"], Z, COSMO) for c in cases if c.get("forest") == fam]
        Afam[fam] = 10 ** brentq(lambda lA: np.mean([np.exp(-t * 10 ** lA).mean() for t in taus]) - 0.68, -6, 6)
    ftaus = {}
    for c in cases:
        r, arr = run_case(c, A_forest=Afam.get(c.get("forest")))
        allres[c["name"]] = r
        if c.get("forest"):
            ftaus.setdefault(c["forest"], {})[c["name"]] = arr
        print(f"{c['name']:6s} {r['runtime_s']:6.1f}s  port-vs-FS maxdF={r['headline_port_vs_FS']['max_abs_dF']:.2e} "
              f"dEW/EW={r['headline_port_vs_FS']['rel_d_EW']:+.2e}  FS-vs-REF maxdF="
              f"{r['fs_internal']['FS_vs_REF']['max_abs_dF']:.2e}  emu={r['emulator_vs_fs_max_rel']:.1e}", flush=True)
    summary = {}
    if os.path.exists(out_path) and sel:
        with open(out_path) as f:
            summary = json.load(f).get("summary", {})
    for fam, fl in ftaus.items():
        vbox = 20000.0 * VELFAC
        names = sorted(fl)
        T = {k: np.array([fl[n][k] for n in names]) for k in fl[names[0]]}
        meanF = {k: float(np.exp(-v).mean()) for k, v in T.items()}
        k, pfs = p1d(T["tau_fs"], vbox)
        _, pfs_r = p1d(T["tau_fs"], vbox, rescale_to=0.68)
        bins = [(0.001, 0.01), (0.01, 0.02), (0.02, 0.05), (0.05, 0.1)]
        table = {}
        for key, tt in T.items():
            if key == "tau_fs":
                continue
            _, pp = p1d(tt, vbox)
            _, pp_r = p1d(tt, vbox, rescale_to=0.68)
            rows = []
            for lo, hi in bins:
                m = (k > lo) & (k <= hi)
                rows.append(dict(k_lo_skm=lo, k_hi_skm=hi, ratio_minus1=float(pp[m].mean() / pfs[m].mean() - 1),
                                 ratio_minus1_both_rescaled_to_F068=float(pp_r[m].mean() / pfs_r[m].mean() - 1)))
            table[key + "_over_fs"] = rows
        summary["forest_" + fam] = dict(A=Afam[fam], sightlines=names, mean_F=meanF, p1d_band_ratios=table)
    with open(out_path, "w") as f:
        json.dump(dict(generated=time.strftime("%Y-%m-%d %H:%M:%S"), z=Z, cosmo=COSMO, velfac_kms_per_kpch=VELFAC,
                       b_1e4K_fs=B_FS_1E4, b_1e4K_browser=float(fc.dopplerB(1e4)), port_options=PORT_OPTS,
                       summary=summary, cases=allres), f, indent=1)


if __name__ == "__main__":
    main(sys.argv[1:])
