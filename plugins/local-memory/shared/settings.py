#!/usr/bin/env python3
"""
Shared settings and constants for the local-memory plugin.

Single source of truth for defaults, exclusions, settings loading, and file locking.
Used by: stop hook, session_start hook, MCP server (context_builder).
"""

import re
import os
import time
import contextlib
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

# Pre-compiled YAML parsing patterns
_FRONTMATTER_RE = re.compile(r'^---\s*\n(.*?)\n---', re.DOTALL | re.MULTILINE)
_EXCLUDED_DIRS_RE = re.compile(r'excludedDirectories:\s*\n((?:\s+-\s+.+\n?)+)')
_EXCLUDED_ITEMS_RE = re.compile(r'^\s+-\s+(.+)$', re.MULTILINE)


@contextlib.contextmanager
def file_lock(lock_path: str, timeout: float = 5.0):
    """Cross-platform file lock. Creates {path}.lock file.

    Uses fcntl on Unix or msvcrt on Windows for advisory locking.
    Falls back to a polling-based lock file approach if neither is available.
    """
    lock_file = lock_path + '.lock'
    fd = None
    start = time.monotonic()

    try:
        os.makedirs(os.path.dirname(lock_file) or '.', exist_ok=True)

        while True:
            try:
                fd = os.open(lock_file, os.O_CREAT | os.O_RDWR)

                # Platform-specific locking
                if os.name == 'nt':
                    # Windows: msvcrt locking
                    import msvcrt
                    msvcrt.locking(fd, msvcrt.LK_NBLCK, 1)
                else:
                    # Unix: fcntl locking
                    import fcntl
                    fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)

                # Lock acquired
                yield
                return

            except (OSError, IOError):
                # Lock not available
                if fd is not None:
                    os.close(fd)
                    fd = None

                elapsed = time.monotonic() - start
                if elapsed >= timeout:
                    # Timeout: yield anyway to avoid blocking forever
                    yield
                    return

                time.sleep(0.05)

    finally:
        if fd is not None:
            try:
                if os.name == 'nt':
                    import msvcrt
                    try:
                        msvcrt.locking(fd, msvcrt.LK_UNLCK, 1)
                    except (OSError, IOError):
                        pass
                else:
                    import fcntl
                    fcntl.flock(fd, fcntl.LOCK_UN)
                os.close(fd)
            except (OSError, IOError):
                pass
            try:
                os.remove(lock_file)
            except OSError:
                pass


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
        match = _FRONTMATTER_RE.search(content)
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
        excluded_match = _EXCLUDED_DIRS_RE.search(frontmatter)
        if excluded_match:
            excluded_list = excluded_match.group(1)
            excluded_dirs = _EXCLUDED_ITEMS_RE.findall(excluded_list)
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
