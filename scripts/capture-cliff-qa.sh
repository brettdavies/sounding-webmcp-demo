#!/usr/bin/env bash
# Capture cliff QA hero views (requires dev server on :8787 and manual screenshot tool).
# Usage: BASE_URL=http://localhost:8787 ./scripts/capture-cliff-qa.sh
# Saves via scripts/save-picture.sh when SCREENSHOT_DIR contains cliff-qa-*.png files.
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_root"

base_url="${BASE_URL:-http://localhost:8787}"
views=(fallaway cliff shore reef)

echo "Cliff QA capture manifest: docs/cliff-qa-manifest.json"
echo "Open each URL and save screenshot with scripts/save-picture.sh:"
for view in "${views[@]}"; do
  echo "  ${base_url}/?focus=sea&view=${view}&seed=46012  →  cliff-qa-${view}"
done

if [[ -n "${SCREENSHOT_DIR:-}" && -d "$SCREENSHOT_DIR" ]]; then
  for view in "${views[@]}"; do
    src="$(find "$SCREENSHOT_DIR" -maxdepth 1 -name "*cliff-qa-${view}*" -type f 2>/dev/null | head -1)"
    if [[ -n "$src" ]]; then
      "$repo_root/scripts/save-picture.sh" "cliff-qa-${view}" "$src"
    fi
  done
fi
