#!/usr/bin/env bash
# Link the shared agent config so Claude Code sees the same skills as Antigravity.
# Source of truth: .agents/skills  ->  .claude/skills (symlink)
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

mkdir -p .claude
if [ -e .claude/skills ] && [ ! -L .claude/skills ]; then
  echo ".claude/skills exists and is not a symlink; move it aside first." >&2
  exit 1
fi
ln -sfn ../.agents/skills .claude/skills
echo "linked .claude/skills -> ../.agents/skills"
