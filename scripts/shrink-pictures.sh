#!/usr/bin/env bash
# Halve dimensions of existing .context/pictures (in place). Idempotent-ish: skips if already small.
# Usage: scripts/shrink-pictures.sh [glob-or-file ...]
# Default: all PNG/JPEG in .context/pictures/178789*.png (Aug-27 stage session captures).
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
dest_dir="$repo_root/.context/pictures"
scale="${SAVE_PICTURE_SCALE:-0.5}"
max_edge="${SHRINK_SKIP_IF_MAX_EDGE:-2300}"

shrink_one() {
  local f="$1"
  [[ -f "$f" ]] || return 0
  local w h nw nh
  w="$(sips -g pixelWidth "$f" 2>/dev/null | awk '/pixelWidth:/ {print $2}')"
  h="$(sips -g pixelHeight "$f" 2>/dev/null | awk '/pixelHeight:/ {print $2}')"
  [[ -n "$w" && -n "$h" ]] || return 0
  if [[ "$w" -le "$max_edge" && "$h" -le "$max_edge" ]]; then
    if [[ "${SHRINK_TO_JPEG:-1}" == "1" && "$f" == *.png ]]; then
      jf="${f%.png}.jpg"
      sips -s format jpeg -s formatOptions "${SAVE_PICTURE_JPEG_QUALITY:-82}" "$f" --out "$jf" >/dev/null
      rm -f "$f"
      echo "jpeg only: $jf ($(ls -lh "$jf" | awk '{print $5}'))"
      return 0
    fi
    echo "skip (already ≤${max_edge}px): $f (${w}x${h})"
    return 0
  fi
  nw="$(python3 -c "import math; print(max(1, int(round($w * $scale))))")"
  nh="$(python3 -c "import math; print(max(1, int(round($h * $scale))))")"
  sips -z "$nh" "$nw" "$f" >/dev/null
  if [[ "${SHRINK_TO_JPEG:-1}" == "1" && "$f" == *.png ]]; then
    jf="${f%.png}.jpg"
    sips -s format jpeg -s formatOptions "${SAVE_PICTURE_JPEG_QUALITY:-82}" "$f" --out "$jf" >/dev/null
    rm -f "$f"
    f="$jf"
  fi
  echo "shrunk ${w}x${h} → ${nw}x${nh}: $f ($(ls -lh "$f" | awk '{print $5}'))"
}

if [[ $# -gt 0 ]]; then
  for f in "$@"; do
    shrink_one "$f"
  done
else
  shopt -s nullglob
  for f in "$dest_dir"/178789*.png "$dest_dir"/178789*.jpg "$dest_dir"/178789*.jpeg; do
    shrink_one "$f"
  done
fi
