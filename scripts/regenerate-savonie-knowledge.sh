#!/bin/bash
# Regenerate Savonie knowledge artifacts from site content
# Run this after significant site changes to keep Savonie up-to-date
#
# Usage: bash scripts/regenerate-savonie-knowledge.sh
# Requires: pdftotext (poppler-utils), node

set -e

echo "=== Regenerating Savonie Knowledge Artifacts ==="
echo ""

# 1. Extract PDF text
echo "1. Extracting PDF text..."
mkdir -p assets/data/pdf-knowledge

for pdf in assets/docs/*.pdf; do
  [ -f "$pdf" ] || continue
  base=$(basename "$pdf" .pdf)
  pdftotext -layout "$pdf" "assets/data/pdf-knowledge/${base}.txt" 2>/dev/null
  echo "   Extracted: $base"
done

for pdf in assets/img/Portolio-Media/Portfolio-Media/projects-/*.pdf; do
  [ -f "$pdf" ] || continue
  base=$(basename "$pdf" .pdf)
  pdftotext "$pdf" "assets/data/pdf-knowledge/${base}.txt" 2>/dev/null
  echo "   Extracted: $base"
done

# 2. Regenerate site facts (if script exists)
if [ -f scripts/generate-site-facts.js ]; then
  echo ""
  echo "2. Regenerating site facts..."
  node scripts/generate-site-facts.js 2>/dev/null || echo "   (site-facts generation requires server - skipping)"
fi

# 3. Regenerate chat grounding manifest (if script exists)
if [ -f scripts/generate-chat-grounding.mjs ]; then
  echo ""
  echo "3. Regenerating chat grounding manifest..."
  node scripts/generate-chat-grounding.mjs 2>/dev/null || echo "   (grounding generation requires server - skipping)"
fi

echo ""
echo "=== Knowledge regeneration complete ==="
echo "Next steps:"
echo "  1. Review changes in assets/data/"
echo "  2. Commit and push"
echo "  3. Worker will auto-deploy via GitHub Actions if CLOUDFLARE_API_TOKEN is set"
