#!/usr/bin/env python3
"""Build the human-readable provenance views from the single sources of truth, and check their integrity.

Sources (edit these):
  science/SCIENCE_LEDGER.yaml      claims, equations, conventions, simplifications, sources, oracles, validations
  science/REFERENCES.yaml          bibliographic records + verification log (from the reference audit)
  design/canonical/BEATS.yaml      the canonical beats = scene manifest (beat → science IDs, validations)
  science/validation/*/report.json measured results (written by the tests; never typed by hand)

Generated (do not edit):
  science/SCIENCE_PROVENANCE.md    per-claim provenance, with the scenes that use each claim (derived)
  science/validation/VALIDATION_SUMMARY.md
  design/canonical/CANONICAL_PATH.md
  design/canonical/VISUAL_PROVENANCE.md   which visual gestures assert which claims (BEATS.yaml visual_transforms)
  design/canonical/INTERACTION_PROVENANCE.md   which physical controls drive which claims (BEATS.yaml interactions)
  design/canonical/beats.json      embedded by the app build

Exit status 1 if any integrity check fails.
"""
import copy, json, os, re, sys
import yaml

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
P = lambda *a: os.path.join(ROOT, *a)
led = yaml.safe_load(open(P('science/SCIENCE_LEDGER.yaml')))
refs = yaml.safe_load(open(P('science/REFERENCES.yaml')))
beats = yaml.safe_load(open(P('design/canonical/BEATS.yaml')))
E = {e['id']: e for e in led['entries']}
R = {r['id']: r for r in refs['references']}
V = {v['id']: v for v in led['validations']}
O = {o['id']: o for o in led['oracles']}
errors, warns = [], []
STATUSES = {'verified', 'verified-numeric', 'source-pending', 'open'}
# reuses: a control that is the same instrument as another (Beat 6's push is Beat 7's, its hold is Beat 3's) takes its gesture,
# domain and teaching bounds from it — one control law, never a copy. gesture_extra may add parameters and a sentence; it may
# not change a reused parameter, and a stated domain must equal the source's. Resolved here, so beats.json carries the result.
_INT_ALL = {t.get('id'): t for b in beats['beats'] for t in (b.get('interactions') or [])}
for b in beats['beats']:
    for t in b.get('interactions') or []:
        rid = t.get('reuses')
        if not rid: continue
        where, src = f"beat {b['n']} {t.get('id')}", _INT_ALL.get(rid)
        if not src or src.get('reuses'): errors.append(f"{where}: reuses {rid}, which is not a primary control"); continue
        if 'gesture' in t: errors.append(f"{where}: reuses {rid} and must not restate its gesture (use gesture_extra)"); continue
        g, ex = copy.deepcopy(src.get('gesture') or {}), t.pop('gesture_extra', None) or {}
        for k, v in (ex.get('params') or {}).items():
            if k in (g.get('params') or {}): errors.append(f"{where}: gesture_extra may add parameters, not change {rid}'s {k}")
            else: g.setdefault('params', {})[k] = v
        if ex.get('mapping'): g['mapping'] = g.get('mapping', '') + '; ' + ex['mapping']
        t['gesture'] = g
        for k in ('domain', 'teaching_bounds'):
            if k in src:
                if k in t and t[k] != src[k]: errors.append(f"{where}: {k} differs from {rid}'s (a reused control has the same {k})")
                t.setdefault(k, copy.deepcopy(src[k]))

# ------------------------------------------------------------------ integrity
if len(E) != len(led['entries']): errors.append('duplicate entry ids in ledger')
# prose lists must hold text: an unquoted YAML "words (key: value)" silently becomes a mapping and prints as one
# and a comma inside a YAML flow list splits an item, leaving a stray ' behind (quote phrases inside items with "…")
for owner, d in [(e['id'], e) for e in led['entries']] + [(f"beat {b['n']}", b) for b in beats['beats']]:
    for k in ('simplifications', 'assumptions'):
        for x in d.get(k) or []:
            if not isinstance(x, str): errors.append(f"{owner}: an item of {k} is not text (quote it in the YAML): {x!r}")
            elif (len(re.findall(r"(?<![^\W_])'|'$", x)) + x.count('"')) % 2: errors.append(f"{owner}: an item of {k} has an unbalanced quote (did a comma split a YAML flow list?): {x!r}")
for e in led['entries']:
    if e.get('status') not in STATUSES: errors.append(f"{e['id']}: bad status {e.get('status')}")
    for kind in ('primary', 'secondary'):
        for s in ((e.get('sources') or {}).get(kind) or []):
            if s['ref'] not in R: errors.append(f"{e['id']}: unknown reference {s['ref']}")
            if s.get('verified') in ('pending', False, None): warns.append(f"{e['id']}: location not verified for {s['ref']}")
    for v in e.get('validations') or []:
        if v not in V: errors.append(f"{e['id']}: unknown validation {v}")
    _src = [x for k in ('primary', 'secondary') for x in ((e.get('sources') or {}).get(k) or [])]
    if e.get('status') == 'verified' and any(x.get('verified') not in (True, 'secondary') for x in _src): errors.append(f"{e['id']}: status verified but a source location is unverified")
    if e.get('status') in ('source-pending', 'verified-numeric') and _src and all(x.get('verified') is True for x in _src): warns.append(f"{e['id']}: every source location is verified — status could be promoted")
    orc = e.get('oracle') or {}
    if isinstance(orc, dict) and orc.get('ref') and orc['ref'] not in O: errors.append(f"{e['id']}: unknown oracle {orc['ref']}")
for o in led['oracles']:
    for r in o.get('refs') or []:
        if r not in R: errors.append(f"oracle {o['id']}: unknown reference {r}")
scenes_of = {k: [] for k in E}
for b in beats['beats']:
    for sid in b.get('science') or []:
        if sid not in E: errors.append(f"beat {b['n']}: unknown science id {sid}")
        else: scenes_of[sid].append(b)
    for vid in b.get('validation') or []:
        if vid not in V: errors.append(f"beat {b['n']}: unknown validation id {vid}")
    for eq in b.get('equations') or []:
        for sid in eq.get('ids') or []:
            if sid not in E: errors.append(f"beat {b['n']} equation: unknown science id {sid}")
            elif b not in scenes_of[sid]: errors.append(f"beat {b['n']}: equation cites {sid} but beat `science` list omits it")
unused = [k for k, v in scenes_of.items() if not v]
# visual transformations: every gesture that carries scientific meaning names its claims, what computes it and what draws it
VT, gestures_of = {}, {k: [] for k in E}
def _ref_ok(ref, where):
    if not ref: return
    f, _, sym = ref.partition('#')
    if not os.path.exists(P(f)): errors.append(f"{where}: file {f} does not exist"); return
    if sym and sym not in open(P(f)).read(): errors.append(f"{where}: symbol {sym} not found in {f}")
