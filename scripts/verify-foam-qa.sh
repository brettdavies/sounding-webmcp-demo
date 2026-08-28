#!/usr/bin/env bash
# P1b foam QA: no permanent beach band; spray and reef foam off in lulls.
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_root"

"$repo_root/scripts/verify-shore-whitewash.sh"
"$repo_root/scripts/verify-reef-whitewash.sh"
"$repo_root/scripts/verify-buoy-spray.sh"

node --input-type=module -e "
import { readFileSync } from 'node:fs';
import { extractPins } from './public/stage/mavericks-pins.js';
import { verifyFoamQa } from './public/stage/foam-qa.js';

const meta = JSON.parse(readFileSync('public/land/mavericks/meta.json', 'utf8'));
const pins = extractPins(meta);
const report = verifyFoamQa({
  spectators: pins.spectators ?? { x: -100, z: 100 },
  breakPeak: pins.breakPeak,
});
console.log('foam-qa:', JSON.stringify(report, null, 2));
if (!report.ok) process.exit(1);
console.log('OK: foam QA lull shore', report.lull.shoreLevel, 'spray', report.lull.sprayLevel);
"
