#!/usr/bin/env bash
# Save a slice-evidence screenshot into .context/pictures (epoch prefix, 50% resize).
# Usage: scripts/save-picture.sh <slug> <source-file>
# Example: scripts/save-picture.sh break-style-plunge-reef /tmp/cursor/screenshots/page.png
#
# Screenshot contract (evidence gate — visual slices only):
# - Required only when the commit changes rendered output (scene, shader, UI, views).
# - Not required for rename-only, verify scripts, docs, or wiring with no visible delta.
# - When required: must show the committed change (not a random idle frame).
# - Slug names the proof; URL params in commit body must match the capture.
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "usage: $0 <slug> <source-file>" >&2
  exit 1
fi

slug="$1"
src="$2"
repo_root="$(cd "$(dirname "$0")/.." && pwd)"
dest_dir="$repo_root/.context/pictures"
epoch="$(date +%s)"
scale="${SAVE_PICTURE_SCALE:-0.5}"

if [[ ! -f "$src" ]]; then
  echo "source not found: $src" >&2
  exit 1
fi

ext="${src##*.}"
ext="$(printf '%s' "$ext" | tr '[:upper:]' '[:lower:]')"
case "$ext" in
  png | jpg | jpeg | webp | gif) ;;
  *)
    echo "unsupported extension: $ext" >&2
    exit 1
    ;;
esac

# Normalize slug: lowercase, no path segments
slug="${slug//\//-}"
slug="$(printf '%s' "$slug" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')"

dest="$dest_dir/${epoch}_${slug}.${ext}"
n=2
while [[ -e "$dest" ]]; do
  dest="$dest_dir/${epoch}_${slug}-${n}.${ext}"
  n=$((n + 1))
done

mkdir -p "$dest_dir"
cp "$src" "$dest"

if command -v sips >/dev/null 2>&1; then
  w="$(sips -g pixelWidth "$dest" 2>/dev/null | awk '/pixelWidth:/ {print $2}')"
  h="$(sips -g pixelHeight "$dest" 2>/dev/null | awk '/pixelHeight:/ {print $2}')"
  if [[ -n "$w" && -n "$h" && "$w" =~ ^[0-9]+$ && "$h" =~ ^[0-9]+$ ]]; then
    nw="$(python3 -c "import math; print(max(1, int(round($w * $scale))))")"
    nh="$(python3 -c "import math; print(max(1, int(round($h * $scale))))")"
    sips -z "$nh" "$nw" "$dest" >/dev/null
    echo "resized ${w}x${h} → ${nw}x${nh} (scale ${scale})" >&2
  fi
  if [[ "${SAVE_PICTURE_JPEG:-1}" == "1" && "$ext" == "png" ]]; then
    jdest="${dest%.png}.jpg"
    sips -s format jpeg -s formatOptions "${SAVE_PICTURE_JPEG_QUALITY:-82}" "$dest" --out "$jdest" >/dev/null
    rm -f "$dest"
    dest="$jdest"
    echo "encoded jpeg q${SAVE_PICTURE_JPEG_QUALITY:-82}" >&2
  fi
else
  echo "warn: sips not found; saved full size → $dest" >&2
fi

echo "$dest"
