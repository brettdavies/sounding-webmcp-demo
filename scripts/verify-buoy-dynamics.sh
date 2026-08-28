#!/usr/bin/env bash
# Verify buoy heave integrator never exceeds free-surface freeboard clamp.
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_root"

rg -q 'Never allow the waterline above the free surface' public/stage/buoy.js
rg -q 'MAX_FREEBOARD_M' public/stage/buoy.js

node --input-type=module -e "
import { verifyBuoyNeverAirborne } from './public/stage/buoy-dynamics-verify.js';

const report = verifyBuoyNeverAirborne();
console.log('buoy-dynamics:', JSON.stringify(report, null, 2));
if (!report.ok) process.exit(1);
console.log('OK: buoy never airborne — maxFreeboard', report.maxFreeboard, 'm');
"
