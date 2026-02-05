#!/usr/bin/env python3
"""
Local Memory SessionStart Hook

Injects helpful context about the local-memory plugin at session start.
Provides information about available MCP tools and plugin capabilities.
"""

import json
import sys
import os
from pathlib import Path


def load_settings(cwd: str) -> dict:
    """Load settings from .claude/local-memory.local.md YAML frontmatter."""
    settings = {
        'threshold': 2,
        'autoGenerate': True
    }

    settings_file = Path(cwd) / '.claude' / 'local-memory.local.md'

    if not settings_file.exists():
        return settings

    try:
        with open(settings_file, 'r', encoding='utf-8') as f:
            content = f.read()

        import re
        # Extract autoGenerate
        match = re.search(r'autoGenerate:\s*(true|false)', content, re.IGNORECASE)
        if match:
            settings['autoGenerate'] = match.group(1).lower() == 'true'

        # Extract threshold
        match = re.search(r'threshold:\s*(\d+)', content)
        if match:
            settings['threshold'] = int(match.group(1))

    except Exception:
        pass

    return settings


def main():
    """Main entry point for the SessionStart hook."""
    try:
        # Read hook input from stdin
        input_data = json.load(sys.stdin)

        cwd = input_data.get('cwd', '.')
        source = input_data.get('source', 'startup')

        # Load settings
        settings = load_settings(cwd)

        # Build context message
        context_parts = []

        # Only show full context on new sessions, brief on resume
        if source == 'startup':
            context_parts.append("📝 **local-memory Plugin Active**")
            context_parts.append("")
            context_parts.append("This plugin helps maintain directory-level CLAUDE.md context files.")
            context_parts.append("")
            context_parts.append("**Available MCP Tools:**")
            context_parts.append("- `mcp__plugin_local-memory_local-memory__analyze_directory` - Analyze directory structure and dependencies")
            context_parts.append("- `mcp__plugin_local-memory_local-memory__generate_context` - Generate CLAUDE.md content for a directory")
            context_parts.append("- `mcp__plugin_local-memory_local-memory__write_context` - Write/update CLAUDE.md with smart merge")
            context_parts.append("- `mcp__plugin_local-memory_local-memory__list_context_files` - List all CLAUDE.md files in project")
            context_parts.append("")

            if settings['autoGenerate']:
                context_parts.append(f"**Auto-Generation:** Enabled (threshold: {settings['threshold']} files in same directory)")
                context_parts.append("The Stop hook will suggest building context when you edit multiple files in the same directory.")
            else:
                context_parts.append("**Auto-Generation:** Disabled")
                context_parts.append("Use `/build-context` command or MCP tools manually to build context.")

            context_parts.append("")
            context_parts.append("💡 Use MCP tools to document modules as you work through the codebase.")

        elif source == 'resume':
            # Brief reminder on resume
            context_parts.append("📝 local-memory plugin active (MCP tools available for context building)")

        # Return context
        if context_parts:
            result = {
                "hookSpecificOutput": {
                    "hookEventName": "SessionStart",
                    "additionalContext": "\n".join(context_parts)
                }
            }
            print(json.dumps(result))

        sys.exit(0)

    except Exception as e:
        # On error, exit silently (don't block session start)
        sys.exit(0)


if __name__ == '__main__':
    main()
