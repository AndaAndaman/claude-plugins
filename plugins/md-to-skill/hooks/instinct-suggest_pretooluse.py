#!/usr/bin/env python3
"""
md-to-skill PreToolUse Hook - Instinct Suggestion

Proactively suggests actions based on auto-approved instincts when tool use
matches instinct triggers. Never blocks execution.

Hooks on: Write|Edit|Bash|Read
"""

import json
import sys
import os
import re
import fnmatch
from datetime import datetime

# Try to import shared utilities from hook_utils (created by Package 1)
try:
    from hook_utils import parse_frontmatter, setup_plugin_path, load_hook_input
    HOOK_UTILS_AVAILABLE = True
except ImportError:
    HOOK_UTILS_AVAILABLE = False

# Fallback: setup plugin path manually if hook_utils not available
if HOOK_UTILS_AVAILABLE:
    setup_plugin_path()
else:
    PLUGIN_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if PLUGIN_ROOT not in sys.path:
        sys.path.insert(0, PLUGIN_ROOT)

try:
    from config.config_loader import load_config, get_instinct_config
    CONFIG_AVAILABLE = True
except ImportError:
    CONFIG_AVAILABLE = False


def parse_instinct_frontmatter(content: str) -> dict:
    """Parse YAML frontmatter from an instinct markdown file.
    Fallback when hook_utils is not available."""
    if HOOK_UTILS_AVAILABLE:
        return parse_frontmatter(content)

    match = re.search(r'^---\s*\n(.*?)\n---', content, re.DOTALL | re.MULTILINE)
    if not match:
        return {}

    frontmatter_text = match.group(1)
    result = {}

    for line in frontmatter_text.split('\n'):
        line = line.strip()
        if not line or ':' not in line:
            continue

        key, _, value = line.partition(':')
        key = key.strip()
        value = value.strip()

        # Strip quotes
        if value.startswith('"') and value.endswith('"'):
            value = value[1:-1]
        elif value.startswith("'") and value.endswith("'"):
            value = value[1:-1]

        # Type conversions
        if value.lower() == 'true':
            result[key] = True
        elif value.lower() == 'false':
            result[key] = False
        elif re.match(r'^\d+$', value):
            result[key] = int(value)
        elif re.match(r'^\d+\.\d+$', value):
            result[key] = float(value)
        else:
            result[key] = value

    return result


def extract_action(content: str) -> str:
    """Extract the Action section from an instinct file."""
    match = re.search(r'## Action\s*\n(.+?)(?:\n##|\Z)', content, re.DOTALL)
    if match:
        return match.group(1).strip()
    return ''


def parse_match_patterns(content: str) -> list:
    """Extract match_patterns from instinct frontmatter content.

    match_patterns is a YAML list of dicts, e.g.:
    match_patterns:
      - tool: Write
        file_glob: "*.ts"
        path_contains: src/
      - tool: Bash
        command_prefix: npm
    """
    match = re.search(r'^---\s*\n(.*?)\n---', content, re.DOTALL | re.MULTILINE)
    if not match:
        return []

    fm_text = match.group(1)
    patterns = []
    current_pattern = None
    in_match_patterns = False

    for line in fm_text.split('\n'):
        stripped = line.strip()

        if stripped.startswith('match_patterns:'):
            in_match_patterns = True
            continue

        if in_match_patterns:
            # Check if we've left the match_patterns block (new top-level key)
            if not line.startswith(' ') and not line.startswith('\t') and ':' in stripped and not stripped.startswith('-'):
                break

            if stripped.startswith('- '):
                # New pattern entry
                if current_pattern:
                    patterns.append(current_pattern)
                current_pattern = {}
                # Parse inline key-value from "- tool: Write"
                rest = stripped[2:].strip()
                if ':' in rest:
                    k, _, v = rest.partition(':')
                    current_pattern[k.strip()] = v.strip().strip('"').strip("'")
            elif ':' in stripped and current_pattern is not None:
                # Continuation key-value
                k, _, v = stripped.partition(':')
                current_pattern[k.strip()] = v.strip().strip('"').strip("'")

    if current_pattern:
        patterns.append(current_pattern)

    return patterns