for b in beats['beats']:
    for t in b.get('visual_transforms') or []:
        where = f"beat {b['n']} {t.get('id')}"
        if not str(t.get('id', '')).startswith('VT-') or t['id'] in VT: errors.append(f"{where}: missing or duplicate id")
        VT[t.get('id')] = (b, t)
        for k in ('gesture', 'from', 'to', 'claims', 'computed_by', 'drawn_by'):
            if not t.get(k): errors.append(f"{where}: missing {k}")
        for sid in t.get('claims') or []:
            if sid not in E: errors.append(f"{where}: unknown claim {sid}"); continue
            gestures_of[sid].append((b, t))
            if b not in scenes_of[sid]: errors.append(f"{where}: claims {sid} but the beat's `science` list omits it")
        for vid in t.get('validation') or []:
            if vid not in V: errors.append(f"{where}: unknown validation {vid}")
        _ref_ok(t.get('computed_by'), where); _ref_ok(t.get('drawn_by'), where)
# interactions: every physical control names the variable it changes, its domain, the validated function that computes the
# consequence, the code that applies it, what it affects, the claims and validations; inspection-only controls say so
INT, controls_of = {}, {k: [] for k in E}
GESTURES = {'hold', 'drag', 'squeeze', 'trace', 'dwell', 'tap', 'set'}   # the gesture vocabulary (design/VISUAL_LANGUAGE.md §6); set: an explicit instrument setting
def gesture_text(gs): return re.sub(r'\{(\w+)\}', lambda m: f"{(gs.get('params') or {}).get(m.group(1))}", gs.get('mapping', ''))
for b in beats['beats']:
    for t in b.get('interactions') or []:
        where = f"beat {b['n']} {t.get('id')}"
        if not str(t.get('id', '')).startswith('INT-') or t['id'] in INT: errors.append(f"{where}: missing or duplicate id")
        INT[t.get('id')] = (b, t)
        for k in ('control', 'variable', 'physics', 'consequence', 'affects', 'claims'):
            if not t.get(k): errors.append(f"{where}: missing {k}")
        d = t.get('domain')
        if d is not None and not (isinstance(d, list) and len(d) == 2 and all(isinstance(v, (int, float)) for v in d) and d[0] < d[1]): errors.append(f"{where}: domain must be [low, high]")
        for sid in t.get('claims') or []:
            if sid not in E: errors.append(f"{where}: unknown claim {sid}"); continue
            controls_of[sid].append((b, t))
            if b not in scenes_of[sid]: errors.append(f"{where}: claims {sid} but the beat's `science` list omits it")
        for vid in t.get('validation') or []:
            if vid not in V: errors.append(f"{where}: unknown validation {vid}")
        if not t.get('validation') and not t.get('inspection'): errors.append(f"{where}: a control that changes physical state needs a validation")
        gs = t.get('gesture')   # how the hand maps onto the variable: a pedagogical control law, never a physical one
        if gs is None: errors.append(f"{where}: missing gesture (type, mapping, pedagogical: true)")
        else:
            if gs.get('type') not in GESTURES: errors.append(f"{where}: gesture type {gs.get('type')} not in {sorted(GESTURES)}")
            if gs.get('pedagogical') is not True: errors.append(f"{where}: gesture must declare pedagogical: true (a control law, not physics)")
            if not gs.get('mapping'): errors.append(f"{where}: gesture mapping missing")
            for name in re.findall(r'\{(\w+)\}', gs.get('mapping', '')):
                if name not in (gs.get('params') or {}): errors.append(f"{where}: gesture mapping names {{{name}}} but params lacks it")
        _ref_ok(t.get('physics'), where); _ref_ok(t.get('consequence'), where)
for e in led['entries']:   # implementation files must exist (production paths are checked, not assumed)
    im = e.get('implementation') or {}
    for f in ([im['file']] if isinstance(im.get('file'), str) else (im.get('file') or [])):
        if not os.path.exists(P(f)): errors.append(f"{e['id']}: implementation file {f} does not exist")

# ------------------------------------------------------------------ validation results (read, never typed)
def load_report(v):
    p = P(v['report']) if v.get('report') else None
    if not p or not os.path.exists(p): return None
    try: return json.load(open(p))
    except Exception: return None
