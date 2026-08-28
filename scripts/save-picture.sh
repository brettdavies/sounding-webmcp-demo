#!/usr/bin/env bash
# Save a screenshot or image into .context/pictures with epoch prefix.
# Usage: scripts/save-picture.sh <slug> <source-file>
# Example: scripts/save-picture.sh qa-fallaway /tmp/cursor/screenshots/page.png
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

cp "$src" "$dest"
echo "$dest"