def load_auto_approved_instincts(cwd: str) -> list:
    """Load all auto-approved instincts from the instincts directory.
    Skips rejected instincts (M3)."""
    instincts_dir = os.path.join(cwd, '.claude', 'md-to-skill-instincts')
    instincts = []

    if not os.path.isdir(instincts_dir):
        return instincts

    try:
        for filename in os.listdir(instincts_dir):
            if not filename.endswith('.md'):
                continue

            filepath = os.path.join(instincts_dir, filename)
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()

                fm = parse_instinct_frontmatter(content)

                # M3: Skip rejected instincts
                if fm.get('rejected', False):
                    continue

                if not fm.get('auto_approved', False):
                    continue

                action = extract_action(content)

                # M4: Extract match_patterns if present
                match_patterns = parse_match_patterns(content)

                instincts.append({
                    'id': fm.get('id', filename.replace('.md', '')),
                    'trigger': fm.get('trigger', ''),
                    'domain': fm.get('domain', ''),
                    'confidence': fm.get('confidence', 0),
                    'action': action,
                    'filepath': filepath,
                    'suggestions_shown': fm.get('suggestions_shown', 0),
                    'match_patterns': match_patterns,
                })
            except Exception:
                continue
    except Exception:
        pass

    return instincts


def match_by_patterns(match_patterns: list, tool_name: str, tool_input: dict) -> bool:
    """M4: Check if tool use matches explicit match_patterns.

    match_patterns is a list of dicts:
      - {tool: "Write|Edit", file_glob: "*.ts", path_contains: "src/"}
      - {tool: "Bash", command_prefix: "npm"}
      - {tool: "Read", file_glob: "*.config.*"}

    Returns True if any pattern matches.
    """
    for pattern in match_patterns:
        pattern_tool = pattern.get('tool', '')

        # Check if tool name matches (supports pipe-separated values)
        tool_options = [t.strip() for t in pattern_tool.split('|')]
        if tool_name not in tool_options:
            continue

        # For Write/Edit/Read — check file path
        if tool_name in ('Write', 'Edit', 'Read'):
            file_path = tool_input.get('file_path', '').replace('\\', '/')
            if not file_path:
                continue

            file_glob = pattern.get('file_glob', '')
            path_contains = pattern.get('path_contains', '')

            glob_match = True
            if file_glob:
                basename = os.path.basename(file_path)
                glob_match = fnmatch.fnmatch(basename, file_glob) or fnmatch.fnmatch(file_path, file_glob)

            path_match = True
            if path_contains:
                path_match = path_contains.lower() in file_path.lower()

            if glob_match and path_match:
                return True

        # For Bash — check command prefix
        elif tool_name == 'Bash':
            command = tool_input.get('command', '')
            command_prefix = pattern.get('command_prefix', '')

            if command_prefix and command.strip().lower().startswith(command_prefix.lower()):
                return True
            elif not command_prefix:
                # Pattern matched tool but no further constraint
                return True

    return False


def match_write_edit(instinct: dict, tool_input: dict) -> bool:
    """Check if an instinct trigger matches a Write/Edit tool context."""
    trigger = instinct.get('trigger', '').lower()
    file_path = tool_input.get('file_path', '').replace('\\', '/')
    if not file_path:
        return False

    file_lower = file_path.lower()
    basename = os.path.basename(file_lower)
    ext = os.path.splitext(basename)[1]

    # Match file extensions mentioned in trigger
    ext_patterns = re.findall(r'\.(ts|js|py|tsx|jsx|css|scss|html|json|md|cs|yaml|yml)', trigger)
    for ep in ext_patterns:
        if ext == '.' + ep:
            return True

    # Match path segments mentioned in trigger
    path_keywords = re.findall(r'(?:in|under|within|to)\s+(\S+)', trigger)
    for kw in path_keywords:
        if kw.strip('/').lower() in file_lower:
            return True

    # Match file type descriptions
    type_mappings = {
        'typescript': ['.ts', '.tsx'],
        'javascript': ['.js', '.jsx'],
        'python': ['.py'],
        'style': ['.css', '.scss', '.less'],
        'template': ['.html', '.hbs'],
        'test': ['.test.', '.spec.'],
        'component': ['.component.'],
        'service': ['.service.'],
        'module': ['.module.'],
    }
    for keyword, extensions in type_mappings.items():
        if keyword in trigger:
            for e in extensions:
                if e in file_lower:
                    return True

    # Match domain-based triggers
    domain = instinct.get('domain', '')
    if domain == 'naming' and ('writing' in trigger or 'creating' in trigger):
        return True
    if domain == 'code-style' and ('writing' in trigger or 'editing' in trigger):
        return True

    return False


