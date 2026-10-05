"""DISPOSABLE teaching data — a 3D Zel'dovich toy volume for the canonical prototype (SCI-SIM-TOY-001).

Not a simulation. It is a declared stand-in for a fake_spectra skewer and its surroundings:
  - Gaussian random displacement field, P(k) ∝ k^n exp(-k² R²), Zel'dovich move, CIC deposit;
  - linear-theory peculiar velocities v = f a H ψ with f = Ω_m(z)^0.55 (no free velocity scaling);
  - power-law temperature–density relation T = T0 Δ^(γ-1);
  - neutral hydrogen in photoionisation equilibrium, highly ionised limit:
        n_HI = α_A(T) n_e n_H / Γ_HI,  α_A = 4.2e-13 (T/1e4)^-0.7 cm³/s,  n_e = 1.158 n_H;
  - n̄_H(z) from Ω_b h² and Y_p.  Γ_HI is then tuned so <F> = 0.68 at z = 3 (the tuned value is ~3× measured: declared).
Cosmology: Planck 2018 (TT,TE,EE+lowE+lensing; REF-PLANCK18 Table 2), so every number quoted on screen is Planck 2018.
Every number here is recorded in science/SCIENCE_LEDGER.yaml (SCI-SIM-TOY-001, SCI-ION-001, SCI-CTX-*).

Outputs (next to this file, science/data/toy/ — the canonical teaching data read by the app, the prototype and the tests):
  slab.json   : uint8 log10 Δ on a sub-volume around the chosen sightline (for the 3D opener)
  skewer.json : the sightline on 1024 real-space pixels: x, Δ, T, v_pec, n_HI  (the browser recomputes τ),
                plus the producer's own τ on 2048 velocity pixels (exact Voigt via scipy wofz) for the reference view
"""
import base64, json, os, time
import numpy as np
from scipy.special import wofz

t0 = time.time()
rng = np.random.default_rng(31415)
N = 256                  # grid / particles per side
L = 20.0                 # comoving Mpc/h
DX = L / N
z = 3.0; a = 1 / (1 + z)
Om, OL, h, Obh2, Yp = 0.3153, 0.6847, 0.6736, 0.02237, 0.2454     # Planck 2018 (CONST-COSMO-PLANCK18)
E = np.sqrt(Om * (1 + z) ** 3 + OL)
HUB = 100 * E / (1 + z)                     # km/s per comoving Mpc/h  (= a H / h)
f_growth = (Om * (1 + z) ** 3 / E ** 2) ** 0.55
T0, GAMMA_TD = 1.3e4, 1.5

k1 = 2 * np.pi * np.fft.fftfreq(N, d=DX)
kz1 = 2 * np.pi * np.fft.rfftfreq(N, d=DX)
KX, KY, KZ = np.meshgrid(k1, k1, kz1, indexing="ij")
K2 = KX ** 2 + KY ** 2 + KZ ** 2
K2[0, 0, 0] = 1.0
R_s, n_s = 0.075, -2.0
Pk = K2 ** (n_s / 2) * np.exp(-K2 * R_s ** 2)
Pk[0, 0, 0] = 0
white = np.fft.rfftn(rng.normal(size=(N, N, N)))
delta_k = white * np.sqrt(Pk)
del white
psi = []
for Kc in (KX, KY, KZ):
    psi.append(np.fft.irfftn(1j * Kc * delta_k / K2, s=(N, N, N)).astype(np.float32))
del delta_k
rms = np.sqrt(np.mean(psi[0] ** 2 + psi[1] ** 2 + psi[2] ** 2) / 3)
PSI_RMS = 0.36                               # comoving Mpc/h, per component: just past first shell crossing at this smoothing
psi = [p * (PSI_RMS / rms) for p in psi]
print(f"displacements ready {time.time()-t0:.1f}s; v_rms per component = {f_growth*HUB*PSI_RMS:.1f} km/s")

q = (np.arange(N) + 0.5) * DX
QX, QY, QZ = np.meshgrid(q, q, q, indexing="ij")
pos = [((Qc + p) % L).ravel() for Qc, p in zip((QX, QY, QZ), psi)]
vx = (f_growth * HUB * psi[0]).ravel()          # LOS = x axis; v_pec in km/s, + = away from observer (toward +x)
del QX, QY, QZ, psi

