#!/usr/bin/env python3
"""
md-to-skill PreToolUse Hook - Instinct Suggestion

Proactively suggests actions based on auto-approved instincts when tool use
matches instinct triggers. Never blocks execution.

Hooks on: Write|Edit|Bash
"""

import json
import sys
import os
import re
import fnmatch
from datetime import datetime

# Add plugin root to sys.path for config imports
PLUGIN_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PLUGIN_ROOT not in sys.path:
    sys.path.insert(0, PLUGIN_ROOT)

try:
    from config.config_loader import load_config, get_instinct_config
    CONFIG_AVAILABLE = True
except ImportError:
    CONFIG_AVAILABLE = False

# Cache for loaded instincts (loaded once per invocation)
_instincts_cache = None


def parse_instinct_frontmatter(content: str) -> dict:
    """Parse YAML frontmatter from an instinct markdown file."""
    match = re.search(r'^---\s*\n(.*?)\n---', content, re.DOTALL | re.MULTILINE)
    if not match:
        return {}

    frontmatter_text = match.group(1)
    result = {}

    # Parse key-value pairs from frontmatter
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


def load_auto_approved_instincts(cwd: str) -> list:
    """Load all auto-approved instincts from the instincts directory."""
    global _instincts_cache
    if _instincts_cache is not None:
        return _instincts_cache

    instincts_dir = os.path.join(cwd, '.claude', 'md-to-skill-instincts')
    instincts = []

    if not os.path.isdir(instincts_dir):
        _instincts_cache = instincts
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
                if not fm.get('auto_approved', False):
                    continue

                action = extract_action(content)
                instincts.append({
                    'id': fm.get('id', filename.replace('.md', '')),
                    'trigger': fm.get('trigger', ''),
                    'domain': fm.get('domain', ''),
                    'confidence': fm.get('confidence', 0),
                    'action': action,
                    'filepath': filepath,
                    'suggestions_shown': fm.get('suggestions_shown', 0),
                })
            except Exception:
                continue
    except Exception:
        pass

    _instincts_cache = instincts
    return instincts


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

        # Load auto-approved instincts
        instincts = load_auto_approved_instincts(cwd)

        if not instincts:
            print(json.dumps({"ok": True}))
            sys.exit(0)

        # Find matching instincts
        matches = []
        for instinct in instincts:
            matched = False
            if tool_name in ('Write', 'Edit'):
                matched = match_write_edit(instinct, tool_input)
            elif tool_name == 'Bash':
                matched = match_bash(instinct, tool_input)

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
