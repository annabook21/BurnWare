#!/bin/bash
# Pre-commit hook to enforce 500-line limit
# Install: cp .pre-commit-hook.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit

set -e

echo "Checking file sizes..."

# Get all staged TypeScript files
FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|tsx)$' || true)

if [ -z "$FILES" ]; then
  echo "No TypeScript files to check"
  exit 0
fi

FAILED=0

for FILE in $FILES; do
  if [ -f "$FILE" ]; then
    LINES=$(wc -l < "$FILE" | tr -d ' ')
    
    if [ "$LINES" -gt 500 ]; then
      echo "❌ ERROR: $FILE exceeds 500 lines ($LINES lines)"
      echo "   Please refactor into smaller modules before committing."
      FAILED=1
    elif [ "$LINES" -gt 450 ]; then
      echo "⚠️  WARNING: $FILE is approaching limit ($LINES lines)"
      echo "   Consider refactoring soon."
    else
      echo "✓ $FILE: $LINES lines"
    fi
  fi
done

if [ $FAILED -eq 1 ]; then
  echo ""
  echo "Commit rejected: Files exceed 500-line limit"
  echo "See MODULARIZATION.md for refactoring guidance"
  exit 1
fi

echo "✓ All files under 500 lines"
exit 0
