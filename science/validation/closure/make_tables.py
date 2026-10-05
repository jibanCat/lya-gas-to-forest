"""make_tables.py — print the markdown tables used in RESULTS.md from metrics.json (+ js_vs_port.json, mocksnap.json).
    python3 science/validation/closure/make_tables.py > science/validation/closure/TABLES.md
"""
import json
import os

import numpy as np

D = os.path.dirname(os.path.abspath(__file__))
M = json.load(open(os.path.join(D, "metrics.json")))
C = M["cases"]
JS = json.load(open(os.path.join(D, "js_vs_port.json"))) if os.path.exists(os.path.join(D, "js_vs_port.json")) else {}


def e(x, p=1):
    if x is None:
        return "—"
    if x == 0:
        return "0"
    return f"{x:.{p}e}".replace("e-0", "e-").replace("e+0", "e+")


def grp(name):
    return name[:3] if name.startswith("C10") else name[:2]


def agg(names, getter, how=max):
    vals = [getter(C[n]) for n in names]
    return how(vals)


print("## Headline: port (lyaphys.js default) vs fake_spectra, and both vs the exact reference\n")
print("| case | description | max rel τ (core) | max\\|ΔF\\| | Δ⟨F⟩ | ΔEW/EW | FS−REF max\\|ΔF\\| | port−REF max\\|ΔF\\| | JS−port max rel τ |")
print("|---|---|---|---|---|---|---|---|---|")
for n, r in C.items():
    h = r["headline_port_vs_FS"]
    js = JS.get(n, {}).get("max_rel_tau_js_vs_port")
    print(f"| {n} | {r['desc'][:70]} | {e(h['max_rel_tau_core'])} | {e(h['max_abs_dF'])} | {e(h['d_mean_F'])} | "
          f"{e(h['rel_d_EW'])} | {e(r['fs_internal']['FS_vs_REF']['max_abs_dF'])} | {e(r['port_vs_REF']['max_abs_dF'])} | "
          f"{e(js) if js is not None else 'n/e'} |")

print("\n## One-at-a-time toggles from the port default (max|ΔF| over the cases in each group; [ΔEW/EW] of that case)\n")
groups = {}
for n in C:
    groups.setdefault(grp(n), []).append(n)
def norm(k):
    return k.split("(nx=")[0] + "(nx=nbins -> finer, point)" if k.startswith("real-space pixelisation") else k


for n in C:
    C[n]["one_at_a_time_from_port"] = {norm(k): v for k, v in C[n]["one_at_a_time_from_port"].items()}
srcs = list(next(iter(C.values()))["one_at_a_time_from_port"].keys())
print("| source | " + " | ".join(groups) + " |")
print("|---|" + "---|" * len(groups))
for s in srcs:
    cells = []
    for g, names in groups.items():
        best = max(names, key=lambda n: C[n]["one_at_a_time_from_port"][s]["max_abs_dF"])
        m = C[best]["one_at_a_time_from_port"][s]
        cells.append(f"{e(m['max_abs_dF'])} [{e(m['rel_d_EW'])}]")
    print(f"| {s} | " + " | ".join(cells) + " |")

print("\n## fake_spectra's own numerical error vs the exact reference (max|ΔF| over group [ΔEW/EW])\n")
fs_srcs = ["FS_vs_REF", "kernel_quadrature_NGRID8_vs_256", "kernel_quadrature_NGRID8_vs_32", "pixel_quadrature_fs_vs_exact",
           "tautail_1e-7_vs_0", "half_box_window_vs_all_images(REF)"]
print("| source | " + " | ".join(groups) + " |")
print("|---|" + "---|" * len(groups))
for s in fs_srcs:
    cells = []
    for g, names in groups.items():
        have = [n for n in names if s in C[n]["fs_internal"]]
        if not have:
            cells.append("—")
            continue
        best = max(have, key=lambda n: C[n]["fs_internal"][s]["max_abs_dF"])
        m = C[best]["fs_internal"][s]
        cells.append(f"{e(m['max_abs_dF'])} [{e(m['rel_d_EW'])}]")
    print(f"| {s} | " + " | ".join(cells) + " |")

print("\n## Cumulative ladder port → reference (max|ΔF| per step) for representative cases\n")
rep = [n for n in ["C1b", "C1c", "C2a", "C3c", "C4a", "C4c", "C5a", "C6a", "C6c", "C8b", "C9s0", "C10s0"] if n in C]
labels = ["L1 +FS constants", "L2 +wofz", "L3 +no truncation", "L4 +per-particle v,T", "L5 +finer real-space pixels",
          "L6 +exact pixel average", "residual vs REF (last step vs exact reference)"]
