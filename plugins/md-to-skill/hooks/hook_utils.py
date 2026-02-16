#!/usr/bin/env python3
"""
md-to-skill Hook Utilities - Shared functions for all hooks.

Provides common utilities extracted from individual hook scripts to reduce
duplication and ensure consistent behavior across the hook pipeline.

Importable without side effects. All functions use defensive try/except.
"""

import json
import sys
import os
import re
import fnmatch


def setup_plugin_path():
    """Add plugin root to sys.path for config imports.

    Call this before importing from config package.
    Returns the plugin root path.
    """
    plugin_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if plugin_root not in sys.path:
        sys.path.insert(0, plugin_root)
    return plugin_root


def load_hook_input() -> dict:
    """Load and parse hook input from stdin.

    Returns parsed dict with tool_input deserialized if it was a string.
    """
    input_data = json.load(sys.stdin)

    tool_input = input_data.get('tool_input', {})
    if isinstance(tool_input, str):
        try:
            input_data['tool_input'] = json.loads(tool_input)
        except (json.JSONDecodeError, TypeError):
            input_data['tool_input'] = {}

    return input_data


def is_secret_file(file_path: str, secret_patterns: list) -> bool:
    """Check if file path matches any secret file pattern."""
    if not file_path or not secret_patterns:
        return False

    basename = os.path.basename(file_path)
    for pattern in secret_patterns:
        if fnmatch.fnmatch(basename, pattern):
            return True
    return False


def get_observations_path(cwd: str) -> str:
    """Get path to observations JSONL file."""
    return os.path.join(cwd, '.claude', 'md-to-skill-observations.jsonl')


def get_cache_dir(cwd: str) -> str:
    """Get path to md-to-skill cache directory."""
    return os.path.join(cwd, '.claude', 'md-to-skill-cache')


def _migrate_cache_file(cwd: str, old_name: str, new_name: str) -> str:
    """Migrate a singleton cache file from flat layout to cache subdirectory.

    Returns the new path (in md-to-skill-cache/).
    """
    cache_dir = get_cache_dir(cwd)
    new_path = os.path.join(cache_dir, new_name)
    old_path = os.path.join(cwd, '.claude', old_name)

    if os.path.exists(old_path) and not os.path.exists(new_path):
        os.makedirs(cache_dir, exist_ok=True)
        try:
            os.rename(old_path, new_path)
        except OSError:
            pass

    return new_path


def get_structural_observations_path(cwd: str) -> str:
    """Get path to structural observations JSONL file."""
    return os.path.join(cwd, '.claude', 'md-to-skill-structural.jsonl')


def get_structural_cache_path(cwd: str) -> str:
    """Get path to structural cache file (with migration from flat layout)."""
    return _migrate_cache_file(cwd, 'md-to-skill-structural-cache.json', 'structural-cache.json')


def get_session_cache_path(cwd: str) -> str:
    """Get path to lightweight session cache for tracking recent writes."""
    return _migrate_cache_file(cwd, 'md-to-skill-session-cache.json', 'session-cache.json')


def parse_frontmatter(content: str) -> dict:
    """Parse YAML frontmatter from markdown content (simple key-value parser)."""
    fm = {}
    match = re.match(r'^---\s*\n(.*?)\n---', content, re.DOTALL)
    if not match:
        return fm
    for line in match.group(1).split('\n'):
        line = line.strip()
        if ':' in line:
            key, _, value = line.partition(':')
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            # Handle boolean/numeric values
            if value.lower() == 'true':
                value = True
            elif value.lower() == 'false':
                value = False
            else:
                try:
                    if '.' in value:
                        value = float(value)
                    else:
                        value = int(value)
                except (ValueError, TypeError):
                    pass
            fm[key] = value
    return fm


def update_frontmatter_field(content: str, key: str, new_value) -> str:
    """Update a single field in YAML frontmatter, or add it if not present."""
    match = re.match(r'^(---\s*\n)(.*?)(\n---)', content, re.DOTALL)
    if not match:
        return content

    prefix = match.group(1)
    fm_body = match.group(2)
    suffix = match.group(3)
    rest = content[match.end():]

    # Format the value
    if isinstance(new_value, bool):
        val_str = 'true' if new_value else 'false'
    elif isinstance(new_value, float):
        val_str = str(new_value)
    elif isinstance(new_value, int):
        val_str = str(new_value)
    else:
        val_str = '"{}"'.format(new_value)

    # Try to replace existing field
    pattern = re.compile(r'^(' + re.escape(key) + r'\s*:\s*)(.*)$', re.MULTILINE)
    if pattern.search(fm_body):
        fm_body = pattern.sub(r'\g<1>' + val_str, fm_body)
    else:
        fm_body = fm_body.rstrip() + '\n' + key + ': ' + val_str

    return prefix + fm_body + suffix + rest
