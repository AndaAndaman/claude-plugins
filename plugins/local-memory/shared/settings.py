#!/usr/bin/env python3
"""
Shared settings and constants for the local-memory plugin.

Single source of truth for defaults, exclusions, and settings loading.
Used by: stop hook, session_start hook, MCP server (context_builder).
"""

import re
import os
from pathlib import Path


# Default settings
DEFAULT_THRESHOLD = 2
DEFAULT_AUTO_GENERATE = True
DEFAULT_MAX_FILES = 50
DEFAULT_COOLDOWN_MINUTES = 30
DEFAULT_DEBUG = False

DEFAULT_EXCLUDED_DIRS = [
    "node_modules", "vendor", "packages",
    ".git", ".svn", ".hg", ".bzr",
    "dist", "build", "out", "target", "bin", "obj",
    "test", "tests", "spec", "specs", "__tests__", "__snapshots__",
    "coverage", ".next", ".nuxt", ".angular", "__pycache__",
    "temp", "tmp", "cache"
]


def load_settings(cwd: str) -> dict:
    """
    Load settings from .claude/local-memory.local.md YAML frontmatter.

    Returns dict with all settings, using defaults for missing values.
    """
    settings = {
        'threshold': DEFAULT_THRESHOLD,
        'autoGenerate': DEFAULT_AUTO_GENERATE,
        'maxFilesAnalyzed': DEFAULT_MAX_FILES,
        'cooldownMinutes': DEFAULT_COOLDOWN_MINUTES,
        'debug': DEFAULT_DEBUG,
        'excludedDirectories': DEFAULT_EXCLUDED_DIRS.copy()
    }

    settings_file = Path(cwd) / '.claude' / 'local-memory.local.md'

    if not settings_file.exists():
        return settings

    try:
        with open(settings_file, 'r', encoding='utf-8') as f:
            content = f.read()

        # Extract YAML frontmatter between --- markers
        match = re.search(r'^---\s*\n(.*?)\n---', content, re.DOTALL | re.MULTILINE)
        if not match:
            return settings

        frontmatter = match.group(1)

        # Parse known fields
        field_parsers = {
            'autoGenerate': lambda v: v.lower() == 'true',
            'threshold': int,
            'maxFilesAnalyzed': int,
            'cooldownMinutes': int,
            'debug': lambda v: v.lower() == 'true',
        }

        for field, parser in field_parsers.items():
            pattern = rf'{field}:\s*(.+)'
            field_match = re.search(pattern, frontmatter)
            if field_match:
                try:
                    settings[field] = parser(field_match.group(1).strip())
                except (ValueError, TypeError):
                    pass

        # Parse excludedDirectories list (only items under that key)
        excluded_match = re.search(r'excludedDirectories:\s*\n((?:\s+-\s+.+\n?)+)', frontmatter)
        if excluded_match:
            excluded_list = excluded_match.group(1)
            excluded_dirs = re.findall(r'^\s+-\s+(.+)$', excluded_list, re.MULTILINE)
            if excluded_dirs:
                settings['excludedDirectories'].extend(excluded_dirs)

    except Exception:
        pass

    return settings


def is_excluded_path(path: str, extra_exclusions: list = None) -> bool:
    """Check if path contains any excluded directory using path segment matching."""
    path_parts = Path(path).parts
    all_exclusions = DEFAULT_EXCLUDED_DIRS + (extra_exclusions or [])

    for excluded in all_exclusions:
        if excluded in path_parts:
            return True
    return False
