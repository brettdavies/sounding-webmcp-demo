#!/usr/bin/env bash
# Verify quality ramp tiers and boot wiring.
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_root"

rg -q 'sampleQualityRamp|qualityRamp' public/stage/ocean-boot-sea.js
rg -q 'export function sampleQualityRamp' public/stage/quality-ramp.js
rg -q 'setOceanSegmentTier' public/stage/quality-ramp-ocean.js

node --input-type=module -e "
import { verifyQualityRamp, QUALITY_RAMP_SEC } from './public/stage/quality-ramp.js';

const verify = verifyQualityRamp();
console.log('quality-ramp:', JSON.stringify({ verify, rampSec: QUALITY_RAMP_SEC }, null, 2));
if (!verify.ok) process.exit(1);
console.log('OK: ramp 64→360 segments, FFT 64→128 by', QUALITY_RAMP_SEC, 's');
"