def match_bash(instinct: dict, tool_input: dict) -> bool:
    """Check if an instinct trigger matches a Bash tool context."""
    trigger = instinct.get('trigger', '').lower()
    command = tool_input.get('command', '')
    if not command:
        return False

    cmd_lower = command.lower()
    first_token = cmd_lower.split()[0] if cmd_lower.strip() else ''

    # Match command names in trigger
    cmd_patterns = re.findall(r'(?:running|using|executing|after)\s+(\S+)', trigger)
    for cp in cmd_patterns:
        if cp.lower() == first_token:
            return True

    # Match common command keywords
    cmd_keywords = ['npm', 'git', 'python', 'node', 'bun', 'pnpm', 'yarn',
                    'dotnet', 'test', 'build', 'lint', 'deploy']
    for kw in cmd_keywords:
        if kw in trigger and kw in cmd_lower:
            return True

    # Match workflow triggers
    if 'test' in trigger and ('test' in cmd_lower or 'jest' in cmd_lower or 'vitest' in cmd_lower):
        return True
    if 'build' in trigger and 'build' in cmd_lower:
        return True

    return False


def match_read(instinct: dict, tool_input: dict) -> bool:
    """H4: Check if an instinct trigger matches a Read tool context.
    Only matches if match_patterns explicitly includes Read tool."""
    # Read matching only works via match_patterns (M4).
    # We don't do fuzzy trigger matching for Read to avoid noisy suggestions.
    return False


def increment_suggestions_shown(filepath: str, current_count: int):
    """Increment the suggestions_shown counter in instinct frontmatter."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        new_count = current_count + 1

        if 'suggestions_shown:' in content:
            content = re.sub(
                r'suggestions_shown:\s*\d+',
                f'suggestions_shown: {new_count}',
                content
            )
        else:
            # Add before the closing ---
            content = re.sub(
                r'\n---\n',
                f'\nsuggestions_shown: {new_count}\n---\n',
                content,
                count=1
            )

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
    except Exception:
        pass


def main():
    """Main entry point for the instinct suggestion hook."""
    try:
        # Load hook input
        if HOOK_UTILS_AVAILABLE:
            input_data = load_hook_input()
        else:
            input_data = json.load(sys.stdin)

        cwd = input_data.get('cwd', '.')
        tool_name = input_data.get('tool_name', '')
        tool_input = input_data.get('tool_input', {})

        if isinstance(tool_input, str):
            try:
                tool_input = json.loads(tool_input)
            except (json.JSONDecodeError, TypeError):
                tool_input = {}

        if not tool_name:
            print(json.dumps({"ok": True}))
            sys.exit(0)

        # Load auto-approved instincts (M3: rejected instincts filtered out)
        instincts = load_auto_approved_instincts(cwd)

        if not instincts:
            print(json.dumps({"ok": True}))
            sys.exit(0)

        # Find matching instincts
        matches = []
        for instinct in instincts:
            match_patterns = instinct.get('match_patterns', [])

            # M4: If match_patterns present, use them exclusively
            if match_patterns:
                matched = match_by_patterns(match_patterns, tool_name, tool_input)
            else:
                # Fall through to existing trigger-based matching (backward compat)
                matched = False
                if tool_name in ('Write', 'Edit'):
                    matched = match_write_edit(instinct, tool_input)
                elif tool_name == 'Bash':
                    matched = match_bash(instinct, tool_input)
                # H4: Read only matches via match_patterns, not trigger fallback

            if matched:
                matches.append(instinct)

        if not matches:
            print(json.dumps({"ok": True}))
            sys.exit(0)

        # Build suggestion message from matched instincts
        suggestions = []
        for m in matches:
            action = m.get('action', '')
            if action:
                suggestions.append(
                    f"[instinct:{m['id']}] ({m['domain']}, confidence:{m['confidence']}) {action}"
                )
                # Increment counter
                increment_suggestions_shown(m['filepath'], m.get('suggestions_shown', 0))

        if suggestions:
            message = "Instinct suggestions for this action:\n" + "\n".join(suggestions)
            print(json.dumps({"ok": True, "systemMessage": message}))
        else:
            print(json.dumps({"ok": True}))

        sys.exit(0)

    except Exception:
        # Never block on errors
        print(json.dumps({"ok": True}))
        sys.exit(0)


if __name__ == '__main__':
    main()
