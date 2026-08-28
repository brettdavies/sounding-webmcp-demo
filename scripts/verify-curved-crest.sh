#!/usr/bin/env bash
# Verify set-wave crest follows break_line.polyline (curved, not straight Gerstner).
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_root"

node --input-type=module -e "
import { readFileSync } from 'node:fs';
import { extractPins } from './public/stage/mavericks-pins.js';
import {
  verifyCurvedCrestOnPolyline,
  crestXiAt,
} from './public/stage/break-line-crest.js';

const meta = JSON.parse(readFileSync('public/land/mavericks/meta.json', 'utf8'));
const pins = extractPins(meta);
const rad = (pins.swellFromDeg * Math.PI) / 180;
const dir = { x: Math.cos(rad), y: Math.sin(rad) };
const buoyAlong = dir.x * pins.buoyXz.x + dir.y * pins.buoyXz.z;
const report = verifyCurvedCrestOnPolyline(pins.polyline, buoyAlong, dir);

const tail = pins.polyline[pins.polyline.length - 1];
const straight = dir.x * tail.x + dir.y * tail.z - buoyAlong;
const curved = crestXiAt(tail.x, tail.z, buoyAlong, buoyAlong, dir, pins.polyline);
const differsFromStraight = Math.abs(straight - curved) > 0.5;

console.log('curved-crest:', JSON.stringify({ ...report, tail, straightXi: Number(straight.toFixed(3)), curvedXi: Number(curved.toFixed(3)), differsFromStraight }, null, 2));
if (!report.ok || !differsFromStraight) process.exit(1);
console.log('OK: curved crest on', report.vertexCount, 'polyline verts');
"
