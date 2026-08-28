#!/usr/bin/env bash
# Verify perf gate wiring, 120fps target, and no terrain stride regression.
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_root"

rg -q 'createPerfGate|perfGate' public/stage/ocean-boot-sea.js
rg -q 'createPerfMonitor|debug.*perf' public/stage/ocean-boot-sea.js
rg -q 'export function createPerfGate' public/stage/perf-gate.js
rg -q 'STEADY_FPS_TARGET' public/stage/perf-gate.js

bash "$repo_root/scripts/verify-terrain-stride.sh"

node --input-type=module -e "
import {
  verifyPerfGate,
  samplePerfGatePass,
  STEADY_FPS_TARGET,
  effectiveOceanSegments,
  effectiveDpr,
  effectiveRenderScale,
  effectiveFftResolution,
  shouldUpdateOceanFft,
  PERF_OCEAN_TIERS,
} from './public/stage/perf-gate.js';

const pass = verifyPerfGate(samplePerfGatePass());
const fail = verifyPerfGate({ fps: 90, tier: 2, rampSettled: true, samples: 64 });
const segments = effectiveOceanSegments({ settled: true, segments: 360 }, 2);
const fft = shouldUpdateOceanFft(4, 2);
const fftCap = effectiveFftResolution(128, 4);
const dpr4 = effectiveDpr(4, 2);
const rs4 = effectiveRenderScale(4);
const rs5 = effectiveRenderScale(5);
console.log('perf-gate:', JSON.stringify({ pass, fail, segments, fft, fftCap, dpr4, rs4, rs5, tiers: PERF_OCEAN_TIERS.length, target: STEADY_FPS_TARGET }, null, 2));
if (!pass.ok || fail.ok || segments !== 128 || !fft || fftCap !== 64 || dpr4 !== 0.5 || rs4 !== 0.45 || rs5 !== 0.35 || PERF_OCEAN_TIERS.length !== 6) process.exit(1);
console.log('OK: perf gate target', STEADY_FPS_TARGET, 'fps; tier caps ocean only');
"
