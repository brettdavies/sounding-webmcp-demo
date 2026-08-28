#!/usr/bin/env bash
# Verify placeholder-first boot marks and wiring.
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_root"

rg -q 'createBootPlaceholder|placeholderReady' public/stage/ocean-boot-sea.js
rg -q 'export function createBootPlaceholder' public/stage/boot-placeholder-stage.js
rg -q 'export function verifyPlaceholderBoot' public/stage/boot-placeholder.js

node --input-type=module -e "
import {
  verifyPlaceholderBoot,
  samplePlaceholderBudget,
  PLACEHOLDER_SYNC_BUDGET_MS,
} from './public/stage/boot-placeholder.js';

const sample = verifyPlaceholderBoot(samplePlaceholderBudget());
console.log('placeholder-boot:', JSON.stringify({ sample, budgetMs: PLACEHOLDER_SYNC_BUDGET_MS }, null, 2));
if (!sample.ok) process.exit(1);
console.log('OK: placeholder sync', sample.placeholderSyncMs, '<', sample.budgetMs, 'ms');
"
