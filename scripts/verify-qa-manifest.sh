#!/usr/bin/env bash
# Verify docs/qa-manifest.json — default boot URLs and hero views (P4).
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_root"

test -f docs/qa-manifest.json
rg -q '"defaultBoot": true' docs/qa-manifest.json
rg -q '"heroViews"' docs/qa-manifest.json
! rg -q 'focus=sea' docs/qa-manifest.json

node --input-type=module -e "
import { readFileSync } from 'node:fs';
import { resolveBootMode } from './public/stage/boot-mode.js';
import {
  verifyQaManifest,
  buildQaUrl,
  sampleQaManifestUrls,
} from './public/stage/qa-manifest-verify.js';

const manifest = JSON.parse(readFileSync('docs/qa-manifest.json', 'utf8'));
const report = verifyQaManifest(manifest);
const urls = sampleQaManifestUrls(manifest);
const bootMode = resolveBootMode(new URLSearchParams('view=reef&seed=46012'));
const bootModeBare = resolveBootMode(new URLSearchParams(''));

console.log('qa-manifest:', JSON.stringify({ report, urls, bootMode, bootModeBare }, null, 2));

if (!report.ok || bootMode !== 'sea' || bootModeBare !== 'sea') process.exit(1);
if (!urls.fallaway.startsWith('/?view=fallaway')) process.exit(1);
console.log('OK: default boot QA manifest — hero', report.heroViews.join(', '));
"
