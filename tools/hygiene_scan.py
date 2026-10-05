#!/usr/bin/env python3
"""Public-release hygiene scan. Scans a file tree (default: the git-tracked files of this repository) and, optionally,
the whole git history (every blob ever committed, and every path ever added) for things that must not be published:
personal absolute paths, user and machine names, e-mail addresses, credentials and tokens, private URLs and private
repositories, simulation data whose redistribution is not cleared, temporary audit bundles, and internal-only notes.

Usage:
  python3 tools/hygiene_scan.py                     # tracked files at HEAD
  python3 tools/hygiene_scan.py --tree DIR          # any directory (e.g. the public-candidate export)
  python3 tools/hygiene_scan.py --history           # also every blob and path in the git history
  python3 tools/hygiene_scan.py --json OUT.json     # machine-readable findings
  --allow-commit-identity 'Name <email>'            # (repeatable) an identity the owner chose to publish in commit
                                                    # metadata: allowed there only, and reported as ALLOWED, never hidden
Exit status 1 if any finding in a FAIL category is present (NOTE categories are reported, not failed).
"""
import argparse, json, os, re, subprocess, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
FAIL, NOTE = 'FAIL', 'NOTE'
RULES = [   # (category, severity, regex, explanation)
    ('personal path', FAIL, r'/Users/[A-Za-z0-9._-]+|/home/[A-Za-z0-9._-]+/|C:\\Users\\|/private/tmp/claude|/var/folders/', 'an absolute path on a personal machine'),
    ('user or machine name', FAIL, r'\bjibanmac\b|\.local\b(?!host)|MacBook|\bMBP\b', 'a local account or machine name'),
    ('e-mail address', FAIL, r'[A-Za-z0-9._%+-]+@(?!example\.)[A-Za-z0-9.-]+\.[A-Za-z]{2,}', 'an e-mail address'),
    ('credential or token', FAIL, r'AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|gho_[A-Za-z0-9]{30,}|sk-[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|(?i:api[_-]?key|secret|password|passwd|token)\s*[:=]\s*["\'][^"\']{8,}["\']', 'a secret, key or token'),
    ('private data', FAIL, r'\bPRIYA\b|priya-sims|MP-Gadget snapshot|/snapdir', 'simulation data or paths whose redistribution is not cleared'),
    ('private repository', NOTE, r'github\.com/jibanCat/(?!talks\b)[A-Za-z0-9_.-]+', 'a link to a (possibly private) repository'),
    ('audit bundle', FAIL, r'AUDIT_[AB]\.md|blind-audit bundle output|scratchpad/blind', 'a temporary audit bundle or report'),
    ('internal note', NOTE, r'\bMFH\b|\bPI ruling\b|\bPI review\b|\bPI decision|\bruling A\d+\b|\bpass [1-9]\b|(?<![.\w])PI\b', 'an internal decision or workflow reference'),   # not Math.PI
]
SKIP_DIRS = {'.git', 'node_modules', '__pycache__'}
BINARY = re.compile(r'\.(png|jpg|jpeg|gif|mp4|woff2?|ttf|pdf|zip|gz|npz|npy|bin|ico)$', re.I)

SELF = 'tools/hygiene_scan.py'   # the rules above match themselves
def scan_text(name, text, out):
    if re.sub(r'@[0-9a-f]{8}$| \(path\)$', '', name).endswith(SELF): return   # also its own blobs in the history
    for cat, sev, rx, why in RULES:
        for m in re.finditer(rx, text):
            ls = text.rfind('\n', 0, m.start()) + 1; le = text.find('\n', m.end()); le = len(text) if le < 0 else le
            if 'hygiene: allow' in text[ls:le]: continue   # a deliberate pattern or a statement of absence, marked in place
            if cat == 'e-mail address' and re.search(r'noreply@anthropic\.com', m.group(0)): continue   # commit trailer convention, not personal
            line = text.count('\n', 0, m.start()) + 1
            out.append({'category': cat, 'severity': sev, 'file': name, 'line': line, 'match': m.group(0)[:80]})

def tracked_files(root):
    r = subprocess.run(['git', 'ls-files', '-z'], cwd=root, capture_output=True)
    return [f for f in r.stdout.decode().split('\0') if f]

