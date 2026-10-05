"""fakespectra_closure.py — closure-study library: fake_spectra 2.2.4 vs the browser real-space τ method.

Contents
  1. BROWSER / FS constant sets (the two unit conventions, side by side).
  2. A faithful Python port of science/js/lyaphys.js:  voigtH (Humlicek W4 everywhere, as of the current file),
     dopplerB, cellsFromSkewer, tauFromCells  (+ opt-in extensions used only for the decomposition: wofz profile,
     exact pixel average, per-constant overrides). With default options the port reproduces the JS.
  3. A driver for fake_spectra's compiled core  fake_spectra._spectra_priv._Particle_Interpolate
     (argument order from py_module.cpp:115 of the v2.2.4 sdist).
  4. A pure-Python emulator of LineAbsorption::add_tau_particle (absorption.cpp:212-279, singleabs.h:104-167) with
     knobs (kernel quadrature NGRID, pixel quadrature, tautail, half-box loop) to attribute fake_spectra's own errors.
  5. An "exact" reference: each particle's SPH kernel integrated finely along the LOS at the particle's own velocity,
     exact Voigt (scipy.special.wofz), exact pixel average over fake_spectra's pixels, fake_spectra's image convention.
  6. Real-space deposit: particles -> uniform real-space skewer (n_HI proper cm^-3, HI-weighted T and v), the input
     format the browser consumes.
  7. Comparison metrics.

Units follow fake_spectra where particles are concerned: positions & smoothing lengths in comoving kpc/h, velocities in
physical km/s (peculiar, + = along +axis = away from the observer), temperatures in K, and the particle "density"
`dens` in fake_spectra's internal unit  [atoms cm^-3 x (proper cm per comoving kpc/h)]  so that  dens * \int K(q) dz[kpc/h]
is a column density in cm^-2 (spectra.py:591-593, absorption.cpp:202-208).

Nothing here writes files; see fakespectra_run_closure.py.
"""
from __future__ import annotations

import math
import numpy as np
from scipy.special import wofz

# =====================================================================================================================
# 1. constants
# =====================================================================================================================
# Browser (science/js/lyaphys.js, object C)
BROWSER = dict(
    name="browser",
    c_kms=299792.458,
    kB=1.380649e-16,
    mass=1.6735328e-24,            # m_H (1H atom, 1.00782503 u) — matches lyaphys.js C.m_H (corrected 2026-10-02)
    pie2_mec=2.6540e-2,            # pi e^2/(m_e c) [cm^2 s^-1]
    lambda_A=1215.6701,
    f=0.4164,
    Gamma=6.2649e8,
    Mpc_cm=3.0856775814913673e24,
)
# fake_spectra 2.2.4 (absorption.h:4, absorption.cpp:21-26,152-160, line_data.py:21, atom.dat:7, spectra.py:216,
# unitsystem.py:7)
FS_SIGMA_T = 6.652458558e-25
FS_BOLTZMANN = 1.3806504e-16
FS_PROTONMASS = 1.67262178e-24
FS_LIGHT = 2.99792458e10
FS_AMU_H = 1.00794
FAKESPECTRA = dict(
    name="fake_spectra",
    c_kms=FS_LIGHT / 1e5,
    kB=FS_BOLTZMANN,
    mass=FS_AMU_H * FS_PROTONMASS,   # NB: 'amu' mass times the *proton* mass
    pie2_mec=math.sqrt(3.0 * math.pi * FS_SIGMA_T / 8.0) * FS_LIGHT,  # = pi r_e c
    lambda_A=1215.6701,
    f=0.4164,
    Gamma=6.265e8,
    Mpc_cm=3.085678e24,
)


def derived(ph):
    """sigma_v [cm^2 km/s], gamma_kms (Lorentz HWHM in km/s), bfac [km/s per sqrt(K)]."""
    lam_cm = ph["lambda_A"] * 1e-8
    return dict(
        sigma_v=ph["pie2_mec"] * ph["f"] * lam_cm / 1e5,
        gamma_kms=ph["Gamma"] * lam_cm / (4 * math.pi) / 1e5,
        bfac=math.sqrt(2 * ph["kB"] / ph["mass"]) / 1e5,
    )


