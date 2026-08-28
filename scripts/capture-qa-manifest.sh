#!/usr/bin/env bash
# P4 QA capture — default boot: 4 hero views + stress + low-end tier (<20 s load budget).
# Usage: BASE_URL=http://localhost:8787 ./scripts/capture-qa-manifest.sh
# Saves via scripts/save-picture.sh when SCREENSHOT_DIR contains qa-* files.
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_root"

base_url="${BASE_URL:-http://localhost:8787}"
plan_json="$(node --input-type=module -e "
import { readFileSync } from 'node:fs';
import { buildCapturePlan } from './public/stage/qa-manifest-verify.js';
const manifest = JSON.parse(readFileSync('docs/qa-manifest.json', 'utf8'));
console.log(JSON.stringify(buildCapturePlan(manifest)));
")"

budget_sec="$(printf '%s' "$plan_json" | node -e "process.stdout.write(String(JSON.parse(require('fs').readFileSync(0,'utf8')).budgetSec))")"

echo "QA capture manifest: docs/qa-manifest.json (budget ${budget_sec}s)"
echo "Default boot — open each URL and save with scripts/save-picture.sh:"

start_ms="$(python3 -c 'import time; print(int(time.time()*1000))')"
loaded=0

while IFS=$'\t' read -r slug url kind; do
  [[ -z "$slug" ]] && continue
  full="${base_url}${url}"
  echo "  ${full}  →  ${slug}  (${kind})"
  if curl -sf -o /dev/null --max-time 8 "$full"; then
    loaded=$((loaded + 1))
  else
    echo "warn: load failed ${full}" >&2
  fi
done < <(printf '%s' "$plan_json" | node -e "
const plan = JSON.parse(require('fs').readFileSync(0,'utf8'));
for (const c of plan.captures) {
  process.stdout.write(c.slug + '\t' + c.url + '\t' + c.kind + '\n');
}
")

end_ms="$(python3 -c 'import time; print(int(time.time()*1000))')"
elapsed="$(((end_ms - start_ms) / 1000))"
echo "Loaded ${loaded} URLs in ${elapsed}s (budget ${budget_sec}s)"

if [[ "$elapsed" -gt "$budget_sec" ]]; then
  echo "FAIL: capture load budget exceeded ${budget_sec}s" >&2
  exit 1
fi

if [[ -n "${SCREENSHOT_DIR:-}" && -d "$SCREENSHOT_DIR" ]]; then
  while IFS= read -r slug; do
    [[ -z "$slug" ]] && continue
    src="$(find "$SCREENSHOT_DIR" -maxdepth 1 -name "*${slug}*" -type f 2>/dev/null | head -1)"
    if [[ -n "$src" ]]; then
      "$repo_root/scripts/save-picture.sh" "$slug" "$src"
    fi
  done < <(printf '%s' "$plan_json" | node -e "
const plan = JSON.parse(require('fs').readFileSync(0,'utf8'));
for (const c of plan.captures) console.log(c.slug);
")
fi

echo "OK: QA capture plan — ${loaded} views loaded within ${elapsed}s"