def walk(tree):
    for d, ds, fs in os.walk(tree):
        ds[:] = [x for x in ds if x not in SKIP_DIRS]
        for f in fs: yield os.path.relpath(os.path.join(d, f), tree)

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--tree'); ap.add_argument('--history', action='store_true'); ap.add_argument('--json'); ap.add_argument('--allow-commit-identity', action='append', default=[])
    a = ap.parse_args(); root = a.tree or ROOT; out = []
    files = list(walk(root)) if a.tree else tracked_files(root)
    big = []
    for f in files:
        p = os.path.join(root, f)
        if not os.path.isfile(p): continue
        scan_text(f, f, out)   # the path itself
        if os.path.getsize(p) > 50_000_000: big.append(f)
        if BINARY.search(f): continue
        try: scan_text(f, open(p, encoding='utf-8', errors='ignore').read(), out)
        except Exception: pass
    hist = []
    if a.history:
        revs = subprocess.run(['git', 'rev-list', '--all', '--objects'], cwd=ROOT, capture_output=True, text=True).stdout.splitlines()
        seen_paths = {}
        for line in revs:
            parts = line.split(' ', 1)
            if len(parts) == 2: seen_paths.setdefault(parts[1], parts[0])
        for path_, sha in seen_paths.items():
            scan_text(f'history:{path_} (path)', path_, hist)
            if BINARY.search(path_): continue
            t = subprocess.run(['git', 'cat-file', '-t', sha], cwd=ROOT, capture_output=True, text=True).stdout.strip()
            if t != 'blob': continue
            blob = subprocess.run(['git', 'cat-file', '-p', sha], cwd=ROOT, capture_output=True).stdout.decode('utf-8', 'ignore')
            scan_text(f'history:{path_}@{sha[:8]}', blob, hist)
        # commit metadata: an identity the owner declared (--allow-commit-identity) is allowed here only, and listed
        log = subprocess.run(['git', 'log', '--all', '--format=%H%x00%an <%ae>%x00%cn <%ce>%x00%B%x1e'], cwd=ROOT, capture_output=True, text=True).stdout
        for rec in filter(str.strip, log.split('\x1e')):
            sha, who, cmt, body = (rec.strip('\n').split('\x00') + ['', '', ''])[:4]
            for ident in a.allow_commit_identity:
                for part, label in ((who, 'author'), (cmt, 'committer'), (body, 'message')):
                    if ident in part: hist.append({'severity': 'ALLOWED', 'category': 'declared commit identity', 'file': f'history:commit {sha[:8]} ({label})', 'line': 1, 'match': ident, 'why': 'published deliberately in commit metadata'})
                who, cmt, body = (s.replace(ident, '<declared identity>') for s in (who, cmt, body))
            scan_text(f'history:commit {sha[:8]} (author)', who, hist); scan_text(f'history:commit {sha[:8]} (committer)', cmt, hist); scan_text(f'history:commit {sha[:8]} (message)', body, hist)
    allf = out + hist
    by = {}
    for x in allf: by.setdefault((x['severity'], x['category']), []).append(x)
    print(f"hygiene scan of {'tree ' + a.tree if a.tree else 'tracked files'}{' + git history' if a.history else ''}: {len(files)} files")
    for (sev, cat), xs in sorted(by.items()):
        files_ = sorted({x['file'] for x in xs})
        print(f"  {sev} {cat}: {len(xs)} matches in {len(files_)} files — e.g. " + '; '.join(f"{x['file']}:{x['line']} '{x['match']}'" for x in xs[:3]))
    if big: print('  NOTE files over 50 MB:', ', '.join(big))
    if a.json: json.dump({'tree': a.tree or 'tracked', 'history': a.history, 'findings': allf, 'big_files': big}, open(a.json, 'w'), indent=1)
    fails = [x for x in allf if x['severity'] == FAIL]; allowed = [x for x in allf if x['severity'] == 'ALLOWED']
    print(f"  → {len(fails)} FAIL findings, {len(allf) - len(fails) - len(allowed)} NOTE findings, {len(allowed)} ALLOWED (declared commit identity)")
    sys.exit(1 if fails else 0)

if __name__ == '__main__': main()