def cic(pos, w):
    g = [p / DX - 0.5 for p in pos]
    i = [np.floor(gi).astype(np.int64) for gi in g]
    f = [gi - ii for gi, ii in zip(g, i)]
    out = np.zeros(N * N * N)
    for dx_ in (0, 1):
        wx = f[0] if dx_ else 1 - f[0]; ix = (i[0] + dx_) % N
        for dy_ in (0, 1):
            wy = f[1] if dy_ else 1 - f[1]; iy = (i[1] + dy_) % N
            for dz_ in (0, 1):
                wz = f[2] if dz_ else 1 - f[2]; iz = (i[2] + dz_) % N
                out += np.bincount((ix * N + iy) * N + iz, weights=w * wx * wy * wz, minlength=N ** 3)
    return out.reshape(N, N, N)

mass = cic(pos, np.ones_like(vx))
mom = cic(pos, vx)
print(f"deposit {time.time()-t0:.1f}s")
def smooth(f, sig):
    fk = np.fft.rfftn(f) * np.exp(-0.5 * K2 * (sig * DX) ** 2)
    return np.fft.irfftn(fk, s=(N, N, N), axes=(0, 1, 2))
ms = smooth(mass, 0.8); vs = smooth(mom, 0.8) / np.maximum(ms, 1e-3)
dens = np.maximum(ms / ms.mean(), 0.03)
del mass, mom, ms
T = np.minimum(T0 * dens ** (GAMMA_TD - 1), 2e5)
print(f"Δ: min {dens.min():.3f} median {np.median(dens):.3f} max {dens.max():.1f}  frac(Δ<1) {np.mean(dens<1):.2f}")

# physical neutral hydrogen
m_H = 1.6735328e-24; rho_crit_h2 = 1.87834e-29          # g cm^-3 (ρ_crit / h²)
nH_bar = (1 - Yp) * Obh2 * rho_crit_h2 * (1 + z) ** 3 / m_H
ne_over_nH = 1 + 2 * Yp / (4 * (1 - Yp))                  # H II + He III
def alphaA(T): return 4.2e-13 * (T / 1e4) ** -0.7
print(f"mean n_H(z=3) = {nH_bar:.3e} cm^-3; n_e/n_H = {ne_over_nH:.3f}")

# --- choose a sightline (LOS along x): a forest-like row with a dense structure group in its middle third
def sightline(iy, iz, gamma12):
    D = dens[:, iy, iz]; Tl = T[:, iy, iz]; vl = vs[:, iy, iz]
    nH = nH_bar * D
    nHI = alphaA(Tl) * ne_over_nH * nH * nH / (gamma12 * 1e-12)
    return D, Tl, vl, nHI
def tau_of(D, Tl, vl, nHI, nu=2048):
    dxp = DX * a / h * 3.0856775814913673e24
    Ncol = nHI * dxp; b = np.sqrt(2 * 1.380649e-16 * Tl / m_H) / 1e5
    u = HUB * (np.arange(N) + 0.5) * DX + vl
    ug = np.linspace(0, HUB * L, nu, endpoint=False)
    sig = 2.6540e-2 * 0.4164 * 1215.6701e-8 / 1e5
    tau = np.zeros(nu)
    for j in range(N):
        d = ug - u[j]; d -= HUB * L * np.round(d / (HUB * L))
        tau += Ncol[j] * sig / (np.sqrt(np.pi) * b[j]) * np.exp(-(d / b[j]) ** 2)
    return ug, tau

NS = 1024
xs = (np.arange(NS) + 0.5) * L / NS
def interp_line(arr):
    xp = (np.arange(N) + 0.5) * DX
    return np.interp(xs, np.concatenate([[xp[-1] - L], xp, [xp[0] + L]]), np.concatenate([[arr[-1]], arr, [arr[0]]]))
