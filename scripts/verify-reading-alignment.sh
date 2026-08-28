#!/usr/bin/env bash
# Verify /api/reading heat JSON drives set-wave schedule + overlay wiring.
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_root"

rg -q '/api/reading' public/stage/ocean-boot-sea.js
rg -q 'buildSetWaveSchedule' public/stage/ocean-boot-sea.js
rg -q 'overlayReadout' public/stage/ocean-boot-sea.js

node --input-type=module -e "
import { readFileSync } from 'node:fs';
import {
  verifyReadingAlignment,
  verifyReadingBootWiring,
} from './public/stage/reading-alignment.js';

const reading = JSON.parse(readFileSync('src/data/mavericks-heat.json', 'utf8'));
const bootSource = readFileSync('public/stage/ocean-boot-sea.js', 'utf8');
const alignment = verifyReadingAlignment(reading);
const wiring = verifyReadingBootWiring(bootSource);

const report = { alignment, wiring };
console.log('reading-alignment:', JSON.stringify(report, null, 2));
if (!alignment.ok || !wiring.ok) process.exit(1);
console.log('OK: reading gap', alignment.shape.gap, 'within-set', alignment.shape.withinSetGap, 's');
"
