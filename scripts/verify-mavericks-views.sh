#!/usr/bin/env bash
# Verify MAVERICKS_VIEWS MHHW invariants against meta.json pins.
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_root"

node --input-type=module -e "
import { readFileSync } from 'node:fs';
import { extractPins } from './public/stage/mavericks-pins.js';
import { buildViewsForPins } from './public/stage/mavericks-views-build.js';
import { verifyMavericksViews } from './public/stage/mavericks-views-verify.js';

const meta = JSON.parse(readFileSync('public/land/mavericks/meta.json', 'utf8'));
const pins = extractPins(meta);
const views = buildViewsForPins(pins);
const report = verifyMavericksViews(views, pins);
console.log('mavericks-views:', JSON.stringify(report, null, 2));
if (!report.ok) process.exit(1);
console.log('OK: all', report.views.length, 'views verified at MHHW', report.mslY);
"
