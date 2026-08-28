#!/usr/bin/env bash
# Verify layer-controls URL parsing and boot wiring.
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_root"

rg -q 'createLayerPanel|layer-controls' public/stage/ocean-boot-sea.js
rg -q 'createLayerPanel|layer-controls' public/stage/land-asset-boot.js
rg -q 'export function parseLayerUrl' public/stage/layer-controls.js
rg -q 'nopanel|panel=0' public/stage/layer-controls.js

node --input-type=module -e "
import { verifyLayerControls, layerStateFromUrl } from './public/stage/layer-controls.js';

const verify = verifyLayerControls();
const land = layerStateFromUrl(new URLSearchParams('no=spray'), ['terrain', 'spray']);
console.log('layer-controls:', JSON.stringify({ verify, land }, null, 2));
if (!verify.ok || land.spray !== false || land.terrain !== true) process.exit(1);
console.log('OK: layer URL parse + nopanel/no=heat legacy');
"