DXP = (L / NS) * a / h * 3.0856775814913673e24
def decompose(Ds, Ts, vls, nHIs, span=4.4):
    """Teaching decomposition (SCI-REP-003): best 4.4 Mpc/h window with three n_HI peaks; each peak region summarised
    as an HI-weighted parcel (x, σx, N, T, v, dv/dx). Score favours a genuine blend/reversal from the toy's own velocities."""
    Nc = nHIs * DXP; Nsm = np.convolve(Nc, np.ones(9) / 9, mode='same'); nwin = int(round(span / (L / NS)))
    best = None
    for s0 in range(0, NS - nwin, 16):
        seg = Nsm[s0:s0 + nwin]
        pk = [i for i in range(3, nwin - 3) if seg[i] >= seg[i - 1] and seg[i] > seg[i + 1] and seg[i] > 0.01 * Nsm.max()]
        pk = sorted(pk, key=lambda i: -seg[i]); top = []
        for i in pk:
            if all(abs(i - j) * L / NS > 0.6 for j in top): top.append(i)
            if len(top) == 3: break
        if len(top) < 3: continue
        top.sort()
        if top[0] * L / NS < 0.4 or (nwin - top[2]) * L / NS < 0.4: continue
        bounds = [0, (top[0] + top[1]) // 2, (top[1] + top[2]) // 2, nwin]
        parcels = []
        for k in range(3):
            sl = slice(s0 + bounds[k], s0 + bounds[k + 1]); w = Nc[sl]; xx = xs[sl] - xs[s0] + L / NS / 2
            Ntot = w.sum(); xc = (w * xx).sum() / Ntot; sx = max(0.05, np.sqrt((w * (xx - xc) ** 2).sum() / Ntot))
            Tm = (w * Ts[sl]).sum() / Ntot; vm = (w * vls[sl]).sum() / Ntot
            dvdx = (w * (xx - xc) * vls[sl]).sum() / max(1e-30, (w * (xx - xc) ** 2).sum())
            b = np.sqrt(2 * 1.380649e-16 * Tm / m_H) / 1e5
            parcels.append(dict(x=xc, sx=sx, N=Ntot, T=Tm, v=vm, dvdx=float(np.clip(dvdx, -150, 150)), b=b,
                                tau0=Ntot * 1.3434681e-12 / (np.sqrt(np.pi) * b), u=HUB * xc + vm))
        t0 = [p_['tau0'] for p_ in parcels]
        if max(t0) > 15 or min(t0) < 0.3: continue
        blend = max(1 - (parcels[j]['u'] - parcels[i]['u']) / (HUB * (parcels[j]['x'] - parcels[i]['x'])) for i in range(3) for j in range(i + 1, 3))
        score = min(p_['N'] for p_ in parcels) / max(p_['N'] for p_ in parcels) + 2.0 * blend
        if best is None or score > best[0]: best = (score, s0, parcels, blend)
    return best

best = None
cands = rng.integers(0, N, size=(500, 2))
for (iy, iz) in cands:
    D, Tl, vl, nHI = sightline(iy, iz, 1.0)
    mid = slice(N // 3, 2 * N // 3)
    peaks = np.sum((D[1:-1] > D[:-2]) & (D[1:-1] > D[2:]) & (D[1:-1] > 2.0))
    forest = np.log(D[mid]).std() + 0.15 * min(peaks, 12) - 0.5 * abs(np.mean(D < 1) - 0.7)
    Ds_, Ts_, vs__ = interp_line(D), interp_line(Tl), interp_line(vl)
    nHI_ = alphaA(Ts_) * ne_over_nH * (nH_bar * Ds_) ** 2 / 2.0e-12
    dec = decompose(Ds_, Ts_, vs__, nHI_)
    if dec is None: continue
    score = forest + 1.5 * min(dec[3], 1.2)
    if best is None or score > best[0]: best = (score, iy, iz, dec[3])
print(f"best sightline blend factor {best[3]:.2f} (1 = two parcels land at the same u; >1 = order reversed)")
_, IY, IZ, _ = best
# tune Γ so <F> ≈ 0.68 on this sightline (z = 3: Becker+2013 Table 2 bins 0.697 / 0.667 — ledger SCI-CTX-003)
D, Tl, vl, nHI1 = sightline(IY, IZ, 1.0)
ug, tau1 = tau_of(D, Tl, vl, nHI1)
lo, hi = 0.05, 20.0
for _ in range(60):
    m = np.sqrt(lo * hi)
    if np.mean(np.exp(-tau1 / m)) > 0.68: hi = m
    else: lo = m
GAMMA12 = np.sqrt(lo * hi)
print(f"sightline iy={IY} iz={IZ}; Γ_HI = {GAMMA12:.3f}e-12 s^-1 gives <F> = {np.mean(np.exp(-tau1/GAMMA12)):.3f}")

# --- outputs
OUT = os.path.dirname(os.path.abspath(__file__))
Ds, Ts, vs_ = interp_line(D), interp_line(Tl), interp_line(vl)
nHIs = alphaA(Ts) * ne_over_nH * (nH_bar * Ds) ** 2 / (GAMMA12 * 1e-12)
dec = decompose(Ds, Ts, vs_, nHIs)
_, S0, PARCELS, BLEND = dec
print(f"teaching window at x0 = {xs[S0] - L/NS/2:.2f} Mpc/h; blend factor {BLEND:.2f}; parcels:")
for p_ in PARCELS: print("   x %.2f sx %.2f logN %.2f T %.0f v %+.1f dv/dx %+.0f tau0 %.2f u %.1f" % (p_['x'], p_['sx'], np.log10(p_['N']), p_['T'], p_['v'], p_['dvdx'], p_['tau0'], p_['u']))
# the generating code's own τ (an independent reference view): exact Voigt (scipy wofz), point-sampled at velocity-pixel centres,
# nearest periodic image — independent of the browser's code path (lyaphys.js)
def tau_reference(nu=2048):
    dxp = (L / NS) * a / h * 3.0856775814913673e24
    Ncol = nHIs * dxp; b = np.sqrt(2 * 1.380649e-16 * Ts / m_H) / 1e5
    u = HUB * xs + vs_; per = HUB * L
    ug = (np.arange(nu) + 0.0) * per / nu
    sig = 2.6540e-2 * 0.4164 * 1215.6701e-8 / 1e5                     # σ_v = (πe²/m_e c) f λ  [cm² km/s]
    gam = 6.2649e8 * 1215.6701e-8 / (4 * np.pi) / 1e5                  # γ_v = Γλ/4π [km/s]
    tau = np.zeros(nu)
    for j in range(NS):
        d = ug - u[j]; d -= per * np.round(d / per)
        tau += Ncol[j] * sig / (np.sqrt(np.pi) * b[j]) * wofz(d / b[j] + 1j * gam / b[j]).real
    return ug, tau
UG_REF, TAU_REF = tau_reference()
print(f"reference τ: <F> = {np.mean(np.exp(-TAU_REF)):.4f}")
skewer = dict(
    note="DISPOSABLE toy Zel'dovich skewer (SCI-SIM-TOY-001). Real-space pixels; browser recomputes tau.",
    z=z, cosmo=dict(Om=Om, OL=OL, h=h, Obh2=Obh2, Yp=Yp), dx_mpch=L / NS, L_mpch=L, hubble_per_mpch=HUB,
    T0=T0, gamma_TD=GAMMA_TD, Gamma12=GAMMA12, nH_bar=nH_bar, f_growth=f_growth,
    iy=int(IY), iz=int(IZ), grid=N,
    window=dict(x0=float(xs[S0] - L / NS / 2), span=4.4, i0=int(S0), i1=int(S0 + round(4.4 / (L / NS))), blend=float(BLEND),
                note="teaching decomposition (SCI-REP-003): three HI-weighted parcels summarising peak regions"),
    parcels=[{k: float(v) for k, v in p_.items()} for p_ in PARCELS],
    x=xs.round(5).tolist(), Delta=Ds.round(5).tolist(), T=Ts.round(1).tolist(), v=vs_.round(3).tolist(),
    nHI=[float(f"{v:.5e}") for v in nHIs],
    reference=dict(du=float(UG_REF[1] - UG_REF[0]), n=len(UG_REF), tau=[float(f"{v:.5e}") for v in TAU_REF],
                   method="producer's own τ: exact Voigt (scipy.special.wofz), point sampling at u_k = k·du, nearest periodic image; "
                          "same real-space pixels as the browser; written by science/data/toy/zeldovich3d.py"),
)
json.dump(skewer, open(os.path.join(OUT, "skewer.json"), "w"))
# slab around the sightline: x full length (2×2×2 downsample), y, z ±4 Mpc/h
half = int(round(4.0 / DX))          # ±4 Mpc/h around the ray (Beat 0 needs real depth)
iy0, iz0 = IY - half, IZ - half
idx_y = (np.arange(2 * half) + iy0) % N; idx_z = (np.arange(2 * half) + iz0) % N
sub = dens[:, idx_y][:, :, idx_z]
sub = sub.reshape(N // 2, 2, 2 * half // 2, 2, 2 * half // 2, 2).mean(axis=(1, 3, 5))
lg = np.clip((np.log10(sub) + 0.7) / 2.2, 0, 1)
slab = dict(note="uint8 of (log10 Δ + 0.7)/2.2, axes [x, y, z]", nx=sub.shape[0], ny=sub.shape[1], nz=sub.shape[2],
            lx=L, ly=2 * half * DX, lz=2 * half * DX, ray_y=half * DX, ray_z=half * DX,
            data=base64.b64encode((lg * 255).astype(np.uint8).tobytes()).decode())
json.dump(slab, open(os.path.join(OUT, "slab.json"), "w"))
print(f"wrote skewer ({os.path.getsize(os.path.join(OUT, 'skewer.json'))/1e3:.0f} kB) and slab {sub.shape} "
      f"({os.path.getsize(os.path.join(OUT, 'slab.json'))/1e3:.0f} kB) in {time.time()-t0:.1f}s")