def with_overrides(base, **kw):
    d = dict(base)
    d.update(kw)
    d["name"] = base["name"] + "+" + ",".join(sorted(kw))
    return d


# =====================================================================================================================
# 2. Python port of lyaphys.js
# =====================================================================================================================
def E(z, cosmo):
    return math.sqrt(cosmo["Om"] * (1 + z) ** 3 + cosmo["OL"])


def hubble_per_mpch(z, cosmo):
    """a H(z)/h = 100 E(z)/(1+z) km/s per comoving Mpc/h  (lyaphys.js hubblePerMpch)."""
    return 100 * E(z, cosmo) / (1 + z)


def _polyval_c(t, cs):
    r = np.full_like(t, cs[-1], dtype=complex)
    for c in cs[-2::-1]:
        r = r * t + c
    return r


def humlicek_w4(x, y):
    """Re w(x + i y), Humlicek (1982) W4 — same region logic and coefficients as lyaphys.js humlicekW4.
    x: array (any sign), y: scalar >= 0."""
    x = np.asarray(x, dtype=float)
    t = y - 1j * x
    s = np.abs(x) + y
    out = np.empty(x.shape, dtype=float)
    r1 = s >= 15
    r2 = (~r1) & (s >= 5.5)
    r3 = (~r1) & (~r2) & (y >= 0.195 * np.abs(x) - 0.176)
    r4 = ~(r1 | r2 | r3)
    if r1.any():
        tt = t[r1]
        out[r1] = (tt * 0.5641896 / (0.5 + tt * tt)).real
    if r2.any():
        tt = t[r2]
        u = tt * tt
        out[r2] = (tt * (1.410474 + u * 0.5641896) / (0.75 + u * (3 + u))).real
    if r3.any():
        tt = t[r3]
        num = _polyval_c(tt, [16.4955, 20.20933, 11.96482, 3.778987, 0.5642236])
        den = _polyval_c(tt, [16.4955, 38.82363, 39.27121, 21.69274, 6.699398, 1])
        out[r3] = (num / den).real
    if r4.any():
        tt = t[r4]
        u = tt * tt
        num = tt * _polyval_c(u, [36183.31, -3321.9905, 1540.787, -219.0313, 35.76683, -1.320522, 0.56419])
        den = _polyval_c(u, [32066.6, -24322.84, 9022.228, -2186.181, 364.2191, -61.57037, 1.841439, -1])
        out[r4] = (np.exp(u) - num / den).real
    return out


def voigtH_browser(a, x):
    """lyaphys.js voigtH(a, x) = humlicekW4(|x|, a)."""
    return humlicek_w4(np.abs(x), a)


def voigtH_exact(a, x):
    return wofz(np.asarray(x, dtype=float) + 1j * a).real


def dopplerB(T, ph=BROWSER):
    return np.sqrt(2 * ph["kB"] * np.asarray(T, dtype=float) / ph["mass"]) / 1e5


def cells_from_skewer(sk, ph=BROWSER):
    """Port of cellsFromSkewer: returns dict of arrays u, N, b (and x, v, T)."""
    cosmo = sk["cosmo"]
    a = 1 / (1 + sk["z"])
    dx_proper_cm = sk["dx_mpch"] * a / cosmo["h"] * ph["Mpc_cm"]
    Hpm = hubble_per_mpch(sk["z"], cosmo)
    x = np.asarray(sk["x"], float)
    v = np.asarray(sk["v"], float)
    T = np.asarray(sk["T"], float)
    return dict(x=x, v=v, T=T, u=Hpm * x + v, N=np.asarray(sk["nHI"], float) * dx_proper_cm, b=dopplerB(T, ph))


def _js_round(q):
    """JavaScript Math.round (half rounds toward +inf)."""
    return np.floor(q + 0.5)