def summarise(vid, rep):
    if rep is None: return ('missing', 'report not found')
    if vid == 'VAL-VOIGT-001':
        worst = max(r['max_rel_err'] for r in rep['regions'])
        return ('pass' if rep.get('pass') else 'FAIL', f"max relative error {worst:.1e} over {rep['n_points']} grid points (" + '; '.join(f"{r['region']}: {r['max_rel_err']:.1e}" for r in rep['regions']) + ')')
    if vid == 'VAL-MAP-001':
        dev = rep.get('linear_map_max_rel_dev_by_dx', {})
        d20 = dev.get('20', None)
        return ('pass' if rep.get('pass') else 'FAIL', f"{sum(c['pass'] for c in rep['checks'])}/{len(rep['checks'])} checks; linear map vs exact over 20 Mpc/h: {d20:.1e}" if d20 is not None else '')
    if vid in ('VAL-TAU-001', 'VAL-TOY-001', 'VAL-DEG-001'):
        s = f"{sum(c['pass'] for c in rep['checks'])}/{len(rep['checks'])} checks"
        if vid == 'VAL-TAU-001':
            pts = [c for c in rep['cases'] if c['mode'] == 'point']
            s += f"; point sampling max rel τ {max(c['max_rel_tau'] for c in pts):.1e}, max |ΔF| {max(c['max_abs_dF'] for c in pts):.1e}"
        if vid == 'VAL-TOY-001':
            xhi = next((c for c in rep['checks'] if c['name'].startswith('neutral fraction')), None)
            s += f"; Gauss vs Voigt max |ΔF| {rep['max_abs_dF_gauss_vs_voigt']:.1e}" + (f"; x_HI at mean density with the measured Γ_HI = {float(xhi['detail']):.2e}" if xhi else '') + f"; ⟨F⟩ = {rep['mean_flux']:.3f}, a calibration (Γ_HI tuned to {rep['gamma_ratio']:.1f}× measured to meet it)"
        if vid == 'VAL-DEG-001':
            s += f"; Δχ²(S/N=20): ii {rep['dchi2']['20']['ii']:.2f}, iii {rep['dchi2']['20']['iii']:.2f}; max |ΔF| vs an independent calculation {max(rep['max_abs_dF_vs_oracle'].values()):.1e}"
        return ('pass' if rep.get('pass') else 'FAIL', s)
    if vid == 'VAL-CLOSURE-FS':
        C = rep.get('cases') if isinstance(rep, dict) else None
        if not C: return ('in progress', 'see science/validation/closure/RESULTS.md')
        st, txt = closure_domain(rep, C)
        return (st, txt)
    if vid == 'VAL-RED-001':
        return ('pass' if rep.get('pass') else 'FAIL', f"{sum(c['ok'] for c in rep['checks'])}/{len(rep['checks'])} checks; χ(z) vs scipy max rel {rep['max_rel_chi']:.0e}; z(χ) inverse {rep['max_dz_inverse']:.0e}; frame conversions exact to {max(rep['max_rel_lambda'], 1e-16):.0e}; Lyα at z = 3 → {rep['lambda_obs_lya_z3']:.2f} Å")
    if vid == 'VAL-INV-001':
        return ('pass' if rep.get('pass') else 'FAIL', f"Σ of traced contributions vs the spectrum's τ over {rep['pixels']} pixels: max relative difference {rep['max_rel_closure']:.0e}; τ in cells under the {rep['thresholds']['cell_min_fraction']:.0%} display cut (kept in the ledger's “rest”): median {rep['omitted_fraction']['median']:.1%}, max {rep['omitted_fraction']['max']:.1%} of a pixel's τ")
    if vid == 'VAL-ORTH-001':
        sat = rep['flux_nonlinearity']
        return ('pass' if rep.get('pass') else 'FAIL', f"{sum(c['ok'] for c in rep['checks'])}/{len(rep['checks'])} checks over {len(rep['cases'])} one-variable changes (cells and τ, fine grid and the scene's grid): place and motion move the centre by aH·Δx and Δv (max error {rep['max_err']['centre_kms']:.0e} km/s) at fixed FWHM and area; temperature changes FWHM² by 4 ln2 Δ(b²) (max rel. error {rep['max_err']['fwhm2_rel']:.0e}) at fixed centre and area; amount scales τ exactly (max rel. {rep['max_err']['amount_rel']:.0e}) at fixed centre and FWHM. The width the scene prints is the drawn line's: heat alone b = {rep['base']['b_thermal_kms']:.1f} km/s and the parcel's size {rep['base']['b_size_kms']:.1f} km/s add in quadrature to the drawn {rep['base']['b_drawn_kms']:.1f} km/s (max rel. error {rep['max_err']['width_rel']:.0e}; peak {rep['max_err']['peak_rel']:.0e}). Flux is not linear (recorded): N_HI ×{sat['amount_factor']:g} gives τ area ×{sat['amount_factor']:g} but equivalent width ×{sat['W_ratio_amount']:.2f} (τ₀ = {sat['tau0_base']:.1f}); T ×{sat['T_factor']:g} at fixed N_HI changes it ×{sat['W_ratio_T']:.2f}")
    if vid == 'VAL-REND-001':
        c = rep['checks'][0]
        return ('pass' if rep.get('pass') else 'FAIL', f"Beat 10 ribbon read back from the canvas: max |T − e^(−τ)| {c['max_abs_dT']:.1e} over {c['columns']} columns (8-bit bound {c['quantisation_bound']:.1e}); mean {c['mean_abs_dT']:.1e}")
    if vid == 'VAL-TOY-002':
        return ('pass' if rep.get('pass') else 'FAIL', f"the app (Gaussian kernels, as drawn) vs the generating code's exact-Voigt τ: max |ΔF| {rep['max_abs_dF_gauss']:.1e}; the app with Voigt kernels {rep['max_abs_dF_voigt']:.1e}; ⟨F⟩ {rep['mean_F_browser']:.4f} vs {rep['mean_F_reference']:.4f}")
    return ('?', '')
# declared-domain closure: inside the domain the observational-equivalence tolerance applies;
# cases outside it are listed with their measured differences and the reason, never silently tolerated.
CLOSURE_TOL = dict(max_abs_dF=1e-2, abs_d_mean_F=1e-3, abs_rel_d_EW=1e-2, p1d_k005=1e-2, p1d_k01=2e-2)
CLOSURE_OUT = [(lambda k: k in ('C3c', 'C4c') or k.startswith('C10'), 'several velocities inside one real-space sampling element (unresolved velocity structure; C10 is a deliberately exaggerated 1D shell-crossing stress test)'),
               (lambda k: k.startswith('C6'), 'lines narrower than two velocity pixels (b < 2Δu); fixable by oversampling the skewer')]
CLOSURE_WORST = {}
def closure_domain(rep, C):
    rows, worst = [], dict(dF=0, dmF=0, dEW=0)
    out = {reason: [] for _, reason in CLOSURE_OUT}
    for k, c in C.items():
        reason = next((r for f, r in CLOSURE_OUT if f(k)), None)
        if reason: out[reason].append((k, c['headline_port_vs_FS']['max_abs_dF'])); continue
        # where fake_spectra's own error (vs the exact reference) exceeds half the tolerance, compare with the exact reference instead
        ref_limited = c['fs_internal']['FS_vs_REF']['max_abs_dF'] > CLOSURE_TOL['max_abs_dF'] / 2
        h = c['port_vs_REF'] if ref_limited else c['headline_port_vs_FS']
        worst['dF'] = max(worst['dF'], h['max_abs_dF']); worst['dmF'] = max(worst['dmF'], abs(h['d_mean_F'])); worst['dEW'] = max(worst['dEW'], abs(h['rel_d_EW']))
        if ref_limited: rows.append(k)
    p1 = rep['summary']['forest_C9']['p1d_band_ratios']['tau_port_over_fs']
    p005 = max(abs(r['ratio_minus1']) for r in p1 if r['k_hi_skm'] <= 0.05); p01 = max(abs(r['ratio_minus1']) for r in p1 if r['k_hi_skm'] <= 0.1)
    T = CLOSURE_TOL
    ok = worst['dF'] <= T['max_abs_dF'] and worst['dmF'] <= T['abs_d_mean_F'] and worst['dEW'] <= T['abs_rel_d_EW'] and p005 <= T['p1d_k005'] and p01 <= T['p1d_k01']
    jp = P('science/validation/closure/js_vs_port.json')
    code = max(v['max_rel_tau_js_vs_port'] for v in json.load(open(jp)).values()) if os.path.exists(jp) else float('nan')
    txt = (f"in domain (one velocity per sampling element, b ≥ 2Δu; {len(C) - sum(len(v) for v in out.values())} cases): max |ΔF| {worst['dF']:.1e}, |Δ⟨F⟩| {worst['dmF']:.1e}, |ΔEW/EW| {worst['dEW']:.1e}, "
           f"forest P1D {100*p005:.2f} % (k ≤ 0.05 s/km), {100*p01:.2f} % (k ≤ 0.1)" + (f"; {', '.join(rows)} compared with the exact reference (fake_spectra's own quadrature error exceeds half the tolerance)" if rows else '') +
           '. Outside the domain, stated not tolerated (max |ΔF| per test case, by case name): ' + '; '.join(f"{reason}: " + ', '.join(f'{k} {v:.2g}' for k, v in sorted(cs)) for reason, cs in out.items()) +
           f". The app's code vs its independent Python port: {code:.0e} in τ")
    CLOSURE_WORST.update(dF=worst['dF'], p01=p01)
    return ('pass (declared domain)' if ok else 'FAIL', txt)