print("| step | " + " | ".join(rep) + " |")
print("|---|" + "---|" * len(rep))
for i, lab in enumerate(labels):
    row = []
    for n in rep:
        ks = list(C[n]["ladder"].keys())
        if lab.startswith("residual"):
            k = [k for k in ks if "REF" in k]
        else:
            k = [k for k in ks if k.startswith(lab[:2] + " ")]
        row.append(e(C[n]["ladder"][k[0]]["max_abs_dF"]) if k else "n/a")
    print(f"| {lab} | " + " | ".join(row) + " |")
print("\n(Forest cases C9/C10 stop at L4; their residual is L4 vs REF, i.e. native-resolution pixelisation + point sampling.)")

print("\n## Practical browser configurations (browser constants) vs fake_spectra: max|ΔF| [ΔEW/EW] (worst case in group)\n")
def normk(k):
    return "K8 adaptive oversampling (H dx <= b_min/2), exact pixel average" if k.startswith("K8") else k


for n in C:
    C[n]["configurations_vs_FS"] = {normk(k): v for k, v in C[n]["configurations_vs_FS"].items()}
confs = list(next(iter(C.values()))["configurations_vs_FS"].keys())
print("| configuration | " + " | ".join(groups) + " |")
print("|---|" + "---|" * len(groups))
for s in confs:
    cells = []
    for g, names in groups.items():
        best = max(names, key=lambda n: C[n]["configurations_vs_FS"][s]["max_abs_dF"])
        m = C[best]["configurations_vs_FS"][s]
        cells.append(f"{e(m['max_abs_dF'])} [{e(m['rel_d_EW'])}]")
    print(f"| {s} | " + " | ".join(cells) + " |")
cells = []
for g, names in groups.items():
    best = max(names, key=lambda n: C[n]["configurations_vs_FS_constants_aligned_floor"]["max_abs_dF"])
    m = C[best]["configurations_vs_FS_constants_aligned_floor"]
    cells.append(f"{e(m['max_abs_dF'])} [{e(m['rel_d_EW'])}]")
print("| floor: K8 with FS constants + wofz + no cut | " + " | ".join(cells) + " |")

for fam in [k for k in M["summary"] if k.startswith("forest_")]:
    S = M["summary"][fam]
    print(f"\n## {fam}: mean flux and P1D band ratios ({len(S['sightlines'])} sightlines)\n")
    print("| tau set | ⟨F⟩ | P1D/P1D_FS−1, k∈(0.001,0.01] | (0.01,0.02] | (0.02,0.05] | (0.05,0.1] s/km | same, both rescaled to ⟨F⟩=0.68: (0.001,0.01] | (0.01,0.02] | (0.02,0.05] | (0.05,0.1] |")
    print("|---|---|---|---|---|---|---|---|---|---|")
    print(f"| tau_fs | {S['mean_F']['tau_fs']:.5f} | | | | | | | | |")
    for k, rows in S["p1d_band_ratios"].items():
        key = k.replace("_over_fs", "")
        a = " | ".join(f"{r['ratio_minus1']:+.4f}" for r in rows)
        b = " | ".join(f"{r['ratio_minus1_both_rescaled_to_F068']:+.4f}" for r in rows)
        print(f"| {key} | {S['mean_F'][key]:.5f} | {a} | {b} |")

pf = [(n, C[n]) for n in C if "pixel_flux_average_vs_exp_mean_tau" in C[n]]
if pf:
    print("\n## Coarse pixels: pixel-averaged τ (fake_spectra) vs pixel-averaged flux (what a detector records)\n")
    print("| case | FS exp(−⟨τ⟩) vs ⟨e^{−τ}⟩: max\\|ΔF\\| | ΔEW/EW | port vs ⟨e^{−τ}⟩: max\\|ΔF\\| | ΔEW/EW |")
    print("|---|---|---|---|---|")
    for n, r in pf:
        a = r["pixel_flux_average_vs_exp_mean_tau"]["metrics"]
        b = r["pixel_flux_average_vs_port"]
        print(f"| {n} | {e(a['max_abs_dF'])} | {e(a['rel_d_EW'])} | {e(b['max_abs_dF'])} | {e(b['rel_d_EW'])} |")
