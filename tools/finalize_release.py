#!/usr/bin/env python3
"""Finalize a release once its facts are approved: the public repository and site, the copyright holder, the licences
and (optionally) the release date. Writes release.json and the licence files, and fills the marked release regions of
README.md, CITATION.cff and package.json; then rebuilds the site and the data record so every page agrees.
Nothing here decides a licence: run it only with the approved values.

Usage:
  python3 tools/finalize_release.py --owner OWNER --repo REPO --holder "NAME" --year 2026 \
      [--date YYYY-MM-DD] [--site URL] [--live] [--code MIT] [--content CC-BY-4.0] [--data CC0-1.0] [--country "COUNTRY"]
--live only once the site is actually deployed: until then the README names the address without claiming it is live.
"""
import argparse, json, os, re, subprocess, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
P = lambda *a: os.path.join(ROOT, *a)
NAMES = {'MIT': 'MIT', 'CC-BY-4.0': 'CC BY 4.0', 'CC0-1.0': 'CC0 1.0'}
TEMPLATES = {'MIT': ('tools/licenses/MIT.txt', 'LICENSE'), 'CC-BY-4.0': ('tools/licenses/CC-BY-4.0.md', 'LICENSE-CONTENT.md'), 'CC0-1.0': ('tools/licenses/CC0-1.0.md', 'LICENSE-DATA.md')}

def region(text, name, body):
    """replace the text between <!-- release:name --> and <!-- /release:name --> (both kept)"""
    pat = re.compile(r'(<!-- release:%s -->)(.*?)(<!-- /release:%s -->)' % (name, name), re.S)
    if not pat.search(text): sys.exit(f'README.md has no release:{name} region')
    return pat.sub(lambda m: m.group(1) + body + m.group(3), text)

def main():
    a = argparse.ArgumentParser(); a.add_argument('--owner', required=True); a.add_argument('--repo', required=True); a.add_argument('--holder', required=True)
    a.add_argument('--year', required=True); a.add_argument('--date'); a.add_argument('--site'); a.add_argument('--country'); a.add_argument('--live', action='store_true')
    a.add_argument('--code', default='MIT'); a.add_argument('--content', default='CC-BY-4.0'); a.add_argument('--data', default='CC0-1.0'); o = a.parse_args()
    for lic in (o.code, o.content, o.data):
        if lic not in TEMPLATES: sys.exit(f'no template for licence {lic}: add one in tools/licenses/ first')
    repo, site = f'https://github.com/{o.owner}/{o.repo}', o.site or f'https://{o.owner.lower()}.github.io/{o.repo}/'
    rel = json.load(open(P('release.json')))
    rel.update(repository=repo, site=site, site_live=o.live, date_released=o.date, copyright_holder=o.holder, licences=dict(code=o.code, content=o.content, data=o.data))
    open(P('release.json'), 'w').write(json.dumps(rel, indent=2, ensure_ascii=False) + '\n')
    for lic in (o.code, o.content, o.data):   # the licence files, from their templates
        src, dst = TEMPLATES[lic]; t = open(P(src)).read().replace('{year}', o.year).replace('{holder}', o.holder)
        t = t.replace('{country}', o.country) if o.country else re.sub(r' This work is published from: \{country\}\.', '', t)
        open(P(dst), 'w').write(t)
    # README: the site and the licence
    r = open(P('README.md')).read()
    r = region(r, 'site', f'**Live site:** {site} · **Science notes:** {site}science/' if o.live else f'**Live site:** available after the v0.1 deployment, at `{site}`')
    n = lambda lic: NAMES.get(lic, lic)
    r = region(r, 'licence', f'\n- **Code:** {n(o.code)} (`LICENSE`).\n- **Original educational text and original teaching visuals:** {n(o.content)} (`LICENSE-CONTENT.md`).\n'
               f'- **Synthetic toy data created by this project:** {n(o.data)} (`LICENSE-DATA.md`).\n\nThird-party fonts and KaTeX keep their '
               f'own licences (`THIRD_PARTY_LICENSES.md`).\nCited literature, published constants and other third-party material are not covered by these licences.\n')
    open(P('README.md'), 'w').write(r)
    # CITATION.cff: repository, site, licence, date
    c = open(P('CITATION.cff')).read()
    c = re.sub(r'(?m)^(repository-code|url|license|date-released):.*\n', '', c)
    extra = f'repository-code: "{repo}"\nurl: "{site}"\nlicense: {json.dumps([o.code, o.content, o.data])}\n' + (f'date-released: "{o.date}"\n' if o.date else '')
    c = c.replace('\nauthors:', '\n' + extra + 'authors:', 1)
    open(P('CITATION.cff'), 'w').write(c)
    # package.json
    pk = json.load(open(P('package.json'))); pk.update(license=o.code, homepage=site, repository={'type': 'git', 'url': f'git+{repo}.git'})
    open(P('package.json'), 'w').write(json.dumps(pk, indent=2, ensure_ascii=False) + '\n')
    # every page and record agrees
    for cmd in (['python3', 'science/tools/build_provenance.py'], ['node', 'app/build.mjs'], ['python3', 'tools/data_inventory.py']):
        r_ = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True)
        if r_.returncode: sys.exit(f'{" ".join(cmd)} failed:\n{r_.stdout[-1500:]}{r_.stderr[-1500:]}')
    print(f'finalized: {repo} · {site} ({"live" if o.live else "not yet live"}) · © {o.year} {o.holder} · code {o.code}, content {o.content}, data {o.data}' + (f' · released {o.date}' if o.date else ' · no release date yet'))

if __name__ == '__main__': main()