VSUM = {vid: summarise(vid, load_report(v)) for vid, v in V.items()}

# ------------------------------------------------------------------ numbers in prose come from reports: {{VAL-ID:dotted.path:fmt}}
REPORTS = {vid: load_report(v) for vid, v in V.items()}
# numbers the ledger quotes from the closure study, recomputed from its own files (never typed): each names the cases it covers
def _mock_velocity():   # the export-path velocity check on a mock snapshot (SCI-SIM-003), read from its own record
    mk = json.load(open(P('science/validation/closure/mocksnap.json'))); r = [x for x in mk['get_velocity_over_vpec'] if x is not None]
    return {'mock_v_ratio': max(r), 'mock_v_ratio_min': min(r), 'mock_sqrt_a': mk['sqrt_a'], 'mock_a': mk['sqrt_a'] ** 2}
def closure_derived():
    m, vm = REPORTS.get('VAL-CLOSURE-FS'), json.load(open(P('science/validation/closure/validation_mode.json')))
    C = m['cases']; dom = closure_domain(m, C)
    colB = ['C1a', 'C1b', 'C1c', 'C1d', 'C3a', 'C3b', 'C5a', 'C5b', 'C7a', 'C7b', 'C8a', 'C8b']   # RESULTS.md §4 column B: b > Δu, one velocity per pixel, aligned pixels
    iso = ['C1a', 'C1b', 'C1c', 'C5a', 'C5b', 'C7a', 'C7b']                                          # isolated normal kernels
    mass = '  constants: H mass only (1.00794 m_p vs m_H)'
    return {'colB_max_dF': max(vm[k]['B_native_point_FSconst_wofz_nocut_vs_REF']['max_abs_dF'] for k in colB), 'domain_max_dF': CLOSURE_WORST['dF'], 'p1d_k01': CLOSURE_WORST['p01'],
            'b_mass_rel': m['b_1e4K_browser'] / m['b_1e4K_fs'] - 1, 'forest_mass_dF': max(C[k]['one_at_a_time_from_port'][mass]['max_abs_dF'] for k in C if k.startswith('C9')),
            'gamma_only_dF': max(C[k]['one_at_a_time_from_port']['  constants: Gamma only (6.265e8 vs 6.2649e8)']['max_abs_dF'] for k in C),
            'fs_quad_isolated_dF': max(C[k]['fs_internal']['FS_vs_REF']['max_abs_dF'] for k in iso), 'fs_quad_broad_cold_dF': C['C8b']['fs_internal']['FS_vs_REF']['max_abs_dF'],
            'forest_dF': max(C[k]['headline_port_vs_FS']['max_abs_dF'] for k in C if k.startswith('C9')), 'c10_max_dF': max(C[k]['headline_port_vs_FS']['max_abs_dF'] for k in C if k.startswith('C10')),
            **_mock_velocity()}
if REPORTS.get('VAL-CLOSURE-FS'): REPORTS['VAL-CLOSURE-FS']['derived'] = closure_derived()
# typed bounds the ledger states as prose, asserted against their reports (the build fails if a bound no longer holds or the wording drifts)
BOUNDS = [('SCI-VOIGT-002', 'claim', '< 10⁻⁴ (relative)', lambda: max(r['max_rel_err'] for r in REPORTS['VAL-VOIGT-001']['regions']), 1e-4)]
_raw = {e['id']: e for e in yaml.safe_load(open(P('science/SCIENCE_LEDGER.yaml')))['entries']}
for eid, field, phrase, measure, bound in BOUNDS:
    if phrase not in str(_raw[eid].get(field)): errors.append(f"{eid}: asserted bound '{phrase}' is no longer in its {field}")
    elif not measure() < bound: errors.append(f"{eid}: '{phrase}' no longer holds (measured {measure():.2e})")
_acc = re.compile(r'(?:≤|<|within|to|max\s*\|ΔF\|)\s*~?\d[\d.,]*\s*(?:×\s*10[⁻⁰-⁹¹²³⁴⁵⁶⁷⁸⁹]+|e-?\d+|%)', re.I)
_used = {sid for b in beats['beats'] for sid in (b.get('science') or [])}
for eid, e in _raw.items():   # no new typed accuracy numbers in public fields: they come from reports ({{…}}) or are asserted above
    if eid not in _used: continue
    for field in ('claim', 'validity', 'convention', 'assumptions', 'simplifications'):
        txt = re.sub(r'\{\{[^}]*\}\}', '', str(e.get(field) or ''))
        for mt in _acc.finditer(txt):
            ctx = txt[max(0, mt.start() - 60):mt.end() + 20]
            if re.search(r'match|error|accura|ΔF|differ|deviat|agree|reproduc|same as|in F\b', ctx, re.I) and not any(eid == b[0] and b[2] in txt for b in BOUNDS):
                errors.append(f"{eid} {field}: a typed accuracy number ('{mt.group(0)}') must come from a validation report or be asserted")
def _get(o, path):
    for k in path.split('.'): o = o[k] if isinstance(o, dict) else o[int(k)]
    return o
def fill(x):
    if isinstance(x, str):
        def sub(m):
            vid, path, fmt = m.group(1), m.group(2), m.group(3) or 'g'
            try: return format(_get(REPORTS[vid], path), fmt)
            except Exception: errors.append(f"placeholder {m.group(0)} could not be resolved"); return m.group(0)
        return re.sub(r'\{\{(VAL-[A-Z0-9-]+):([\w.]+)(?::([^}]+))?\}\}', sub, x)
    if isinstance(x, list): return [fill(v) for v in x]
    if isinstance(x, dict): return {k: fill(v) for k, v in x.items()}
    return x
beats = fill(beats)
led = fill(led); E = {e['id']: e for e in led['entries']}
for vid, (st, _) in VSUM.items():
    if st == 'FAIL': errors.append(f'{vid} failing')

