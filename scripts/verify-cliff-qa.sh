#!/usr/bin/env bash
# Verify cliff hero views: DEM max slope + per-view corridor steepness (P0b gate).
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_root"

node --input-type=module -e "
import { readFileSync } from 'node:fs';
import { extractPins } from './public/stage/mavericks-pins.js';
import { buildViewsForPins } from './public/stage/mavericks-views-build.js';
import { verifyCliffHeroViews } from './public/stage/mavericks-cliff-qa.js';

const meta = JSON.parse(readFileSync('public/land/mavericks/meta.json', 'utf8'));
const pins = extractPins(meta);
const views = buildViewsForPins(pins);
const buf = readFileSync('public/land/mavericks/height.f32');
const heights = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
const report = verifyCliffHeroViews(heights, meta, views, pins.mslY);
console.log('cliff-qa:', JSON.stringify(report, null, 2));
if (!report.ok) process.exit(1);
console.log('OK: cliff hero views', report.views.join(', '), 'demMaxSlopeDeg', report.demMaxSlopeDeg);
"
