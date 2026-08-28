#!/usr/bin/env bash
# Verify default boot loads full sea stage; land-only requires ?focus=land.
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_root"

rg -q "focus === 'land'" public/stage/ocean-boot.js
rg -q "resolveBootMode" public/stage/ocean-boot.js
! rg -q "focus.*===.*'sea'" public/stage/ocean-boot.js || true

node --input-type=module -e "
import { resolveBootMode } from './public/stage/boot-mode.js';

const cases = [
  ['', 'sea'],
  ['focus=sea', 'sea'],
  ['focus=land', 'land'],
  ['view=reef', 'sea'],
  ['focus=land&view=fallaway', 'land'],
];

for (const [query, expected] of cases) {
  const mode = resolveBootMode(new URLSearchParams(query));
  if (mode !== expected) {
    console.error('FAIL:', query, 'expected', expected, 'got', mode);
    process.exit(1);
  }
}
console.log('OK: default boot mode sea; focus=land → land');
"
