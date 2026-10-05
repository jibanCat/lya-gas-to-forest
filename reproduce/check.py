#!/usr/bin/env python3
"""Run every Python reproduction and check it against the app's own values.

For each reproduce/beat*.py:
  1. the snippet (the lines between '# --- snippet ---' and '# --- end snippet ---', the code shown on the site) is run
     on its own in a fresh interpreter, and its output must equal the expected output — formatted from the app's own
     values (science/validation/computations/app_values.json, written by science/tests/test_computations.js);
  2. the whole script must run and exit 0;
  3. every full-precision value it computes must agree with the app's within the tolerance the script states.
Writes science/validation/reproduce/report.json (VAL-PY-001). Needs Python 3 with NumPy and SciPy.
Usage: python3 reproduce/check.py
"""
import contextlib, importlib.util, io, json, os, subprocess, sys
sys.dont_write_bytecode = True   # no __pycache__: compiled files embed local paths and are never committed

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
APP = json.load(open(os.path.join(ROOT, 'science', 'validation', 'computations', 'app_values.json')))
OUT = os.path.join(ROOT, 'science', 'validation', 'reproduce', 'report.json')

def snippet_of(text):
    a, b = text.index('# --- snippet ---\n'), text.index('# --- end snippet ---')
    return text[a + len('# --- snippet ---\n'):b]

def run(args):
    r = subprocess.run([sys.executable, '-B', *args], capture_output=True, text=True, cwd=ROOT)
    return r.returncode, r.stdout, r.stderr

def judge(name, py, app, tol):
    if tol == 'abs<1e-2': ok, dev = abs(py) < 1e-2 and abs(app) < 1e-2, abs(py - app)
    elif tol.startswith('py<') if isinstance(tol, str) else False: dev = abs(py); ok = dev < float(tol[3:])   # a bound on Python's own value
    else: dev = abs(py - app) / abs(app) if app else abs(py); ok = dev <= tol
    return {'name': name, 'python': py, 'app': app, 'deviation': dev, 'tolerance': tol, 'ok': bool(ok)}

scripts, ok_all = {}, True
for fn in sorted(f for f in os.listdir(HERE) if f.startswith('beat') and f.endswith('.py')):
    path = os.path.join(HERE, fn); text = open(path).read(); snip = snippet_of(text)
    rec = {'snippet_lines': snip.count('\n')}
    code, out, err = run(['-c', snip]); rec['snippet_exit'] = code
    spec = importlib.util.spec_from_file_location(fn[:-3], path); mod = importlib.util.module_from_spec(spec)
    with contextlib.redirect_stdout(io.StringIO()): spec.loader.exec_module(mod)
    exp = mod.expected(APP); rec['expected_output'] = exp
    rec['snippet_output_matches'] = code == 0 and out.splitlines() == exp
    if not rec['snippet_output_matches']: rec['snippet_output'] = out.splitlines(); rec['snippet_stderr'] = err[-800:]
    code2, out2, _ = run([path]); rec['script_exit'] = code2; rec['script_output_is_snippet_output'] = out2 == out
    try: rec['comparisons'] = [judge(*c) for c in mod.compare(APP)]; rec['inputs_agree'] = True
    except AssertionError: rec['comparisons'] = []; rec['inputs_agree'] = False
    rec['ok'] = rec['snippet_output_matches'] and code2 == 0 and rec['script_output_is_snippet_output'] and rec['inputs_agree'] and bool(rec['comparisons']) and all(c['ok'] for c in rec['comparisons'])
    ok_all &= rec['ok']; scripts[fn] = rec
    worst = max((c['deviation'] for c in rec['comparisons'] if isinstance(c['tolerance'], (int, float))), default=0)
    print(f"{'ok  ' if rec['ok'] else 'FAIL'} {fn:32s} snippet {rec['snippet_lines']:2d} lines, output {'=' if rec['snippet_output_matches'] else '≠'} expected; "
          f"{sum(c['ok'] for c in rec['comparisons'])}/{len(rec['comparisons'])} values agree with the app (largest relative deviation {worst:.1e})")
    if not rec['snippet_output_matches']:
        for a, b in zip(out.splitlines() + ['<missing>'] * 9, exp): print(f"      got:      {a}\n      expected: {b}") if a != b else None

import numpy, scipy
report = {'generated_by': 'reproduce/check.py', 'app_values': 'science/validation/computations/app_values.json', 'n_scripts': len(scripts),
          'python': sys.version.split()[0], 'numpy': numpy.__version__, 'scipy': scipy.__version__, 'scripts': scripts, 'pass': bool(ok_all and scripts)}
os.makedirs(os.path.dirname(OUT), exist_ok=True); json.dump(report, open(OUT, 'w'), indent=1, ensure_ascii=False)
print(f"Python reproductions: {sum(r['ok'] for r in scripts.values())}/{len(scripts)} pass → {os.path.relpath(OUT, ROOT)}")
sys.exit(0 if report['pass'] else 1)
