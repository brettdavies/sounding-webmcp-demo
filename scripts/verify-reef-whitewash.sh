#!/usr/bin/env bash
# Verify reef whitewash: cascade history + lip pulse on reef, decay in lulls.
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_root"

rg -q 'reefWash|reefZoneMask|reefCascade' public/ocean/ocean-material.js
rg -q 'reef-whitewash' public/stage/ocean-boot-sea.js

node --input-type=module -e "
import { readFileSync } from 'node:fs';
import { extractPins } from './public/stage/mavericks-pins.js';
import { verifyReefWhitewash } from './public/stage/reef-whitewash.js';

const meta = JSON.parse(readFileSync('public/land/mavericks/meta.json', 'utf8'));
const pins = extractPins(meta);
const peak = pins.breakPeak ?? { x: -440, z: -20 };
const report = verifyReefWhitewash(peak);
console.log('reef-whitewash:', JSON.stringify(report, null, 2));
if (!report.ok) process.exit(1);
console.log('OK: reef wash active', report.active.total, 'lull', report.lull.total);
"
