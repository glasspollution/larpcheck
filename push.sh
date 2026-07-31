#!/usr/bin/env bash
# One-shot: initialise, commit, and push larpcheck to GitHub.
set -euo pipefail

REMOTE="https://github.com/glasspollution/larpcheck.git"

[ -f skills/larpcheck/SKILL.md ] || { echo "Run this from inside the larpcheck folder."; exit 1; }

git init -q 2>/dev/null || true
git add -A
git commit -qm "larpcheck v0.1 — LARP Ratio audit skill, terminal renderer, ledger" || echo "(nothing new to commit)"
git branch -M main
git remote remove origin 2>/dev/null || true
git remote add origin "$REMOTE"

echo "Pushing to $REMOTE"
git push -u origin main

echo
echo "Done. Now install and test:"
echo "  npx skills add glasspollution/larpcheck --agent claude-code codex cursor --global --yes"
echo "  then run /larpcheck inside the agent"
