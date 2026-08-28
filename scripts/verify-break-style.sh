#!/usr/bin/env bash
# Verify per-wave break styles (spill / plunge / tube) on heat schedule.
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_root"

node --input-type=module -e "
import { readFileSync } from 'node:fs';
import {
  assignBreakStyle,
  verifyBreakStyleDistribution,
  STAGE_BREAK_SEED,
} from './public/stage/break-style.js';

const reading = JSON.parse(readFileSync('src/data/mavericks-heat.json', 'utf8'));
/** @type {Array<{ kind: string, face_m: number, label: string, breakStyle: string }>} */
const events = [];
let idx = 0;
for (const set of reading.sets) {
  const isLull = set.label === 'lull';
  for (const face of set.faces_m) {
    const kind = isLull ? 'lull' : 'set';
    const face_m = isLull ? Math.min(face, 8.5) : face;
    const base = { kind, face_m, label: set.label };
    events.push({
      ...base,
      breakStyle: assignBreakStyle(base, idx, STAGE_BREAK_SEED),
    });
    idx++;
  }
}
const report = verifyBreakStyleDistribution(events, STAGE_BREAK_SEED);
console.log('break-style:', JSON.stringify(report, null, 2));
if (!report.ok) process.exit(1);
console.log('OK: break styles', report.counts, 'tubeOnBombs', report.tubeOnBombs + '/' + report.bombCount);
"
