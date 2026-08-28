#!/usr/bin/env bash
# Verify QA capture plan and capture-qa-manifest.sh wiring.
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_root"

test -x scripts/capture-qa-manifest.sh
rg -q 'buildCapturePlan' public/stage/qa-manifest-verify.js

node --input-type=module -e "
import { readFileSync } from 'node:fs';
import {
  buildCapturePlan,
  verifyCapturePlan,
} from './public/stage/qa-manifest-verify.js';

const manifest = JSON.parse(readFileSync('docs/qa-manifest.json', 'utf8'));
const plan = buildCapturePlan(manifest);
const verify = verifyCapturePlan(plan);
console.log('capture-plan:', JSON.stringify({ verify, slugs: plan.captures.map((c) => c.slug) }, null, 2));
if (!verify.ok) process.exit(1);
console.log('OK: capture plan', verify.heroCount, 'hero views + stress + lowEnd');
"