_GL = {n: np.polynomial.legendre.leggauss(n) for n in (2, 4, 6, 8, 12, 16)}


def tau_from_cells(ugrid, cells, period=0.0, sample="point", nsub=8, cut=8.0, tauFloor=1e-6, profile="voigt",
                   ph=BROWSER, voigt="w4"):
    """Port of lyaphys.js tauFromCells.
    JS-faithful when voigt='w4', sample in ('point','bin'), ph=BROWSER.
    Decomposition-only extensions: voigt='wofz'; sample='exact' (Gauss-Legendre pixel average, sub-intervals <= b/4);
    ph=FAKESPECTRA (or overrides) to swap constants; cut=np.inf to disable the core/wing support cut."""
    ugrid = np.asarray(ugrid, float)
    n = len(ugrid)
    tau = np.zeros(n)
    dv = derived(ph)
    du = (ugrid[-1] - ugrid[0]) / (n - 1) if n > 1 else 1.0
    H = voigtH_browser if voigt == "w4" else voigtH_exact
    if sample == "bin":
        offs = du * ((np.arange(nsub) + 0.5) / nsub - 0.5)
        wts = np.full(nsub, 1.0 / nsub)
    elif sample == "point":
        offs = np.array([0.0])
        wts = np.array([1.0])
    for uc, N, b in zip(cells["u"], cells["N"], cells["b"]):
        if not (N > 0):
            continue
        a = dv["gamma_kms"] / b
        pref = N * dv["sigma_v"] / (math.sqrt(math.pi) * b)
        wing = math.sqrt(max(0.0, pref * a * b * b / (math.sqrt(math.pi) * tauFloor)))
        half = max(cut * b, 0.0 if profile == "gauss" else wing)
        d = ugrid - uc
        if period:
            d = d - period * _js_round(d / period)
        m = (d >= -half - du) & (d <= half + du)
        if not m.any():
            continue
        dm = d[m]
        if sample == "exact":
            nseg = max(1, int(math.ceil(du / (0.25 * b))))
            xg, wg = _GL[8]
            edges = np.linspace(-0.5 * du, 0.5 * du, nseg + 1)
            o = (0.5 * (edges[1:] - edges[:-1])[:, None] * xg[None, :] + 0.5 * (edges[1:] + edges[:-1])[:, None]).ravel()
            w = (0.5 * (edges[1:] - edges[:-1])[:, None] * wg[None, :]).ravel() / du
        else:
            o, w = offs, wts
        xx = (dm[:, None] + o[None, :]) / b
        prof = np.exp(-xx * xx) if profile == "gauss" else H(a, xx.ravel()).reshape(xx.shape)
        tau[m] += pref * (prof @ w)
    return tau


# =====================================================================================================================
# 3. fake_spectra compiled core
# =====================================================================================================================
def fs_velfac(z, cosmo, unit_length_cm=3.085678e21):
    """spectra.py:210-216: rscale = UnitLength*a/h ; Hz = 100 h sqrt(Om/a^3+OL) ; velfac = rscale*Hz/3.085678e24."""
    atime = 1.0 / (1 + z)
    rscale = unit_length_cm * atime / cosmo["h"]
    Hz = 100.0 * cosmo["h"] * np.sqrt(cosmo["Om"] / atime ** 3 + cosmo["OL"])
    return rscale * Hz / 3.085678e24, rscale, atime


