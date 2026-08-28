#!/usr/bin/env bash
# Verify shore whitewash pulses on set waves and decays (no permanent beach band).
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_root"

rg -q 'shoreWash|shoreWhitewashMask|updateShoreWash' public/ocean/ocean-material.js
rg -q 'shore-whitewash' public/stage/ocean-boot-sea.js

node --input-type=module -e "
import { readFileSync } from 'node:fs';
import { extractPins } from './public/stage/mavericks-pins.js';
import { verifyShoreWhitewash } from './public/stage/shore-whitewash.js';

const meta = JSON.parse(readFileSync('public/land/mavericks/meta.json', 'utf8'));
const pins = extractPins(meta);
const center = { x: pins.spectators?.x ?? -100, z: pins.spectators?.z ?? 100 };
const report = verifyShoreWhitewash(center);
console.log('shore-whitewash:', JSON.stringify(report, null, 2));
if (!report.ok) process.exit(1);
console.log('OK: shore wash peak', report.peak, 'decay', report.afterDecay);
"
