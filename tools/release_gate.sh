#!/usr/bin/env bash
# The release gate: everything that can be checked automatically before a public release. It fails on any blocker.
#   1. tools/validate.sh (the same script as CI): the committed site is the build of this commit; the science tests; the
#      provenance with the reports they wrote; links, references, vendored assets, licences, the data record, the
#      version; browser checks (every scene, touch, accessibility, the study mode) and every installed engine
#   2. public traceability: every scene → claim → assumptions → source → exact location → validation
#   3. the public export (tools/export_public.py) and its hygiene scan: 0 FAIL
#   4. with PUBLIC_REPO=<the fresh public repository>: that repository's own hygiene scan, tree and whole history: 0 FAIL
#      (PUBLIC_ALLOW: commit identities published deliberately, reported as ALLOWED)
# Manual device checks (Safari, iPad, screen readers) are recorded in docs/BROWSERS.md; they are never "automated" here.
# Usage: bash tools/release_gate.sh        (PYTHON, VALIDATE_OUT, PUBLIC_REPO optional)
set -euo pipefail
cd "$(dirname "$0")/.."
export PYTHON=${PYTHON:-python3}
export VALIDATE_OUT=${VALIDATE_OUT:-$(mktemp -d)}
bash tools/validate.sh
printf '\n== public traceability\n'
$PYTHON tools/provenance_check.py "$VALIDATE_OUT/provenance_check.md"
printf '\n== the public export and its hygiene\n'
rm -rf "$VALIDATE_OUT/export"
$PYTHON tools/export_public.py "$VALIDATE_OUT/export" | head -1
$PYTHON tools/hygiene_scan.py --tree "$VALIDATE_OUT/export" | tail -1
if [ -n "${PUBLIC_REPO:-}" ]; then
  printf '\n== the public repository: tree and whole history\n'
  # PUBLIC_ALLOW: the commit identities the owner chose to publish ("Name <email>", separated by ';'), allowed only in
  # commit metadata and listed as ALLOWED
  ALLOW=(); IFS=';' read -ra IDS <<< "${PUBLIC_ALLOW:-}"; for i in ${IDS[@]+"${IDS[@]}"}; do ALLOW+=(--allow-commit-identity "$i"); done
  (cd "$PUBLIC_REPO" && $PYTHON tools/hygiene_scan.py --history ${ALLOW[@]+"${ALLOW[@]}"} | tail -3)
fi
echo; echo "release gate passed"