# ------------------------------------------------------------------ writers
def cite(rid): r = R.get(rid, {}); return r.get('citation', rid)
def eqs_md(eqs): return '\n'.join(f"$$ {q['tex']} $$" + (f"  \n*{q['meaning']}*" if q.get('meaning') else '') for q in (eqs or []) if q.get('tex'))
STATUS_MARK = {'verified': '✓ verified', 'verified-numeric': '✓ numeric · source-location pending', 'source-pending': '○ source pending', 'open': '△ open'}
L = ['# Science provenance', '',
     '*GENERATED by `science/tools/build_provenance.py` from `SCIENCE_LEDGER.yaml`, `REFERENCES.yaml`, `design/canonical/BEATS.yaml` and the validation reports. Do not edit by hand.*', '',
     'Scenes using each claim are derived from the beat manifest; validation numbers are read from the reports.', '']
L += ['## Summary', '', '| id | claim | status | scenes | validation |', '|---|---|---|---|---|']
for e in led['entries']:
    sc = ', '.join(str(b['n']) for b in scenes_of[e['id']]) or '—'
    vs = ', '.join(f"{v} ({VSUM[v][0]})" for v in (e.get('validations') or [])) or '—'
    L.append(f"| [{e['id']}](#{e['id'].lower()}) | {e['title']} | {STATUS_MARK[e['status']]} | {sc} | {vs} |")
L += ['', f"Status counts: " + ', '.join(f"{k}: {sum(1 for e in led['entries'] if e['status']==k)}" for k in ['verified', 'verified-numeric', 'source-pending', 'open']), '']
L += ['## Numerical closure chains', '', '| claim | physical reference | oracle | browser implementation | tested range / criterion | measured | scenes |', '|---|---|---|---|---|---|---|']
for e in led['entries']:
    if not e.get('validations'): continue
    prim = '; '.join(f"{s['ref']} {s.get('location','')}" for s in ((e.get('sources') or {}).get('primary') or [])) or '—'
    orc = e.get('oracle') or {}; orc_s = orc.get('ref') or orc.get('detail') or orc.get('kind') or '—'
    impl = e.get('implementation') or {}; impl_s = (', '.join(impl.get('symbols') or []) + ' — ' + (impl['file'] if isinstance(impl.get('file'), str) else ', '.join(impl.get('file') or []))) if impl else '—'
    rng = '; '.join(V[v].get('criterion', '') for v in e['validations'])
    meas = '; '.join(f"{v}: {VSUM[v][1]}" for v in e['validations'])
    cells = [e['id'], prim, orc_s, impl_s, rng, meas, ', '.join(str(b['n']) for b in scenes_of[e['id']]) or '—']
    L.append('| ' + ' | '.join(str(c).replace('|', '\\|') for c in cells) + ' |')
L += ['']
for e in led['entries']:
    L += [f"## {e['id']}", '', f"**{e['title']}** — {STATUS_MARK[e['status']]} · domain: {e.get('domain','')}", '', f"**Claim.** {e['claim'].strip()}", '']
    if e.get('equations'): L += ['**Equations.**', '', eqs_md(e['equations']), '']
    for k, lab in [('convention', 'Convention'), ('teaching_representation', 'Teaching representation'), ('validity', 'Validity')]:
        if e.get(k): L += [f"**{lab}.** {str(e[k]).strip()}", '']
    if e.get('assumptions'): L += ['**Assumptions.** ' + '; '.join(e['assumptions']), '']
    if e.get('simplifications'): L += ['**Deliberate simplifications / exaggerations.**', ''] + [f"- {s}" for s in e['simplifications']] + ['']
    src = e.get('sources') or {}
    if src.get('primary') or src.get('secondary'):
        L += ['**Sources.**', '']
        for kind in ('primary', 'secondary'):
            for s in src.get(kind) or []:
                mark = '✓' if s.get('verified') is True else '✓ (via independent secondary transcriptions; original not read)' if s.get('verified') == 'secondary' else '○ (location unverified)'
                L.append(f"- {kind}: {cite(s['ref'])} — {s.get('location','')} {mark}")
        L.append('')
    if e.get('oracle'): o = e['oracle']; L += [f"**Oracle.** {(O[o['ref']]['implementation'] if o.get('ref') in O else '')} {o.get('detail','') or ''} ({o.get('kind','')})", '']
    if e.get('implementation'): im = e['implementation']; L += [f"**Implementation.** `{im['file'] if isinstance(im['file'], str) else ', '.join(im['file'])}` — {', '.join(im.get('symbols') or [])}", '']
    if e.get('validations'): L += ['**Validation.**', ''] + [f"- {v}: {V[v]['what']} — **{VSUM[v][0]}** · {VSUM[v][1]}" for v in e['validations']] + ['']
    sc = scenes_of[e['id']]
    L += ['**Scenes using this claim** (derived): ' + (', '.join(f"Beat {b['n']} · {b['title']}" for b in sc) or 'none in the canonical path'), '']
    if controls_of[e['id']]: L += ['**Interactive controls acting through this claim** (derived): ' + '; '.join(f"{t['id']} (Beat {b['n']}): {t['variable']}" for b, t in controls_of[e['id']]), '']
    if gestures_of[e['id']]: L += ['**Visual gestures asserting this claim** (derived): ' + '; '.join(f"{t['id']} (Beat {b['n']}): {t['gesture']}" for b, t in gestures_of[e['id']]), '']
    if e.get('notes'): L += [f"**Notes.** {e['notes'].strip()}", '']
open(P('science/SCIENCE_PROVENANCE.md'), 'w').write('\n'.join(L) + '\n')

# validation summary
VL = ['# Validation summary', '', '*GENERATED by `science/tools/build_provenance.py` from the report files. Re-run the tests, then this script.*', '',
      '```', 'python3 science/oracle/voigt_oracle.py && node science/tests/test_voigt.js', 'python3 science/oracle/mapping_oracle.py && node science/tests/test_mapping.js',
      'python3 science/oracle/tau_oracle.py && node science/tests/test_tau.js', 'node science/tests/test_toy.js', 'python3 science/oracle/degeneracy_oracle.py && node science/tests/test_degeneracy.js',
      'node science/tests/test_redshift.js && node science/tests/test_toy_reference.js', 'node science/tests/test_inverse.js   # reads design/canonical/beats.json (build first)',
      'node app/build.mjs && node app/smoke.mjs   # writes science/validation/render/report.json (VAL-REND-001)',
      'python3 science/tools/build_provenance.py', '```', '', '| id | what | criterion | result | measured |', '|---|---|---|---|---|']
esc = lambda t: str(t).replace('|', '\\|')
for vid, v in V.items(): VL.append(f"| {vid} | {esc(v['what'])} | {esc(v.get('criterion',''))} | **{VSUM[vid][0]}** | {esc(VSUM[vid][1])} |")
open(P('science/validation/VALIDATION_SUMMARY.md'), 'w').write('\n'.join(VL) + '\n')

# canonical path
CL = [f"# Canonical path: Beats 0–{beats['beats'][-1]['n']}", '', '*GENERATED by `science/tools/build_provenance.py` from `design/canonical/BEATS.yaml` (edit that file). Each beat is also a scene manifest: its science IDs and validations are checked against the ledger.*', '',
      f"Audience: {beats['audience']}.  ", f"Spine: {beats['spine']}.", '']
