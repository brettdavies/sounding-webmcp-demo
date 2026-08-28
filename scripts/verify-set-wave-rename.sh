#!/usr/bin/env bash
# Ensure set-wave glossary rename is complete (no overlay heat* identifiers in stage/ocean code).
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_root"

patterns=(
  'heat\.js'
  'buildHeatSchedule'
  'sampleHeat'
  'heatDisplacementAt'
  'applyHeatUniforms'
  'heatActive'
  'heatAmplitude'
  'heatCrestAlong'
  'heatGerstnerGlsl'
)

failed=0
for pat in "${patterns[@]}"; do
  if rg -q "$pat" public/stage public/ocean 2>/dev/null; then
    echo "FAIL: still found '$pat' in public/stage or public/ocean" >&2
    rg -n "$pat" public/stage public/ocean 2>/dev/null || true
    failed=1
  fi
done

if [[ $failed -ne 0 ]]; then
  exit 1
fi

echo "OK: set-wave glossary rename verified (no overlay heat* in public/stage|ocean)"
