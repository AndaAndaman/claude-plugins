#!/bin/bash
# Stop hook for local-memory plugin
# Analyzes conversation history to detect if CLAUDE.md files should be generated

set -euo pipefail

# Read hook input from stdin
INPUT=$(cat)

# Extract fields from JSON input
TRANSCRIPT_PATH=$(echo "$INPUT" | jq -r '.transcript_path // ""')
CWD=$(echo "$INPUT" | jq -r '.cwd // "."')

# Default settings
THRESHOLD=2
AUTO_GENERATE=true
MAX_FILES=50
EXCLUDED_DIRS=(
  "node_modules" "vendor" "packages"
  ".git" ".svn" ".hg" ".bzr"
  "dist" "build" "out" "target" "bin" "obj"
  "test" "tests" "spec" "specs" "__tests__" "__snapshots__"
  "coverage" ".next" ".nuxt" ".angular" "__pycache__"
  "temp" "tmp" "cache"
)

# Check for settings file
SETTINGS_FILE="$CWD/.claude/local-memory.local.md"
if [ -f "$SETTINGS_FILE" ]; then
  # Extract YAML frontmatter settings
  if grep -q "^---$" "$SETTINGS_FILE"; then
    # Extract autoGenerate
    AUTO_GEN_LINE=$(sed -n '/^---$/,/^---$/p' "$SETTINGS_FILE" | grep "autoGenerate:" || echo "")
    if [ -n "$AUTO_GEN_LINE" ]; then
      AUTO_GENERATE=$(echo "$AUTO_GEN_LINE" | sed 's/autoGenerate://;s/[[:space:]]//g')
    fi

    # Extract threshold
    THRESHOLD_LINE=$(sed -n '/^---$/,/^---$/p' "$SETTINGS_FILE" | grep "threshold:" || echo "")
    if [ -n "$THRESHOLD_LINE" ]; then
      THRESHOLD=$(echo "$THRESHOLD_LINE" | sed 's/threshold://;s/[[:space:]]//g')
    fi

    # Extract maxFilesAnalyzed
    MAX_LINE=$(sed -n '/^---$/,/^---$/p' "$SETTINGS_FILE" | grep "maxFilesAnalyzed:" || echo "")
    if [ -n "$MAX_LINE" ]; then
      MAX_FILES=$(echo "$MAX_LINE" | sed 's/maxFilesAnalyzed://;s/[[:space:]]//g')
    fi

    # Extract excludedDirectories (basic - just add to array)
    EXCLUDED_LINE=$(sed -n '/^---$/,/^---$/p' "$SETTINGS_FILE" | grep -A 20 "excludedDirectories:" || echo "")
    if [ -n "$EXCLUDED_LINE" ]; then
      while IFS= read -r line; do
        if [[ "$line" =~ ^[[:space:]]*-[[:space:]]*(.+)$ ]]; then
          EXCLUDED_DIRS+=("${BASH_REMATCH[1]}")
        fi
      done < <(echo "$EXCLUDED_LINE" | grep "^[[:space:]]*-")
    fi
  fi
fi

# If autoGenerate is false, exit without blocking
if [ "$AUTO_GENERATE" = "false" ]; then
  exit 0
fi

# Analyze transcript for Edit/Write operations
if [ -z "$TRANSCRIPT_PATH" ] || [ ! -f "$TRANSCRIPT_PATH" ]; then
  # No transcript, can't analyze
  exit 0
fi

# Find all Edit and Write tool calls in transcript
# Look for patterns like: <invoke name="Edit"> or <invoke name="Write">
# Extract file_path from parameters

# Use a temporary associative array to count files per directory
declare -A dir_counts

# Parse transcript for Edit/Write operations
while IFS= read -r line; do
  # Extract file paths from Edit/Write tool invocations
  if echo "$line" | grep -q '<parameter name="file_path">'; then
    FILE_PATH=$(echo "$line" | sed 's/.*<parameter name="file_path">\(.*\)<\/antml:parameter>.*/\1/')

    # Convert to relative path from CWD if needed
    if [[ "$FILE_PATH" == "$CWD"* ]]; then
      FILE_PATH="${FILE_PATH#$CWD/}"
    fi

    # Get parent directory
    DIR_PATH=$(dirname "$FILE_PATH")

    # Skip if directory is in exclusion list
    SKIP=false
    for excluded in "${EXCLUDED_DIRS[@]}"; do
      if [[ "$DIR_PATH" == *"$excluded"* ]]; then
        SKIP=true
        break
      fi
    done

    if [ "$SKIP" = false ]; then
      # Increment count for this directory
      if [ -z "${dir_counts[$DIR_PATH]+x}" ]; then
        dir_counts[$DIR_PATH]=1
      else
        dir_counts[$DIR_PATH]=$((dir_counts[$DIR_PATH] + 1))
      fi
    fi
  fi
done < "$TRANSCRIPT_PATH"

# Find directories that meet threshold
CANDIDATE_DIRS=()
for dir in "${!dir_counts[@]}"; do
  count=${dir_counts[$dir]}
  if [ "$count" -ge "$THRESHOLD" ]; then
    CANDIDATE_DIRS+=("$dir:$count")
  fi
done

# If no directories meet threshold, allow stop
if [ ${#CANDIDATE_DIRS[@]} -eq 0 ]; then
  exit 0
fi

# Build directories list for agent invocation
DIRS_JSON="["
first=true
for entry in "${CANDIDATE_DIRS[@]}"; do
  dir="${entry%:*}"
  if [ "$first" = true ]; then
    first=false
  else
    DIRS_JSON+=", "
  fi
  DIRS_JSON+="\"$dir\""
done
DIRS_JSON+="]"

# Build human-readable summary
SUMMARY=""
for entry in "${CANDIDATE_DIRS[@]}"; do
  dir="${entry%:*}"
  count="${entry#*:}"
  if [ -n "$SUMMARY" ]; then
    SUMMARY+=", "
  fi
  SUMMARY+="$dir ($count files)"
done

# Return decision to block stop and suggest MCP tools
# Hook suggests which MCP tools Claude should use
# Use Python to properly escape JSON strings
REASON="Detected file changes in $SUMMARY.

Use local-memory MCP tools to build context:
1. For each directory in $DIRS_JSON:
   - Call: use_mcp_tool(\"mcp__plugin_local-memory_local-memory__analyze_directory\", {\"directory\": \"<dir>\", \"project_root\": \"$CWD\"})
   - Call: use_mcp_tool(\"mcp__plugin_local-memory_local-memory__generate_context\", {\"directory\": \"<dir>\", \"project_root\": \"$CWD\"})
   - Call: use_mcp_tool(\"mcp__plugin_local-memory_local-memory__write_context\", {\"directory\": \"<dir>\", \"content\": \"<generated_content>\"})

This will create CLAUDE.md files documenting the modules you worked on."

# Properly escape JSON using Python
ESCAPED_REASON=$(printf '%s' "$REASON" | python -c "import sys,json; print(json.dumps(sys.stdin.read()))" 2>/dev/null || printf '%s' "$REASON")

cat <<EOF
{
  "decision": "block",
  "reason": $ESCAPED_REASON
}
EOF