CL += ['| beat | title | science | validation |', '|---|---|---|---|']
for b in beats['beats']: CL.append(f"| {b['n']} | {b['title']} | {', '.join(b.get('science') or [])} | {', '.join(f'{v} ({VSUM[v][0]})' for v in (b.get('validation') or [])) or '—'} |")
CL += ['']
for b in beats['beats']:
    CL += [f"## Beat {b['n']} — {b['title']}", '', f"> {b['statement'].strip()}", '',
           f"- **Learning objective.** {b['objective']}", f"- **User action.** {b['action']}", f"- **Visible physical consequence.** {b['consequence']}"]
    if b.get('stages'):
        CL += ['- **Progressive reveal.** ' + ' → '.join(f"{st['label']}" + (f" ({st['text']})" if st.get('text') else '') for st in b['stages'])]
    if b.get('equations'):
        CL += ['- **Optional equations (\"show the physics\").**'] + [f"  - " + (f"$ {q['tex']} $ — " if q.get('tex') else '') + f"{q.get('note','')} ({', '.join(q.get('ids') or [])})" for q in b['equations']]
    CL += [f"- **Linked provenance.** " + ', '.join(f"{sid} ({E[sid]['title']}; {E[sid]['status']})" for sid in (b.get('science') or []))]
    if b.get('validation'): CL += [f"- **Validation.** " + '; '.join(f"{v}: {VSUM[v][0]}" for v in b['validation'])]
    CL += ['- **Deliberate simplifications.** ' + (' '.join(b.get('simplifications') or []) or 'none beyond the linked entries')]
    if b.get('micro'): CL += ['- **Microscope (\"why?\").** ' + '; '.join(m['ask'] for m in b['micro'])]
    if b.get('visual_transforms'): CL += ['- **Visual transformations.**'] + [f"  - {t['id']}: {t['gesture']} — {t['from']} → {t['to']} ({', '.join(t['claims'])})" for t in b['visual_transforms']]
    CL += ['']
open(P('design/canonical/CANONICAL_PATH.md'), 'w').write('\n'.join(CL) + '\n')
json.dump(beats, open(P('design/canonical/beats.json'), 'w'), ensure_ascii=False, indent=1)

# visual provenance: gesture → claim, and claim → gestures
VPL = ['# Visual provenance: which gestures assert which physics', '',
       '*GENERATED by `science/tools/build_provenance.py` from `design/canonical/BEATS.yaml` (`visual_transforms`) and the ledger. Every file and symbol named here is checked to exist.*', '',
       '| gesture | beat | from → to | claims | computed by | drawn by | validation |', '|---|---|---|---|---|---|---|']
for vid, (b, t) in VT.items():
    VPL.append('| ' + ' | '.join(esc(c) for c in [f"**{vid}** — {t['gesture']}", b['n'], f"{t['from']} → {t['to']}", ', '.join(t['claims']), f"`{t['computed_by']}`", f"`{t['drawn_by']}`",
               ', '.join(f"{v} ({VSUM[v][0]})" for v in (t.get('validation') or [])) or '—']) + ' |')
VPL += ['', '## Display choices and thresholds', '']
for vid, (b, t) in VT.items():
    if t.get('display') or t.get('thresholds') or t.get('omitted'):
        VPL += [f"- **{vid}.** " + ' '.join(x for x in [t.get('display', ''), ('Thresholds: ' + ', '.join(f"{k} = {v}" for k, v in t['thresholds'].items()) + '.') if t.get('thresholds') else '', t.get('omitted', '')] if x)]
VPL += ['', '## Claims → gestures', '', '| claim | gestures |', '|---|---|']
for sid, gs in gestures_of.items():
    if gs: VPL.append(f"| {sid} · {esc(E[sid]['title'])} | " + ', '.join(f"{t['id']} (Beat {b['n']})" for b, t in gs) + ' |')
open(P('design/canonical/VISUAL_PROVENANCE.md'), 'w').write('\n'.join(VPL) + '\n')

# interaction provenance: which physical controls drive which claims, through which validated code
IPL = ['# Interaction provenance: which controls change which physics', '',
       '*GENERATED by `science/tools/build_provenance.py` from `design/canonical/BEATS.yaml` (`interactions`) and the ledger. Every function and file named here is checked to exist; a control that changes physical state must name a validation.*', '',
       '| control | beat | variable · domain | physics (validated function) | applied by | affects | claims | validation |', '|---|---|---|---|---|---|---|---|']
for iid, (b, t) in INT.items():
    dom = f" · [{t['domain'][0]:g}, {t['domain'][1]:g}]" if t.get('domain') else ''
    IPL.append('| ' + ' | '.join(esc(c) for c in [f"**{iid}** — {t['control']}" + (' *(inspection only: changes no physical state)*' if t.get('inspection') else '') + (f" *(the same instrument as {t['reuses']}: its control law, domain and bounds)*" if t.get('reuses') else ''), b['n'], t['variable'] + dom,
               f"`{t['physics']}`", f"`{t['consequence']}`", ', '.join(t['affects']), ', '.join(t['claims']), ', '.join(f"{v} ({VSUM[v][0]})" for v in (t.get('validation') or [])) or '—']) + ' |')
IPL += ['', '## Gestures: how the hand maps onto each variable', '', '*Pedagogical control laws — how a gesture explores the physics. None of them is a physical law; changing one changes the teaching, not the science.*', '',
        '| control | gesture | mapping (control law) | metaphor, stated |', '|---|---|---|---|']
for iid, (b, t) in INT.items():
    gs = t.get('gesture') or {}
    IPL.append('| ' + ' | '.join(esc(c) for c in [iid, gs.get('type', ''), gesture_text(gs), gs.get('metaphor', '—')]) + ' |')
IPL += ['', '## Bounds, display choices and caches', '']
for iid, (b, t) in INT.items():
    extra = [x for x in [t.get('teaching_bounds', ''), t.get('display', ''), t.get('cache', '')] if x]
    if extra: IPL += [f"- **{iid}.** " + ' '.join(extra)]
IPL += ['', '## Claims → controls', '', '| claim | controls |', '|---|---|']
for sid, cs in controls_of.items():
    if cs: IPL.append(f"| {sid} · {esc(E[sid]['title'])} | " + ', '.join(f"{t['id']} (Beat {b['n']})" for b, t in cs) + ' |')
open(P('design/canonical/INTERACTION_PROVENANCE.md'), 'w').write('\n'.join(IPL) + '\n')


