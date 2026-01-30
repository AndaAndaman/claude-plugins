#!/bin/bash
# Directory analysis utility for pattern detection
# Usage: bash analyze-directory.sh <directory>

set -euo pipefail

DIRECTORY="${1:-.}"

if [ ! -d "$DIRECTORY" ]; then
  echo "{\"error\": \"Directory not found: $DIRECTORY\"}" >&2
  exit 1
fi

# Count files by extension
echo "{"
echo "  \"directory\": \"$DIRECTORY\","

# File types
echo "  \"fileTypes\": {"
find "$DIRECTORY" -maxdepth 1 -type f | sed 's/.*\.//' | sort | uniq -c | \
  awk '{printf "    \"%s\": %d,\n", $2, $1}' | sed '$ s/,$//'
echo "  },"

# Total files
TOTAL_FILES=$(find "$DIRECTORY" -maxdepth 1 -type f | wc -l)
echo "  \"totalFiles\": $TOTAL_FILES,"

# Detect primary language
PRIMARY_LANG="unknown"
if find "$DIRECTORY" -maxdepth 1 -name "*.ts" -o -name "*.tsx" | head -1 | grep -q .; then
  PRIMARY_LANG="typescript"
elif find "$DIRECTORY" -maxdepth 1 -name "*.js" -o -name "*.jsx" | head -1 | grep -q .; then
  PRIMARY_LANG="javascript"
elif find "$DIRECTORY" -maxdepth 1 -name "*.py" | head -1 | grep -q .; then
  PRIMARY_LANG="python"
elif find "$DIRECTORY" -maxdepth 1 -name "*.go" | head -1 | grep -q .; then
  PRIMARY_LANG="go"
elif find "$DIRECTORY" -maxdepth 1 -name "*.cs" | head -1 | grep -q .; then
  PRIMARY_LANG="csharp"
fi
echo "  \"primaryLanguage\": \"$PRIMARY_LANG\","

# Detect patterns
echo "  \"patterns\": {"

# Has tests
HAS_TESTS="false"
if find "$DIRECTORY" -maxdepth 1 -name "*.test.*" -o -name "*.spec.*" | head -1 | grep -q .; then
  HAS_TESTS="true"
fi
echo "    \"hasTests\": $HAS_TESTS,"

# Has types
HAS_TYPES="false"
if find "$DIRECTORY" -maxdepth 1 -name "types.ts" -o -name "*.d.ts" | head -1 | grep -q .; then
  HAS_TYPES="true"
fi
echo "    \"hasTypes\": $HAS_TYPES,"

# Has index file
HAS_INDEX="false"
if [ -f "$DIRECTORY/index.ts" ] || [ -f "$DIRECTORY/index.js" ] || [ -f "$DIRECTORY/index.py" ]; then
  HAS_INDEX="true"
fi
echo "    \"hasIndex\": $HAS_INDEX"

echo "  },"

# Import analysis (basic)
echo "  \"imports\": {"
INTERNAL_COUNT=0
EXTERNAL_COUNT=0

if [ "$PRIMARY_LANG" = "typescript" ] || [ "$PRIMARY_LANG" = "javascript" ]; then
  INTERNAL_COUNT=$(grep -r "from ['\"]\./" "$DIRECTORY" 2>/dev/null | wc -l || echo 0)
  EXTERNAL_COUNT=$(grep -r "from ['\"][^./]" "$DIRECTORY" 2>/dev/null | wc -l || echo 0)
elif [ "$PRIMARY_LANG" = "python" ]; then
  INTERNAL_COUNT=$(grep -r "from \." "$DIRECTORY" 2>/dev/null | wc -l || echo 0)
  EXTERNAL_COUNT=$(grep -r "^import \|^from [a-z]" "$DIRECTORY" 2>/dev/null | wc -l || echo 0)
fi

echo "    \"internalImports\": $INTERNAL_COUNT,"
echo "    \"externalImports\": $EXTERNAL_COUNT"
echo "  }"

echo "}"
