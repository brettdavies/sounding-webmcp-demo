#!/usr/bin/env bash
# Verify buoy spray pulses on set-wave impact and stays off in lulls.
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_root"

rg -q 'attachBuoySpray|updateSprayLevel' public/stage/ocean-boot-sea.js
rg -q 'export class BuoySpray' public/stage/buoy-spray.js

node --input-type=module -e "
import { verifyBuoySpray } from './public/stage/buoy-spray-level.js';

const report = verifyBuoySpray(11.5);
console.log('buoy-spray:', JSON.stringify(report, null, 2));
if (!report.ok) process.exit(1);
console.log('OK: spray peak', report.peak, 'lull', report.lullLevel);
"