# ------------------------------------------------------------------ public provenance: one source of truth for the reader
# The public "sources & assumptions" of every scene and the public /science/ page are generated here, from the ledger,
# the reference registry and the validation reports, with science/PUBLIC_SCIENCE.yaml supplying only framing text.
# Output: design/canonical/public_provenance.json (embedded by app/build.mjs, which also writes app/dist/science/).
# Internal ids never reach the reader as text: [[#anchor|label]] marks a link, which the renderers resolve.
PUB = fill(yaml.safe_load(open(P('science/PUBLIC_SCIENCE.yaml'))))
used_ids = {sid for b in beats['beats'] for sid in (b.get('science') or [])}
ANCH, perrs = {}, []
def anchor_ok(a, owner):
    if not a or not re.fullmatch(r'[a-z0-9]+(-[a-z0-9]+)*', str(a)): perrs.append(f"{owner}: missing or malformed public anchor {a!r}"); return
    if a in ANCH: perrs.append(f"{owner}: anchor {a} also used by {ANCH[a]}")
    ANCH[a] = owner
for e in led['entries']: anchor_ok(e.get('anchor'), e['id'])
for r in refs['references']: anchor_ok(r.get('anchor'), r['id'])
for v in led['validations']: anchor_ok(v.get('anchor'), v['id'])
ptitle = lambda e: e.get('public_title') or e['title']
LINK_OF = {**{e['id']: (e.get('anchor'), ptitle(e)) for e in led['entries']}, **{r['id']: (r.get('anchor'), r.get('short') or r['id']) for r in refs['references']},
           **{v['id']: (v.get('anchor'), v.get('name') or v['id']) for v in led['validations']}}
INTERNAL = re.compile(r'\b(?:SCI|VAL|REF|INT|VT|ORC|CONST)-[A-Z0-9]|\bruling\b|\bpass [0-9]|\bPI\b|\bMFH\b|prototype', re.I)
def publicize(t, where):
    """ledger prose → public prose: ruling references dropped; SCI/VAL/REF ids become links; INT/VT ids dropped"""
    if t is None: return None
    t = str(t)
    t = re.sub(r'\s*[;,]?\s*\(?\bruling (?:A\d+|[A-Z]\d*)\)?', '', t)
    t = re.sub(r'\s*\((?:\s*(?:INT|VT)-[A-Z0-9-]+\s*[,;]?)+\)', '', t); t = re.sub(r'\b(?:INT|VT)-[A-Z0-9-]+', '', t)
    t = re.sub(r'\s*\bCONST-[A-Z0-9-]+', '', t)   # a constant's registry id: the registry (REFERENCES.yaml) is named in the text
    t = re.sub(r'\b((?:SCI|VAL|REF)-(?:[A-Z0-9]+-)*?)(\d{3})((?:/\d{3})+)', lambda m: ', '.join(m.group(1) + n for n in [m.group(2)] + m.group(3).split('/')[1:]), t)   # SCI-CTX-001/002 → two links
    def lk(m):
        ids = re.findall(r'(?:SCI|VAL|REF)-[A-Z0-9-]*[A-Z0-9]', m.group(0)); out = []
        for i in ids:
            if i not in LINK_OF or not LINK_OF[i][0]: perrs.append(f"{where}: cites {i}, which has no public anchor"); continue
            out.append(f"[[#{LINK_OF[i][0]}|{LINK_OF[i][1]}]]")
        return ', '.join(out)
    t = re.sub(r'(?:SCI|VAL|REF)-[A-Z0-9-]*[A-Z0-9](?:\s*(?:/|,|and)\s*(?:SCI|VAL|REF)-[A-Z0-9-]*[A-Z0-9])*', lk, t)
    t = re.sub(r'\(\s*\)|\(\s*see\s*\)', '', t); t = re.sub(r'\s{2,}', ' ', t).strip()
    if INTERNAL.search(re.sub(r'\[\[#[^\]]*\]\]', '', t)): perrs.append(f"{where}: internal wording left in public text: {t[:120]!r}")
    if re.search(r'\]\]/\d', t): perrs.append(f"{where}: a garbled id range reached public text: {t[:120]!r}")
    return t
def ref_links(r):
    i, out = r.get('identifiers') or {}, []
    ok = lambda v: isinstance(v, str) and v and 'unverified' not in v.lower()
    if ok(i.get('doi')) and i['doi'].startswith('10.'): out.append({'label': 'DOI', 'href': 'https://doi.org/' + i['doi']})
    if ok(i.get('ads')) and re.fullmatch(r'\d{4}[A-Za-z&.]{5}[0-9.]{4}[A-Za-z.][0-9.]{4}[A-Z]', i['ads']): out.append({'label': 'ADS', 'href': 'https://ui.adsabs.harvard.edu/abs/' + i['ads'].replace('&', '%26') + '/abstract'})
    if ok(i.get('arxiv')): out.append({'label': 'arXiv', 'href': 'https://arxiv.org/abs/' + i['arxiv'].split()[0]})
    for k, lab in (('url', 'link'), ('pypi', 'PyPI')):
        if ok(i.get(k)) and i[k].startswith(('https://', 'http://')): out.append({'label': lab, 'href': i[k]})
    if ok(i.get('isbn')): out.append({'label': 'ISBN ' + i['isbn'], 'href': None})
    return out
RPUB, cited = {}, set()
for r in refs['references']:
    RPUB[r['id']] = {'anchor': r.get('anchor'), 'short': r.get('short'), 'kind': r.get('kind'), 'citation': r['citation'], 'links': ref_links(r)}
VPUB = {v['id']: {'anchor': v.get('anchor'), 'name': v.get('name'), 'text': publicize(v.get('public'), v['id']), 'status': VSUM[v['id']][0], 'measured': publicize(VSUM[v['id']][1], v['id'] + ' summary'),
                  'criterion': publicize(v.get('criterion'), v['id'] + ' criterion'), 'report': v.get('report') if v.get('report') and os.path.exists(P(v['report'])) and os.path.getsize(P(v['report'])) < 100_000 else None,
                  'report_path': v.get('report')} for v in led['validations']}
for v in led['validations']:
    if not v.get('name') or not v.get('public'): perrs.append(f"{v['id']}: a validation needs a public name and description")
beats_of = {}
for b in beats['beats']:
    for sid in b.get('science') or []: beats_of.setdefault(sid, []).append(b['n'])
