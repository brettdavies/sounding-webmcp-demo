#!/usr/bin/env bash
# Verify steady-state fps settle contract (≥120 fps after quality ramp).
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_root"

rg -q 'fpsSettleAudit|auditFpsSettle' public/stage/ocean-boot-sea.js
rg -q 'effectiveDpr' public/stage/ocean-boot-sea.js public/stage/perf-gate.js

bash "$repo_root/scripts/verify-perf-gate.sh"

node --input-type=module -e "
import {
  verifyFpsSettle,
  sampleFpsSettlePass,
} from './public/stage/fps-settle-verify.js';
import { effectiveDpr, PERF_OCEAN_TIERS, effectiveRenderScale } from './public/stage/perf-gate.js';

const pass = sampleFpsSettlePass();
const fail = verifyFpsSettle({
  perf: { fps: 90 },
  qualityRamp: { settled: true },
  perfGate: { fps: 90, targetFps: 120, tier: 3, gateArmed: true, rampSettled: true, steadySamples: 64 },
});
const dpr = effectiveDpr(4, 2);
const rs = effectiveRenderScale(4);
const tiers = PERF_OCEAN_TIERS.length;
console.log('fps-settle:', JSON.stringify({ pass, fail, dpr, rs, tiers }, null, 2));
if (!pass.ok || fail.ok || dpr !== 0.5 || rs !== 0.45 || tiers !== 6) process.exit(1);
console.log('OK: fps settle target', pass.targetFps, 'tier4 dpr', dpr, 'renderScale', rs);
"
