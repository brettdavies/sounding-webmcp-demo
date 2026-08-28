#!/usr/bin/env bash
# Verify all .cursor/skills/*/ entries are referenced in threejs-skill-router.
# Exit 0 when inventory is complete (35/35).
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
skills_dir="$repo_root/.cursor/skills"
router="$skills_dir/threejs-skill-router/SKILL.md"

if [[ ! -f "$router" ]]; then
  echo "router not found: $router" >&2
  exit 1
fi

mapfile -t all_skills < <(find "$skills_dir" -mindepth 1 -maxdepth 1 -type d ! -name '.*' -exec basename {} \; | sort)
mapfile -t routed_skills < <(grep -oE '\$[a-z0-9-]+' "$router" | tr -d '$' | sort -u)

missing=()
for skill in "${all_skills[@]}"; do
  if ! printf '%s\n' "${routed_skills[@]}" | grep -qx "$skill"; then
    missing+=("$skill")
  fi
done

orphan=()
for skill in "${routed_skills[@]}"; do
  if [[ ! -d "$skills_dir/$skill" ]]; then
    orphan+=("$skill")
  fi
done

total="${#all_skills[@]}"
routed_count="${#routed_skills[@]}"

echo "skill-router-inventory: ${total} skill dirs, ${routed_count} routed references"

if [[ ${#missing[@]} -gt 0 ]]; then
  echo "MISSING from router:" >&2
  printf '  - %s\n' "${missing[@]}" >&2
fi

if [[ ${#orphan[@]} -gt 0 ]]; then
  echo "ORPHAN references (no skill dir):" >&2
  printf '  - %s\n' "${orphan[@]}" >&2
fi

if [[ ${#missing[@]} -eq 0 && ${#orphan[@]} -eq 0 ]]; then
  echo "OK: complete inventory (${total}/${total})"
  exit 0
fi

exit 1
