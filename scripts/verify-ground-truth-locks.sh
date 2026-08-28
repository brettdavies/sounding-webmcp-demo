#!/usr/bin/env bash
# Verify meta.json stage locks match docs/stage-ground-truth.md contract table.
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_root"

rg -q 'ground-truth SoT' public/stage/mavericks-pins.js
rg -q 'Stage ground truth' docs/stage-ground-truth.md

node --input-type=module -e "
import { readFileSync } from 'node:fs';
import { verifyGroundTruthLocks } from './public/stage/ground-truth-locks.js';
import { extractPins } from './public/stage/mavericks-pins.js';

const meta = JSON.parse(readFileSync('public/land/mavericks/meta.json', 'utf8'));
const report = verifyGroundTruthLocks(meta);
const pins = extractPins(meta);

console.log('ground-truth-locks:', JSON.stringify({ ...report, pins: {
  mslY: pins.mslY,
  breakPeak: pins.breakPeak,
  swellFromDeg: pins.swellFromDeg,
}}, null, 2));
if (!report.ok) process.exit(1);
console.log('OK:', Object.keys(report.checks).length, 'locks verified against meta.json');
"
