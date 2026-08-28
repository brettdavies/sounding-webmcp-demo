#!/usr/bin/env bash
# Verify set-wave lip Jacobian foam exceeds spill at tube bomb crest.
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_root"

rg -q 'setWaveLipJacobian|setWaveTubeLipRing|setWaveFaceOnly' public/ocean/ocean-material.js
rg -q 'lipJacobianAt|lipFoamCompositeAt' public/stage/lip-foam-jacobian.js

node --input-type=module -e "
import { readFileSync } from 'node:fs';
import { extractPins } from './public/stage/mavericks-pins.js';
import { assignBreakStyle, breakStyleParams, STAGE_BREAK_SEED } from './public/stage/break-style.js';
import { normalizeBreakPolyline } from './public/stage/break-line-crest.js';
import {
  lipFoamCompositeAt,
  LIP_EPS_M,
} from './public/stage/lip-foam-jacobian.js';

const G = 9.81;
const reading = JSON.parse(readFileSync('src/data/mavericks-heat.json', 'utf8'));
const meta = JSON.parse(readFileSync('public/land/mavericks/meta.json', 'utf8'));
const pins = extractPins(meta);
const mooring = pins.buoyXz;
const polyline = normalizeBreakPolyline(pins.polyline);
const directionDeg = reading.swell?.direction_deg ?? 285;
const rad = (directionDeg * Math.PI) / 180;
const dir = { x: Math.cos(rad), y: Math.sin(rad) };
const buoyAlong = dir.x * mooring.x + dir.y * mooring.z;

/** @type {Array<{ kind: string, face_m: number, label: string, breakStyle: string, tPeak: number }>} */
const events = [];
let t = 4;
let idx = 0;
for (const set of reading.sets) {
  const isLull = set.label === 'lull';
  for (const face of set.faces_m) {
    const kind = isLull ? 'lull' : 'set';
    const face_m = isLull ? Math.min(face, 8.5) : face;
    const base = { kind, face_m, label: set.label };
    events.push({
      tPeak: t,
      ...base,
      breakStyle: assignBreakStyle(base, idx, STAGE_BREAK_SEED),
    });
    idx++;
    t += 6;
  }
  t += isLull ? 6.6 : 14.4;
}

const schedule = { dir, buoyAlong, polyline, seed: STAGE_BREAK_SEED };

function smoothPulse(dist, halfWindow) {
  if (dist >= halfWindow) return 0;
  const x = 1 - dist / halfWindow;
  return x * x * (3 - 2 * x);
}

function sampleAt(event, elapsed) {
  const halfWindow = event.kind === 'set' ? 4.2 : 3.2;
  const temporal = smoothPulse(Math.abs(elapsed - event.tPeak), halfWindow);
  const wavelength = Math.min(Math.max(120 + event.face_m * 4.5, 160), 240);
  const k = (Math.PI * 2) / wavelength;
  const omega = Math.sqrt(G * k);
  const phaseSpeed = omega / k;
  const amplitude = event.face_m * 1.05;
  const steepBase = Math.min(0.92, 1.1 / Math.max(k * amplitude, 1e-4));
  const style = breakStyleParams(/** @type {import('./public/stage/break-style.js').BreakStyle} */ (event.breakStyle));
  return {
    active: temporal,
    amplitude,
    steepness: Math.min(steepBase * style.steepMul, 1.15 / Math.max(k * amplitude, 1e-4)),
    width: wavelength * 0.24 * style.widthMul,
    crestAlong: buoyAlong + (elapsed - event.tPeak) * phaseSpeed,
    k,
    dir,
    lipSkew: style.lipSkew,
    tubeMix: style.tubeMix,
    horizMul: style.horizMul,
    breakStyle: event.breakStyle,
  };
}

const tubes = events.filter((e) => e.kind === 'set' && e.breakStyle === 'tube');
const spills = events.filter((e) => e.kind === 'set' && e.breakStyle === 'spill');
if (!tubes.length) {
  console.error('no tube events');
  process.exit(1);
}

const samples = [tubes[0], spills[0]].filter(Boolean).map((event) => ({
  style: event.breakStyle,
  ...lipFoamCompositeAt(sampleAt(event, event.tPeak), mooring.x, mooring.z, schedule),
}));

const tube = samples.find((s) => s.style === 'tube');
const spill = samples.find((s) => s.style === 'spill');
const ok = tube && tube.lipJ >= 0.1 && (!spill || tube.lipJ > spill.lipJ * 1.15);

console.log('lip-foam:', JSON.stringify({ ok, samples, epsM: LIP_EPS_M }, null, 2));
if (!ok) process.exit(1);
console.log('OK: lip Jacobian tube lipJ', tube.lipJ, 'spill', spill?.lipJ ?? 'n/a');
"
