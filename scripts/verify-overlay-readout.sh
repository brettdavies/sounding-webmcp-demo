#!/usr/bin/env bash
# Verify overlay wave tag and authored view stay consistent across readout lines.
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_root"

rg -q 'overlayReadout|loop_t' public/stage/ocean-boot-sea.js
rg -q 'landOverlayReadout' public/stage/land-asset-boot.js
rg -q 'export function overlayReadout' public/stage/overlay-readout.js

node --input-type=module -e "
import { readFileSync } from 'node:fs';
import { assignBreakStyle, STAGE_BREAK_SEED } from './public/stage/break-style.js';
import { overlayReadout } from './public/stage/overlay-readout.js';

const reading = JSON.parse(readFileSync('src/data/mavericks-heat.json', 'utf8'));
const G = 9.81;
const directionDeg = reading.swell?.direction_deg ?? 285;
const rad = (directionDeg * Math.PI) / 180;
const dir = { x: Math.cos(rad), y: Math.sin(rad) };

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

function smoothPulse(dist, halfWindow) {
  if (dist >= halfWindow) return 0;
  const x = 1 - dist / halfWindow;
  return x * x * (3 - 2 * x);
}

function sampleAt(event, elapsed) {
  const halfWindow = event.kind === 'set' ? 4.2 : 3.2;
  const temporal = smoothPulse(Math.abs(elapsed - event.tPeak), halfWindow);
  return {
    active: temporal,
    face_m: event.face_m,
    label: event.label,
    kind: event.kind,
    breakStyle: event.breakStyle,
    periodS: reading.swell?.period_s ?? 18,
    directionDeg: directionDeg,
  };
}

const opener = events.find((e) => e.tPeak === 4);
const atOpener = sampleAt(opener, 4);
const reef = overlayReadout({
  setWave: atOpener,
  viewName: 'reef',
  eta: 8,
  reading,
});
const cliff = overlayReadout({
  setWave: atOpener,
  viewName: 'cliff',
  eta: 8,
  reading,
});

const ok =
  atOpener.active > 0.2 &&
  atOpener.label === 'opener' &&
  atOpener.breakStyle === 'spill' &&
  reef.view === 'reef' &&
  cliff.view === 'cliff' &&
  reef.wave.endsWith(' · reef') &&
  cliff.wave.endsWith(' · cliff') &&
  reef.heat.endsWith(' · reef') &&
  cliff.heat.endsWith(' · cliff') &&
  reef.wave.includes('opener · spill') &&
  reef.heat === 'heat · opener · spill · reef';

console.log('overlay-readout:', JSON.stringify({ ok, reef, cliffView: cliff.view }, null, 2));
if (!ok) process.exit(1);
console.log('OK: overlay view + wave tag consistent at opener · reef/cliff');
"
