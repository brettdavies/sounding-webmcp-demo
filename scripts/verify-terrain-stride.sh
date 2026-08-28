#!/usr/bin/env bash
# Verify terrainStride:1 only — no subsampling LOD on Mavericks DEM mesh.
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_root"

banned=(
  'terrainStride[^=]*[=:][[:space:]]*[2-9]'
  'terrainStride[^=]*[=:][[:space:]]*[1-9][0-9]'
  'terrainLOD'
  'coarsenTerrain'
  'subsample.*height'
  'heightSkip'
)

failed=0
for pat in "${banned[@]}"; do
  if rg -q "$pat" public/stage public/land 2>/dev/null; then
    echo "FAIL: banned terrain subsampling pattern '$pat'" >&2
    rg -n "$pat" public/stage public/land 2>/dev/null || true
    failed=1
  fi
done

node --input-type=module -e "
import { readFileSync } from 'node:fs';
import { auditDemMesh, TERRAIN_STRIDE } from './public/stage/mavericks-dem-audit.js';

const meta = JSON.parse(readFileSync('public/land/mavericks/meta.json', 'utf8'));
const buf = readFileSync('public/land/mavericks/height.f32');
const heights = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
const report = auditDemMesh(heights, meta, TERRAIN_STRIDE);
console.log('terrain-stride:', JSON.stringify(report, null, 2));
if (!report.ok) process.exit(1);
console.log('OK: terrainStride', report.stride, 'maxSlopeDeg', report.maxSlopeDeg);
"

if [[ $failed -ne 0 ]]; then
  exit 1
fi
