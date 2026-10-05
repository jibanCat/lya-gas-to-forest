#!/usr/bin/env bash
# The release gate — run locally (npm run validate) and by .github/workflows/pages.yml, so the two cannot drift.
#   1. the committed site and generated provenance are exactly the build of this commit (from its committed reports)
#   2. the science tests (validations) pass
#   3. the provenance builds with the reports the tests just wrote (integrity checks; no typed accuracy numbers)
#   4. links, references, vendored assets, licences, data record, version
#   5. browser checks in Chromium: every beat, probes, the rendering check (VAL-REND-001), the control audit, the study
#      mode, touch, accessibility (targets, keyboard, focus, semantics, reduced motion, zoom, small screens)
#   6. a load check in every installed browser engine (Chromium, Firefox, WebKit)
#      and the Python reproductions (reproduce/check.py): each snippet, run alone, prints the app's own values
# Needs: node ≥ 20, Python 3 with PyYAML, NumPy and SciPy (set PYTHON to choose the interpreter), git, Playwright 1.63 with browsers.
set -euo pipefail
cd "$(dirname "$0")/.."
PY=${PYTHON:-python3}
OUT=${VALIDATE_OUT:-$(mktemp -d)}
step() { printf '\n== %s\n' "$*"; }

step "1/6 the committed site is the build of this commit"
$PY science/tools/build_provenance.py > /dev/null
node app/build.mjs
$PY tools/data_inventory.py --check
if ! git diff --quiet -- app/dist design/canonical science/SCIENCE_PROVENANCE.md science/COMPUTATION_MATRIX.md science/validation/VALIDATION_SUMMARY.md docs/DATA.md; then
  git --no-pager diff --stat -- app/dist design/canonical science/SCIENCE_PROVENANCE.md science/COMPUTATION_MATRIX.md science/validation/VALIDATION_SUMMARY.md docs/DATA.md
  echo "The committed site or generated provenance is stale: run 'npm run build' and commit the result."; exit 1
fi
echo "app/dist and the generated provenance match this commit"

step "2/6 science tests"
for t in science/tests/test_*.js; do
  if out=$(node "$t" 2>&1); then echo "ok  $t  $(printf '%s' "$out" | tail -1)"; else printf '%s\n' "$out"; echo "FAIL $t"; exit 1; fi
done
# the Python reproductions, against the app's own values the tests above just wrote (science/validation/computations)
if out=$($PY reproduce/check.py 2>&1); then echo "ok  reproduce/check.py  $(printf '%s' "$out" | tail -1)"; else printf '%s\n' "$out"; echo "FAIL reproduce/check.py"; exit 1; fi

step "3/6 provenance integrity with the reports the tests wrote"
$PY science/tools/build_provenance.py | tail -4

step "4/6 links, references, assets, licences, version"
node app/release_check.mjs

step "5/6 browser checks (Chromium)"
node app/smoke.mjs | tail -5
node app/audit.mjs
node app/study.mjs "$OUT/study" | tail -1
node app/touch.mjs "$OUT/touch" | tail -1
node app/a11y.mjs "$OUT/a11y" | tail -3
node app/continuous_navigation.mjs "$OUT/continuous_navigation.json" | tail -1   # one fixed place turns every page, 0 → 13 → 0
node app/tour_check.mjs "$OUT/tour.json" | tail -1   # the guided tour: every slide, in order, by tapping empty paper

step "6/6 load check in every installed engine"
node app/browsers.mjs "$OUT/browsers"
echo; echo "release gate passed"
