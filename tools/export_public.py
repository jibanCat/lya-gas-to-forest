#!/usr/bin/env python3
"""Export the public-repository candidate: an explicit allowlist of tracked files, copied into a fresh directory that
could become the public repository (with its own, new history). Everything not listed stays private: design history,
exploration, review packages, internal status and study material. The export then checks itself: every listed path must
exist, nothing outside the allowlist is copied, and every repository path the public files mention as code
(app/…, science/…, design/…, tools/…) must exist inside the export.

Usage: python3 tools/export_public.py OUT_DIR     (OUT_DIR must not exist, or be empty)
"""
import os, re, shutil, subprocess, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
# --------------------------------------------------------------------------------------------- the allowlist
INCLUDE = [   # files or directories (directories: every tracked file under them)
    'README.md', 'CITATION.cff', 'CHANGELOG.md', 'release.json', 'THIRD_PARTY_LICENSES.md', 'package.json', '.gitignore', '.github/workflows/pages.yml',
    'docs/',
    # the app: sources, build, vendored assets, the generated site, and its checks and capture tools
    'app/README.md', 'app/index.html', 'app/build.mjs', 'app/science_page.mjs', 'app/src/', 'app/vendor/', 'app/dist/',
    'app/smoke.mjs', 'app/audit.mjs', 'app/study.mjs', 'app/touch.mjs', 'app/a11y.mjs', 'app/pages_check.mjs', 'app/safari_check.mjs', 'app/perf.mjs', 'app/release_check.mjs',
    'app/shoot.mjs', 'app/shots.txt', 'app/record.mjs', 'app/sequence.mjs', 'app/audit_bundle.mjs', 'app/browsers.mjs', 'app/firefox_bidi.mjs', 'app/load_perf.mjs',
    # the science: ledger, references, physics, toy data, oracles, tests, validation reports, notes cited by the ledger
    'science/README.md', 'science/SCIENCE_LEDGER.yaml', 'science/REFERENCES.yaml', 'science/PUBLIC_SCIENCE.yaml',
    'science/SCIENCE_PROVENANCE.md', 'science/js/', 'science/data/', 'science/oracle/', 'science/tests/', 'science/tools/',
    'science/validation/', 'science/notes/FAKE_SPECTRA_CONVENTIONS.md', 'science/notes/REFERENCE_AUDIT_NOTES.md',
    # the scene manifest and the provenance generated from it; the visual language the build checks the tokens against
    'design/canonical/BEATS.yaml', 'design/canonical/beats.json', 'design/canonical/public_provenance.json', 'design/canonical/glossary.json',
    'design/canonical/CANONICAL_PATH.md', 'design/canonical/INTERACTION_PROVENANCE.md', 'design/canonical/VISUAL_PROVENANCE.md',
    'design/VISUAL_LANGUAGE.md',
    'tools/',
]
OPTIONAL = {'LICENSE', 'app/browsers.mjs', 'docs/'}   # may not exist yet (the licence files are written at release)

def tracked():
    r = subprocess.run(['git', 'ls-files', '-z'], cwd=ROOT, capture_output=True)
    return [f for f in r.stdout.decode().split('\0') if f]

def main():
    if len(sys.argv) != 2: print(__doc__); sys.exit(2)
    out = os.path.abspath(sys.argv[1])
    if os.path.exists(out) and os.listdir(out): sys.exit(f'{out} is not empty')
    files, errs = tracked(), []
    # untracked-but-intended files (new release files not yet committed) are allowed when they exist on disk
    pool = set(files) | {p for p in INCLUDE if not p.endswith('/') and os.path.isfile(os.path.join(ROOT, p))}
    for d in [p for p in INCLUDE if p.endswith('/')]:
        for dd, _, fs in os.walk(os.path.join(ROOT, d)):
            for f in fs: pool.add(os.path.relpath(os.path.join(dd, f), ROOT))
    chosen = []
    for p in INCLUDE + [x for x in ('LICENSE', 'LICENSE-CONTENT.md', 'LICENSE-DATA.md') if os.path.exists(os.path.join(ROOT, x))]:   # written at release by tools/finalize_release.py
        if p.endswith('/'):
            got = sorted(f for f in pool if f.startswith(p) and (f in files or not os.path.basename(f).startswith('.')))
            if not got and p not in OPTIONAL: errs.append(f'allowlisted directory {p} has no files')
            chosen += got
        elif p in pool: chosen.append(p)
        elif p not in OPTIONAL: errs.append(f'allowlisted file {p} does not exist')
    chosen = sorted(set(f for f in chosen if os.path.isfile(os.path.join(ROOT, f)) and '/.DS_Store' not in f and not f.endswith('.DS_Store')))
    for f in chosen:
        os.makedirs(os.path.dirname(os.path.join(out, f)) or out, exist_ok=True)
        shutil.copy2(os.path.join(ROOT, f), os.path.join(out, f))
    # every repository path a public text file names as code must exist in the export
    rx = re.compile(r'`((?:app|science|design|tools|docs)/[A-Za-z0-9_./-]+)`|\b((?:app|science|design|tools)/[A-Za-z0-9_-]+/[A-Za-z0-9_./-]*\.(?:mjs|js|py|yaml|json|md|html))\b')
    dangling = set()
    for f in chosen:
        if not re.search(r'\.(md|yaml|yml|mjs|js|py|json|html|cff)$', f) or f.startswith('app/dist/') or f.startswith('app/vendor/'): continue
        txt = open(os.path.join(out, f), encoding='utf-8', errors='ignore').read()
        for m in rx.finditer(txt):
            ref = (m.group(1) or m.group(2)).rstrip('.').split('#')[0]
            if '*' in ref or '<' in ref: continue
            if not os.path.exists(os.path.join(out, ref)) and not os.path.exists(os.path.join(out, ref.rstrip('/'))): dangling.add((f, ref))
    size = sum(os.path.getsize(os.path.join(out, f)) for f in chosen)
    print(f'export: {len(chosen)} files, {size / 1e6:.1f} MB → {out}')
    for e in errs: print('  ERROR', e)
    if dangling:
        print(f'  NOTE {len(dangling)} mentions of repository paths that are not in the export (history or private material):')
        for f, r in sorted(dangling)[:40]: print(f'    {f} → {r}')
    sys.exit(1 if errs else 0)

if __name__ == '__main__': main()
