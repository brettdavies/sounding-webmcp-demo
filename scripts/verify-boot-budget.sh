#!/usr/bin/env bash
# Verify boot-budget marks shape and ordering gate.
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_root"

rg -q 'createBootBudget|bootBudget' public/stage/ocean-boot-sea.js
rg -q 'createBootBudget|bootBudget' public/stage/land-asset-boot.js
rg -q '__soundingBoot' public/stage/ocean-boot-sea.js public/stage/land-asset-boot.js
rg -q 'export function createBootBudget' public/stage/boot-budget.js

node --input-type=module -e "
import {
  verifyBootBudget,
  sampleBootBudgetSnapshot,
} from './public/stage/boot-budget.js';

const sea = verifyBootBudget(sampleBootBudgetSnapshot('sea'));
const land = verifyBootBudget(sampleBootBudgetSnapshot('land'));
console.log('boot-budget:', JSON.stringify({ sea, land }, null, 2));
if (!sea.ok || !land.ok) process.exit(1);
console.log('OK: boot marks firstFrame', sea.firstFrameMs, 'fullyReady', sea.fullyReadyMs);
"
