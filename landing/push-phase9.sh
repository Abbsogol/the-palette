#!/bin/bash
set -e

echo "🔍 Finding the-palette repo..."

REPO=$(find ~ -name "CLAUDE.md" -path "*/the-palette/*" 2>/dev/null | head -1 | xargs dirname 2>/dev/null)

if [ -z "$REPO" ] || [ ! -d "$REPO/.git" ]; then
  REPO=$(find ~ -maxdepth 5 -name ".git" -type d 2>/dev/null | while read g; do
    dir=$(dirname "$g")
    if grep -q "the-palette" "$g/config" 2>/dev/null; then echo "$dir"; fi
  done | head -1)
fi

if [ -z "$REPO" ]; then
  echo "Enter path to the-palette repo (e.g. ~/the-palette or ~/Developer/the-palette):"
  read -r REPO
  REPO="${REPO/#\~/$HOME}"
fi

echo "✅ Found repo at: $REPO"

# Remove stale git lock file if present
rm -f "$REPO/.git/index.lock"
rm -f "$REPO/.git/COMMIT_EDITMSG.lock"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

cp "$SCRIPT_DIR/app/design/[id]/page.js"       "$REPO/app/design/[id]/page.js"
cp "$SCRIPT_DIR/app/search/page.js"             "$REPO/app/search/page.js"
cp "$SCRIPT_DIR/app/profile/page.js"            "$REPO/app/profile/page.js"
cp "$SCRIPT_DIR/components/ColourSwatches.js"   "$REPO/components/ColourSwatches.js"

cd "$REPO"
git add "app/design/[id]/page.js" "app/search/page.js" "app/profile/page.js" "components/ColourSwatches.js"
git commit -m "Phase 9: polish — hide empty brand fields, tap-to-copy hex, clickable tags, forgot password, display name on signup"
git push

echo ""
echo "🎉 Done! Vercel will deploy in ~60 seconds."
