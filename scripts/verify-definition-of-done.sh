#!/usr/bin/env bash
# Run all stage verify scripts and emit definition-of-done summary.
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_root"

scripts=(
  verify-default-boot
  verify-skill-router-inventory
  verify-mavericks-views
  verify-cliff-qa
  verify-curved-crest
  verify-break-style
  verify-set-wave-rename
  verify-buoy-dynamics
  verify-buoy-spray
  verify-shore-whitewash
  verify-reef-whitewash
  verify-foam-qa
  verify-overlay-readout
  verify-lip-foam
  verify-terrain-stride
  verify-boot-budget
  verify-placeholder-boot
  verify-layer-controls
  verify-quality-ramp
  verify-perf-gate
  verify-reading-alignment
  verify-ground-truth-locks
  verify-hero-views-runtime
  verify-qa-manifest
  verify-capture-qa-manifest
)

results_file="$(mktemp)"
printf '{' >"$results_file"
first=1
failed=0

for name in "${scripts[@]}"; do
  script="$repo_root/scripts/${name}.sh"
  chmod +x "$script" 2>/dev/null || true
  echo ""
  echo "=== ${name} ==="
  if bash "$script"; then
    [[ $first -eq 0 ]] && printf ',' >>"$results_file"
    printf '"%s":true' "$name" >>"$results_file"
    first=0
  else
    [[ $first -eq 0 ]] && printf ',' >>"$results_file"
    printf '"%s":false' "$name" >>"$results_file"
    first=0
    failed=1
    echo "FAIL: ${name}" >&2
  fi
done
printf '}\n' >>"$results_file"

echo ""
echo "=== definition-of-done summary ==="
node --input-type=module -e "
import { readFileSync } from 'node:fs';
import { summarizeDefinitionOfDone } from './public/stage/definition-of-done-report.js';

const results = JSON.parse(readFileSync('$results_file', 'utf8'));
const summary = summarizeDefinitionOfDone(results);
console.log(JSON.stringify(summary, null, 2));
for (const item of summary.items) {
  const scriptList = item.scripts.length ? item.scripts.join(', ') : 'n/a';
  console.log('[' + item.status + '] ' + item.id + ': ' + item.label + ' (' + item.kind + '; ' + scriptList + ')');
}
if (!summary.allProgrammaticOk) process.exit(1);
console.log('OK: programmatic DoD ' + summary.programmaticPass + '/' + summary.programmaticTotal);
"

rm -f "$results_file"

if [[ $failed -ne 0 ]]; then
  exit 1
fi