EPUB = {}
for e in led['entries']:
    srcs = []
    for kind in ('primary', 'secondary'):
        for x in ((e.get('sources') or {}).get(kind) or []):
            if x['ref'] not in RPUB: perrs.append(f"{e['id']}: unknown reference {x['ref']}"); continue
            srcs.append({'ref': x['ref'], 'location': publicize(x.get('location'), e['id'] + ' location'), 'role': kind}); cited.add(x['ref']) if e['id'] in used_ids else None
    lst = lambda v: [publicize(a, e['id']) for a in (v if isinstance(v, list) else ([v] if v else []))]
    orc = e.get('oracle') or {}
    EPUB[e['id']] = {'anchor': e.get('anchor'), 'title': ptitle(e), 'domain': e.get('domain'), 'status': e['status'], 'claim': publicize(e.get('claim'), e['id']),
        'equations': [{'tex': q['tex'], 'meaning': publicize(q.get('meaning'), e['id'])} for q in (e.get('equations') or []) if q.get('tex')],
        'convention': publicize(e.get('convention'), e['id']), 'assumptions': lst(e.get('assumptions')), 'validity': publicize(e.get('validity'), e['id']),
        'simplifications': lst(e.get('simplifications')), 'sources': srcs, 'check': publicize(orc.get('detail') if isinstance(orc, dict) else orc, e['id'] + ' oracle'),
        'validations': [v for v in (e.get('validations') or []) if v in VPUB], 'beats': beats_of.get(e['id'], []), 'used': e['id'] in used_ids,
        'representation': 'representation' in str(e.get('domain')), 'basis': (orc.get('kind') if isinstance(orc, dict) else None)}   # how a claim without a literature source is supported
    if e['id'] in used_ids:   # a claim a scene relies on must be publicly traceable
        if e['status'] not in ('verified', 'verified-numeric'): perrs.append(f"{e['id']}: a scene relies on it but its status is {e['status']}")
        if not (EPUB[e['id']]['claim'] and EPUB[e['id']]['title']): perrs.append(f"{e['id']}: public claim or title missing")
        if not srcs and not (EPUB[e['id']]['basis'] or EPUB[e['id']]['validations'] or EPUB[e['id']]['representation']): perrs.append(f"{e['id']}: no public source, no stated check or validation, and not a declared teaching representation")
        if not (EPUB[e['id']]['assumptions'] or EPUB[e['id']]['validity']): perrs.append(f"{e['id']}: no public assumptions or validity domain")
for rid in sorted(cited):   # every reference a scene's claim cites must be resolvable by a reader
    r = RPUB[rid]
    if not (r['links'] and any(l['href'] for l in r['links'])) and r['kind'] not in ('book', 'report'): perrs.append(f"{rid}: cited publicly but has no verified DOI, ADS, arXiv or URL (and is not a book or report)")
BPUB = {}
for b in beats['beats']:
    ids = [i for i in (b.get('science') or []) if i in EPUB]
    by_ref = {}
    for i in ids:
        for x in EPUB[i]['sources']: by_ref.setdefault(x['ref'], []).append({'location': x['location'], 'entry': EPUB[i]['anchor']})
    BPUB[str(b['n'])] = {'n': b['n'], 'title': b['title'], 'claim': publicize(b.get('objective'), f"beat {b['n']} objective"),
        'equations': [{'tex': q.get('tex'), 'note': publicize(q.get('note'), f"beat {b['n']} equation"), 'entries': [EPUB[i]['anchor'] for i in (q.get('ids') or []) if i in EPUB]} for q in (b.get('equations') or [])],
        'entries': [{'anchor': EPUB[i]['anchor'], 'title': EPUB[i]['title'], 'assumptions': EPUB[i]['assumptions'], 'validity': EPUB[i]['validity'], 'representation': EPUB[i]['representation']} for i in ids],   # each claim with its own assumptions
        'sources': [{'ref': RPUB[rid]['anchor'], 'locations': locs} for rid, locs in by_ref.items()],
        'simplifications': [publicize(x, f"beat {b['n']} simplification") for x in (b.get('simplifications') or [])],
        'validations': [VPUB[v]['anchor'] for v in (b.get('validation') or []) if v in VPUB]}
def pubtext(t, where):   # the framing text: [[SCI-…]] links; no typed accuracy numbers
    def lk(m):
        i = m.group(1)
        if i not in LINK_OF: perrs.append(f"PUBLIC_SCIENCE {where}: unknown id {i}"); return i
        return f"[[#{LINK_OF[i][0]}|{LINK_OF[i][1]}]]"
    t = re.sub(r'\[\[((?:SCI|VAL|REF)-[A-Z0-9-]+)\]\]', lk, str(t))
    if re.search(r'(error|accura|agree|differ|discrepan|precision)\w*\W+(?:\w+\W+){0,4}\d|\d[\d.,×eE⁻-]*\s*(?:\w+\W+){0,3}(error|accura|agree|differ)', t, re.I): perrs.append(f"PUBLIC_SCIENCE {where}: a number next to a word about accuracy must come from a validation report")
    return t
SITE = {'version': PUB['version'], 'title': PUB['title'], 'about': pubtext(PUB['about'], 'about'), 'modeled': [pubtext(x, 'modeled') for x in PUB['modeled']],
        'not_modeled': [pubtext(x, 'not_modeled') for x in PUB['not_modeled']], 'toy_vs_real': [{'term': x['term'], 'text': pubtext(x['text'], 'toy_vs_real')} for x in PUB['toy_vs_real']],
        'statuses': PUB['statuses'], 'domains_order': list(dict.fromkeys(e.get('domain') for e in led['entries'])),
        'chapters': [{'anchor': c['anchor'], 'title': c['title'], 'intro': pubtext(c['intro'], 'chapters'), 'domains': c['domains']} for c in PUB['chapters']]}
_dom_ch = [d for c in PUB['chapters'] for d in c['domains']]
for d in SITE['domains_order']:
    if _dom_ch.count(d) != 1: perrs.append(f"science notes: ledger domain {d!r} must belong to exactly one chapter in PUBLIC_SCIENCE.yaml (found {_dom_ch.count(d)})")
for t in [json.dumps(SITE)] + [json.dumps(x) for x in (EPUB, BPUB, VPUB)]:
    if re.search(r'\{\{(?:VAL|SCI)-', t): perrs.append('an unresolved {{…}} placeholder reached public text')
public = {'site': SITE, 'beats': BPUB, 'entries': EPUB, 'references': RPUB, 'validations': VPUB}
json.dump(public, open(P('design/canonical/public_provenance.json'), 'w'), ensure_ascii=False, indent=1)
errors += [f"public provenance: {x}" for x in perrs]

print(f"entries {len(E)} · references {len(R)} · validations {len(V)} · beats {len(beats['beats'])} · visual transforms {len(VT)} · interactions {len(INT)}")
print('validation:', ', '.join(f"{k} {v[0]}" for k, v in VSUM.items()))
if unused: print('ledger entries not used by any beat:', ', '.join(unused))
print(f"{len(warns)} unverified source locations (listed in SCIENCE_PROVENANCE.md)")
for e_ in errors: print('ERROR', e_)
sys.exit(1 if errors else 0)