def fs_call(parts, box, nbins, z, cosmo, compute_tau=True, kernel=1, tautail=1e-7, line=None, amumass=FS_AMU_H,
            axis=1, cofm_perp=(0.0, 0.0)):
    """Call fake_spectra._spectra_priv._Particle_Interpolate for ONE sightline along `axis` (1-indexed: 1 = x).
    parts: dict pos (N,3) kpc/h, vel (N,3) km/s physical peculiar, dens (N,) [atoms cm^-2 per kpc/h], temp (N,) K,
           h (N,) kpc/h (kernel SUPPORT radius, fake_spectra convention).
    Returns tau (nbins,) or colden (nbins,) [cm^-2]."""
    from fake_spectra._spectra_priv import _Particle_Interpolate
    if line is None:
        line = (1215.6701e-8, 6.265e8, 0.4164)  # atom.dat:7 via line_data.read_vpfit, lambda in cm (spectra.py:673)
    velfac, _, atime = fs_velfac(z, cosmo)
    pos = np.ascontiguousarray(parts["pos"], dtype=np.float32)
    vel = np.ascontiguousarray(parts["vel"], dtype=np.float32)
    dens = np.ascontiguousarray(parts["dens"], dtype=np.float32)
    temp = np.ascontiguousarray(parts["temp"], dtype=np.float32)
    hh = np.ascontiguousarray(parts["h"], dtype=np.float32)
    ax = np.array([axis], dtype=np.int32)
    cofm = np.zeros((1, 3), dtype=np.float64)
    other = [i for i in range(3) if i != axis - 1]
    cofm[0, other[0]], cofm[0, other[1]] = cofm_perp
    out = _Particle_Interpolate(int(bool(compute_tau)), int(nbins), int(kernel), float(box), float(velfac), float(atime),
                                float(line[0]), float(line[1]), float(line[2]), float(amumass), float(tautail),
                                pos, vel, dens, temp, hh, ax, cofm)
    return np.asarray(out)[0].astype(float)


# =====================================================================================================================
# 4. kernels + Python emulator of fake_spectra's per-particle tau
# =====================================================================================================================
def sph_cubic_kernel(q):
    """singleabs.h:17-26 (support q < 1, norm 32/(4 pi) = 8/pi)."""
    q = np.asarray(q, float)
    norm = 32.0 / 4 / math.pi
    out = np.where(q < 0.5, norm * (1 - 6 * q * q + 6 * q ** 3), norm * 2 * (1 - q) ** 3)
    return np.where(q >= 1, 0.0, out)


def particle_arrays(parts, box, axis=1):
    """Along-axis position (kpc/h), dr2 (kpc/h)^2 to a sightline at transverse origin, LOS velocity, as float32-rounded
    doubles (the C code reads float32)."""
    f32 = lambda a: np.asarray(a, dtype=np.float32).astype(float)
    pos = f32(parts["pos"])
    vel = f32(parts["vel"])
    other = [i for i in range(3) if i != axis - 1]
    d1 = np.abs(pos[:, other[0]])
    d1 = np.where(d1 > 0.5 * box, box - d1, d1)
    d2 = np.abs(pos[:, other[1]])
    d2 = np.where(d2 > 0.5 * box, box - d2, d2)
    return dict(ppos=pos[:, axis - 1], pvel=vel[:, axis - 1], dr2=d1 * d1 + d2 * d2, dens=f32(parts["dens"]),
                temp=f32(parts["temp"]), h=f32(parts["h"]))


def fs_emulate(parts, box, nbins, z, cosmo, ngrid=8, pixel="fs", tautail=1e-7, halfbox=True, ph=FAKESPECTRA,
               voigt="wofz", axis=1):
    """Python emulation of ParticleInterp::compute_tau for one sightline (absorption.cpp:212-279; singleabs.h:104-167).
    ngrid: kernel quadrature points (fake_spectra: NGRID=8 -> 7 interior nodes).
    pixel: 'fs' (tau_kern_outer: centre value if dv < b/2, else trapezoid with spacing <= b/2) or 'exact' (GL).
    tautail: per-particle per-pixel stopping threshold (spectra.py:135 default 1e-7); 0 disables.
    halfbox: True -> loop zmax-nbins/2 .. zmax+nbins/2-1 (fake_spectra); False is not offered (images) — see reference_tau.
    """
    velfac, _, _ = fs_velfac(z, cosmo)
    vbox = box * velfac
    bintov = vbox / nbins
    d = derived(ph)
    sigma_a_c_kms = d["sigma_v"]  # sigma_a * LIGHT/1e5 (cm^2 km/s)
    P = particle_arrays(parts, box, axis)
    tau = np.zeros(nbins)
    Hf = voigtH_exact if voigt == "wofz" else voigtH_browser
    for ppos, pvel, dr2, dens, temp, smooth in zip(P["ppos"], P["pvel"], P["dr2"], P["dens"], P["temp"], P["h"]):
        btherm = d["bfac"] * math.sqrt(temp)
        if smooth * smooth - dr2 <= 0:
            continue
        vel = velfac * ppos + pvel
        vdr2 = velfac * velfac * dr2
        vsmooth = velfac * smooth
        vhigh = math.sqrt(vsmooth * vsmooth - vdr2) if vsmooth * vsmooth > vdr2 else 0.0
        aa = d["gamma_kms"] / btherm
        amp = sigma_a_c_kms / math.sqrt(math.pi) / btherm
        zmax = math.floor(vel / bintov)
        zs = np.arange(zmax - nbins // 2, zmax + nbins // 2)
        vlow = zs * bintov - vel
        # inner (kernel) nodes
        deltav = 2.0 * vhigh / ngrid
        vv = np.arange(1, ngrid) * deltav - vhigh
        q = np.sqrt(vdr2 + vv * vv) / vsmooth
        Kw = sph_cubic_kernel(q) * deltav

        def inner(vouter):
            vouter = np.asarray(vouter, float)
            T0 = (vv[None, :] - vouter[:, None]) / btherm
            return Hf(aa, T0.ravel()).reshape(T0.shape) @ Kw

        if pixel == "fs":
            if bintov < btherm / 2.0:
                tk = inner(vlow + bintov / 2.0)
            else:
                npts = int(2 * math.ceil(bintov / (btherm / 2.0) / 2) + 1.0)
                tt = np.linspace(0.0, 1.0, npts)  # i*deltav + vlow, deltav = bintov/(npts-1)
                wt = np.full(npts, 1.0)
                wt[0] = wt[-1] = 0.5
                wt /= (npts - 1)
                vals = inner((vlow[:, None] + tt[None, :] * bintov).ravel()).reshape(len(zs), npts)
                tk = vals @ wt
        else:
            nseg = max(1, int(math.ceil(bintov / (0.25 * btherm))))
            xg, wg = _GL[8]
            e = np.linspace(0, bintov, nseg + 1)
            o = (0.5 * (e[1:] - e[:-1])[:, None] * xg + 0.5 * (e[1:] + e[:-1])[:, None]).ravel()
            w = (0.5 * (e[1:] - e[:-1])[:, None] * wg).ravel() / bintov
            vals = inner((vlow[:, None] + o[None, :]).ravel()).reshape(len(zs), len(o))
            tk = vals @ w
        taulast = amp * dens * tk / velfac
        # stopping rule: forward from zmax, backward from zmax-1; add then break if < tautail
        i0 = nbins // 2  # index of zmax in zs
        fwd = taulast[i0:]
        bwd = taulast[:i0][::-1]
        if tautail > 0:
            kf = np.argmax(fwd < tautail) if (fwd < tautail).any() else len(fwd) - 1
            kb = np.argmax(bwd < tautail) if (bwd < tautail).any() else len(bwd) - 1
        else:
            kf, kb = len(fwd) - 1, len(bwd) - 1
        sel = np.zeros(len(zs), bool)
        sel[i0:i0 + kf + 1] = True
        if len(bwd):
            sel[i0 - kb - 1:i0] = True
        np.add.at(tau, np.mod(zs[sel], nbins), taulast[sel])
    return tau


# =====================================================================================================================
# 5. exact reference
# =====================================================================================================================
def _kernel_nodes(dr2, h, dz_max, order=8):
    """GL nodes/weights (kpc/h) of K(q(z)) along the chord, split at the kernel breakpoint q = 1/2 and into
    sub-intervals of length <= dz_max. Returns (z, w*K)."""
    zr = math.sqrt(max(h * h - dr2, 0.0))
    if zr == 0:
        return np.zeros(0), np.zeros(0)
    bps = [-zr, zr]
    zh = 0.25 * h * h - dr2
    if zh > 0:
        bps += [-math.sqrt(zh), math.sqrt(zh)]
    bps = sorted(set(bps + [0.0]))
    xg, wg = _GL[order]
    zz, ww = [], []
    for lo, hi in zip(bps[:-1], bps[1:]):
        m = max(1, int(math.ceil((hi - lo) / dz_max)))
        e = np.linspace(lo, hi, m + 1)
        zz.append((0.5 * (e[1:] - e[:-1])[:, None] * xg + 0.5 * (e[1:] + e[:-1])[:, None]).ravel())
        ww.append((0.5 * (e[1:] - e[:-1])[:, None] * wg).ravel())
    z = np.concatenate(zz)
    w = np.concatenate(ww)
    return z, w * sph_cubic_kernel(np.sqrt(dr2 + z * z) / h)


def reference_tau(parts, box, nbins, z, cosmo, ph=FAKESPECTRA, images="fs", axis=1, kfine=0.05, near=20.0):
    """'Exact' tau on fake_spectra's pixels: per particle, K(q) integrated with GL nodes spaced <= kfine*b in velocity,
    each node's Voigt profile (wofz) evaluated at the particle's own velocity + Hubble offset, averaged exactly over each
    pixel (GL, sub-intervals <= b/4).  images='fs': fake_spectra's half-box window around the particle's pixel;
    images='all': sum of box images k = -3..3 (true periodic sum).  Far from the kernel (|du| > near*b + kernel) a
    16-node kernel quadrature is used (integrand smooth there)."""
    velfac, _, _ = fs_velfac(z, cosmo)
    vbox = box * velfac
    dvb = vbox / nbins
    d = derived(ph)
    P = particle_arrays(parts, box, axis)
    tau = np.zeros(nbins)

    def pix_nodes(seglen, order):
        nseg = max(1, int(math.ceil(dvb / seglen)))
        xg, wg = _GL[order]
        e = np.linspace(0, dvb, nseg + 1)
        o = (0.5 * (e[1:] - e[:-1])[:, None] * xg + 0.5 * (e[1:] + e[:-1])[:, None]).ravel()
        w = (0.5 * (e[1:] - e[:-1])[:, None] * wg).ravel() / dvb
        return o, w

    def conv(du_rows, zk, wk, b, a):
        dd = du_rows.ravel()
        res = np.empty(dd.size)
        step = max(1, 4_000_000 // max(1, zk.size))
        for s0 in range(0, dd.size, step):
            xx = (dd[s0:s0 + step, None] - velfac * zk[None, :]) / b
            res[s0:s0 + step] = wofz(xx + 1j * a).real @ wk
        return res.reshape(du_rows.shape)

    for ppos, pvel, dr2, dens, temp, h in zip(P["ppos"], P["pvel"], P["dr2"], P["dens"], P["temp"], P["h"]):
        if h * h - dr2 <= 0:
            continue
        b = d["bfac"] * math.sqrt(temp)
        a = d["gamma_kms"] / b
        amp = d["sigma_v"] / math.sqrt(math.pi) / b * dens
        vel = velfac * ppos + pvel
        zf, wf = _kernel_nodes(dr2, h, kfine * b / velfac)        # near field: node spacing <= kfine*b
        zc, wc = _kernel_nodes(dr2, h, 1e30, order=4)            # far field: 4 GL nodes per kernel piece
        vchord = velfac * math.sqrt(h * h - dr2)
        on, wn = pix_nodes(0.25 * b, 8)                           # near: sub-intervals <= b/4, GL-8
        of, wf_ = pix_nodes(2.0 * b, 4)                           # far: sub-intervals <= 2b, GL-4
        zmax = math.floor(vel / dvb)
        zs = np.arange(zmax - nbins // 2, zmax + nbins // 2)
        shifts = [0.0] if images == "fs" else [k * vbox for k in range(-3, 4)]
        acc = np.zeros(len(zs))
        for sh in shifts:
            lo = zs * dvb - vel + sh                                   # pixel lower edge - u_particle
            dmin = np.where((lo <= 0) & (lo + dvb >= 0), 0.0, np.minimum(np.abs(lo), np.abs(lo + dvb)))
            nearm = dmin < near * b + vchord
            if nearm.any():
                acc[nearm] += conv(lo[nearm, None] + on[None, :], zf, wf, b, a) @ wn
            if (~nearm).any():
                acc[~nearm] += conv(lo[~nearm, None] + of[None, :], zc, wc, b, a) @ wf_
        np.add.at(tau, np.mod(zs, nbins), amp * acc)
    return tau


# =====================================================================================================================
# 6. real-space deposit -> skewer
# =====================================================================================================================
def deposit(parts, box, nx, axis=1, order=16):
    """Column of each particle in each real-space pixel j (edges j*box/nx), exact (GL on pieces split at pixel edges
    and the kernel breakpoint), periodic. Returns (Npj sparse as list of (p, j_array, N_array)), plus particle arrays."""
    P = particle_arrays(parts, box, axis)
    dx = box / nx
    xg, wg = _GL[order]
    out = []
    for p, (ppos, dr2, dens, h) in enumerate(zip(P["ppos"], P["dr2"], P["dens"], P["h"])):
        if h * h - dr2 <= 0:
            out.append((p, np.zeros(0, int), np.zeros(0)))
            continue
        zr = math.sqrt(h * h - dr2)
        lo, hi = ppos - zr, ppos + zr
        k0, k1 = math.floor(lo / dx), math.floor(hi / dx)
        edges = [lo, hi] + [k * dx for k in range(k0 + 1, k1 + 1)]
        zh = 0.25 * h * h - dr2
        if zh > 0:
            edges += [ppos - math.sqrt(zh), ppos + math.sqrt(zh)]
        edges.append(ppos)
        edges = np.array(sorted(set(e for e in edges if lo <= e <= hi)))
        a_, b_ = edges[:-1], edges[1:]
        xs = 0.5 * (b_ - a_)[:, None] * xg + 0.5 * (b_ + a_)[:, None]
        ws = 0.5 * (b_ - a_)[:, None] * wg
        seg = (sph_cubic_kernel(np.sqrt(dr2 + (xs - ppos) ** 2) / h) * ws).sum(axis=1) * dens
        jj = np.floor(0.5 * (a_ + b_) / dx).astype(int)
        jw = np.mod(jj, nx)
        uj, inv = np.unique(jw, return_inverse=True)
        Nj = np.zeros(len(uj))
        np.add.at(Nj, inv, seg)
        out.append((p, uj, Nj))
    return out, P


def skewer_from_particles(parts, box, nx, z, cosmo, axis=1, ph_for_dx=BROWSER, T_empty=1e4):
    """Real-space skewer in the browser's input format. n_HI_j = sum_p N_pj / dx_proper(browser Mpc);
    T_j, v_j = HI-column-weighted means of the particle values (the weighting fake_spectra's get_temp/get_velocity use,
    spectra.py:945-1013 — without its extra sqrt(a) on the velocity)."""
    dep, P = deposit(parts, box, nx, axis)
    N = np.zeros(nx)
    NT = np.zeros(nx)
    Nv = np.zeros(nx)
    Nv2 = np.zeros(nx)
    for p, jj, Nj in dep:
        N[jj] += Nj
        NT[jj] += Nj * P["temp"][p]
        Nv[jj] += Nj * P["pvel"][p]
        Nv2[jj] += Nj * P["pvel"][p] ** 2
    with np.errstate(invalid="ignore", divide="ignore"):
        Ns = np.where(N > 0, N, 1)
        T = np.where(N > 0, NT / Ns, T_empty)
        v = np.where(N > 0, Nv / Ns, 0.0)
        sigv = np.sqrt(np.maximum(np.where(N > 0, Nv2 / Ns - v * v, 0.0), 0.0))
    a = 1 / (1 + z)
    dx_mpch = box / nx / 1000.0
    dx_proper_cm = dx_mpch * a / cosmo["h"] * ph_for_dx["Mpc_cm"]
    x = (np.arange(nx) + 0.5) * dx_mpch
    return dict(z=z, cosmo=dict(cosmo), dx_mpch=dx_mpch, x=x, nHI=N / dx_proper_cm, T=T, v=v, sigv=sigv), dep, P


def cells_with_sigv(sk, ph=BROWSER):
    """Candidate browser extension: per-pixel HI-weighted LOS velocity dispersion sigv added to b in quadrature as
    b^2 = 2kT/m + 2 sigv^2 (i.e. lyaphys.js dopplerB(T, {bTurb: sqrt(2)*sigv})): Gaussian moment-matching of the
    velocity mixture inside a pixel."""
    c = cells_from_skewer(sk, ph)
    c["b"] = np.sqrt(c["b"] ** 2 + 2.0 * np.asarray(sk["sigv"]) ** 2)
    return c


def per_particle_cells(dep, P, box, nx, z, cosmo, ph=BROWSER):
    """Cells without per-pixel velocity/temperature averaging: every (particle, pixel) pair is its own cell at the
    pixel's Hubble velocity + the particle's own v, with the particle's own b."""
    Hpm = hubble_per_mpch(z, cosmo)
    dx_mpch = box / nx / 1000.0
    u, N, b = [], [], []
    for p, jj, Nj in dep:
        xj = (jj + 0.5) * dx_mpch
        u.append(Hpm * xj + P["pvel"][p])
        N.append(Nj)
        b.append(np.full(len(jj), float(dopplerB(P["temp"][p], ph))))
    return dict(u=np.concatenate(u), N=np.concatenate(N), b=np.concatenate(b))


# =====================================================================================================================
# 7. metrics
# =====================================================================================================================
def metrics(tauA, tauB, du, centres=None, bref=None, period=None):
    """A = candidate, B = baseline. Returns JSON-serialisable dict."""
    tauA = np.asarray(tauA, float)
    tauB = np.asarray(tauB, float)
    FA, FB = np.exp(-tauA), np.exp(-tauB)
    n = len(tauB)
    u = (np.arange(n) + 0.5) * du
    out = {}
    tmax = tauB.max()
    core = tauB >= 0.1 * tmax
    sig = tauB >= 1e-3
    rel = np.abs(tauA - tauB) / np.where(tauB > 0, tauB, np.inf)
    out["tau_max_baseline"] = float(tmax)
    out["max_rel_tau_core"] = float(rel[core].max()) if core.any() else 0.0
    out["max_rel_tau_tau_gt_1e-3"] = float(rel[sig].max()) if sig.any() else 0.0
    out["max_abs_dtau"] = float(np.abs(tauA - tauB).max())
    i = int(np.argmax(np.abs(FA - FB)))
    out["max_abs_dF"] = float(abs(FA[i] - FB[i]))
    out["u_at_max_dF"] = float(u[i])
    out["F_baseline_at_max_dF"] = float(FB[i])
    if centres is not None and len(centres):
        c = np.asarray(centres, float)
        dd = u[i] - c
        if period:
            dd = dd - period * np.round(dd / period)
        k = int(np.argmin(np.abs(dd)))
        out["offset_from_nearest_line_kms"] = float(dd[k])
        if bref:
            out["offset_in_b"] = float(dd[k] / bref)
    out["mean_F_baseline"] = float(FB.mean())
    out["d_mean_F"] = float(FA.mean() - FB.mean())
    EWB = float(np.sum(1 - FB) * du)
    EWA = float(np.sum(1 - FA) * du)
    out["EW_baseline_kms"] = EWB
    out["d_EW_kms"] = EWA - EWB
    out["rel_d_EW"] = (EWA - EWB) / EWB if EWB > 0 else 0.0
    return out
