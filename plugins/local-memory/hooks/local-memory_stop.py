#!/usr/bin/env python3
"""
Local Memory Stop Hook

Analyzes conversation history to detect if CLAUDE.md files should be generated.
Only triggers when coding session appears complete (not during active development).

Decision Logic:
1. Load settings from .claude/local-memory.local.md
2. If autoGenerate is false → Allow stop
3. Check for session completion signals (git commit, tests pass, etc.)
4. If session not complete → Allow stop (don't interrupt active coding)
5. Parse transcript for Edit/Write/NotebookEdit operations
6. Group files by directory, exclude specified directories
7. Skip directories with recently-updated CLAUDE.md (within cooldown period)
8. If any directory has >= threshold files → Block and suggest MCP tools
9. Otherwise → Allow stop
"""

import json
import sys
import re
import os
import time
from pathlib import Path
from collections import defaultdict
from datetime import datetime


# Default settings
DEFAULT_THRESHOLD = 2
DEFAULT_AUTO_GENERATE = True
DEFAULT_MAX_FILES = 50
DEFAULT_COOLDOWN_MINUTES = 30  # Skip if CLAUDE.md updated within this time
DEFAULT_EXCLUDED_DIRS = [
    "node_modules", "vendor", "packages",
    ".git", ".svn", ".hg", ".bzr",
    "dist", "build", "out", "target", "bin", "obj",
    "test", "tests", "spec", "specs", "__tests__", "__snapshots__",
    "coverage", ".next", ".nuxt", ".angular", "__pycache__",
    "temp", "tmp", "cache"
]

# Completion signal patterns
COMPLETION_SIGNALS = [
    # Git operations indicate work is done
    r'"name":\s*"Bash".*"command":\s*"[^"]*git\s+(commit|push)',
    # Explicit completion phrases in assistant messages
    r'"role":\s*"assistant".*"text":\s*"[^"]*\b(committed|pushed|done|complete|finished|ready to commit)\b',
]

# Active coding signals (should NOT trigger during these)
ACTIVE_CODING_SIGNALS = [
    # Recent Edit/Write operations (within last few entries)
    r'"name":\s*"(Edit|Write|NotebookEdit)"',
]


def load_settings(cwd: str) -> dict:
    """
    Load settings from .claude/local-memory.local.md YAML frontmatter.
    """
    settings = {
        'threshold': DEFAULT_THRESHOLD,
        'autoGenerate': DEFAULT_AUTO_GENERATE,
        'maxFilesAnalyzed': DEFAULT_MAX_FILES,
        'cooldownMinutes': DEFAULT_COOLDOWN_MINUTES,
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

        # Extract autoGenerate
        auto_gen_match = re.search(r'autoGenerate:\s*(true|false)', frontmatter, re.IGNORECASE)
        if auto_gen_match:
            settings['autoGenerate'] = auto_gen_match.group(1).lower() == 'true'

        # Extract threshold
        threshold_match = re.search(r'threshold:\s*(\d+)', frontmatter)
        if threshold_match:
            settings['threshold'] = int(threshold_match.group(1))

        # Extract maxFilesAnalyzed
        max_files_match = re.search(r'maxFilesAnalyzed:\s*(\d+)', frontmatter)
        if max_files_match:
            settings['maxFilesAnalyzed'] = int(max_files_match.group(1))

        # Extract cooldownMinutes
        cooldown_match = re.search(r'cooldownMinutes:\s*(\d+)', frontmatter)
        if cooldown_match:
            settings['cooldownMinutes'] = int(cooldown_match.group(1))

        # Extract excludedDirectories
        excluded_match = re.search(r'excludedDirectories:\s*\n((?:\s+-\s+.+\n?)+)', frontmatter)
        if excluded_match:
            excluded_list = excluded_match.group(1)
            excluded_dirs = re.findall(r'^\s+-\s+(.+)$', excluded_list, re.MULTILINE)
            if excluded_dirs:
                settings['excludedDirectories'].extend(excluded_dirs)

    except Exception:
        pass

    return settings


def check_session_completion(transcript_path: str) -> dict:
    """
    Analyze transcript to detect if coding session appears complete.

    Returns dict with:
    - is_complete: bool - True if session appears done
    - reason: str - Why we think session is/isn't complete
    - last_edit_index: int - Index of last Edit/Write operation
    - total_entries: int - Total transcript entries
    """
    result = {
        'is_complete': False,
        'reason': 'No completion signals detected',
        'last_edit_index': -1,
        'total_entries': 0,
        'has_commit': False,
        'has_completion_phrase': False
    }

    try:
        with open(transcript_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()

        result['total_entries'] = len(lines)

        # Scan transcript for signals
        for i, line in enumerate(lines):
            # Check for completion signals
            for pattern in COMPLETION_SIGNALS:
                if re.search(pattern, line, re.IGNORECASE):
                    if 'git' in pattern:
                        result['has_commit'] = True
                    else:
                        result['has_completion_phrase'] = True

            # Track last Edit/Write operation
            for pattern in ACTIVE_CODING_SIGNALS:
                if re.search(pattern, line):
                    result['last_edit_index'] = i

        # Determine if session is complete
        entries_since_last_edit = result['total_entries'] - result['last_edit_index']

        # Session is complete if:
        # 1. Has git commit/push, OR
        # 2. Has completion phrase AND no edits in last 5 entries, OR
        # 3. No edits in last 10 entries (long conversation gap)
        if result['has_commit']:
            result['is_complete'] = True
            result['reason'] = 'Git commit/push detected'
        elif result['has_completion_phrase'] and entries_since_last_edit > 5:
            result['is_complete'] = True
            result['reason'] = 'Completion phrase detected with no recent edits'
        elif result['last_edit_index'] == -1:
            # No edits at all in this session
            result['is_complete'] = False
            result['reason'] = 'No file modifications in session'
        elif entries_since_last_edit > 15:
            result['is_complete'] = True
            result['reason'] = f'No edits in last {entries_since_last_edit} transcript entries'

    except Exception as e:
        result['reason'] = f'Error reading transcript: {e}'

    return result


def is_claude_md_recent(dir_path: str, cwd: str, cooldown_minutes: int) -> bool:
    """
    Check if CLAUDE.md in directory was updated within cooldown period.
    Returns True if should skip (recently updated), False otherwise.
    """
    # Build absolute path
    if not os.path.isabs(dir_path):
        full_dir = os.path.join(cwd, dir_path)
    else:
        full_dir = dir_path

    claude_md_path = os.path.join(full_dir, 'CLAUDE.md')

    if not os.path.exists(claude_md_path):
        return False  # No CLAUDE.md, don't skip

    try:
        mtime = os.path.getmtime(claude_md_path)
        age_minutes = (time.time() - mtime) / 60

        return age_minutes < cooldown_minutes

    except Exception:
        return False


def extract_file_paths_from_transcript(transcript_path: str, cwd: str) -> list:
    """Extract file paths from Edit/Write/NotebookEdit tool invocations."""
    file_paths = []
    seen_paths = set()
    target_tools = {'Edit', 'Write', 'NotebookEdit'}

    try:
        with open(transcript_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue

                try:
                    entry = json.loads(line)
                except json.JSONDecodeError:
                    continue

                content = None

                # Structure 1: data.message.message.content
                if 'data' in entry:
                    data = entry['data']
                    if 'message' in data:
                        msg = data['message']
                        if isinstance(msg, dict) and 'message' in msg:
                            inner_msg = msg['message']
                            if isinstance(inner_msg, dict) and 'content' in inner_msg:
                                content = inner_msg['content']

                # Structure 2: message.content
                if content is None and 'message' in entry:
                    msg = entry['message']
                    if isinstance(msg, dict) and 'content' in msg:
                        content = msg['content']

                if not content or not isinstance(content, list):
                    continue

                for item in content:
                    if not isinstance(item, dict):
                        continue

                    if item.get('type') != 'tool_use':
                        continue

                    tool_name = item.get('name', '')
                    if tool_name not in target_tools:
                        continue

                    tool_input = item.get('input', {})
                    if not isinstance(tool_input, dict):
                        continue

                    file_path = tool_input.get('file_path', '')
                    if not file_path:
                        continue

                    # Normalize path
                    file_path = file_path.replace('\\', '/')
                    normalized_cwd = cwd.replace('\\', '/')

                    if file_path.startswith(normalized_cwd):
                        file_path = file_path[len(normalized_cwd):].lstrip('/')

                    if file_path not in seen_paths:
                        seen_paths.add(file_path)
                        file_paths.append(file_path)

    except Exception:
        pass

    return file_paths


def group_files_by_directory(file_paths: list, cwd: str, excluded_dirs: list) -> dict:
    """Group files by directory and count them."""
    dir_counts = defaultdict(int)

    for file_path in file_paths:
        dir_path = str(Path(file_path).parent)

        skip = False
        for excluded in excluded_dirs:
            if excluded in dir_path:
                skip = True
                break

        if not skip:
            dir_counts[dir_path] += 1

    return dict(dir_counts)


def main():
    """Main entry point for the stop hook."""
    try:
        input_data = json.load(sys.stdin)

        # Infinite loop guard
        if input_data.get('stop_hook_active'):
            sys.exit(0)

        cwd = input_data.get('cwd', '.')
        transcript_path = input_data.get('transcript_path', '')

        if not transcript_path:
            sys.exit(0)

        # Load settings
        settings = load_settings(cwd)

        if not settings['autoGenerate']:
            sys.exit(0)

        # Check if session appears complete
        completion = check_session_completion(transcript_path)

        if not completion['is_complete']:
            # Session still active, don't interrupt
            sys.exit(0)

        # Extract file paths
        file_paths = extract_file_paths_from_transcript(transcript_path, cwd)

        if not file_paths:
            sys.exit(0)

        # Group by directory
        dir_counts = group_files_by_directory(
            file_paths,
            cwd,
            settings['excludedDirectories']
        )

        # Find directories meeting threshold, excluding recently-updated ones
        candidate_dirs = []
        skipped_dirs = []

        for dir_path, count in dir_counts.items():
            if count < settings['threshold']:
                continue

            if is_claude_md_recent(dir_path, cwd, settings['cooldownMinutes']):
                skipped_dirs.append(dir_path)
                continue

            candidate_dirs.append((dir_path, count))

        if not candidate_dirs:
            # All directories either below threshold or recently updated
            sys.exit(0)

        # Build output
        dirs_list = [dir_path for dir_path, _ in candidate_dirs]
        summary_parts = [f"{dir_path} ({count} files)" for dir_path, count in candidate_dirs]
        summary = ", ".join(summary_parts)

        reason = f"""Session complete ({completion['reason']}). Detected file changes in {summary}.

Use local-memory MCP tools to build context:
1. For each directory in {json.dumps(dirs_list)}:
   - Call: mcp__plugin_local-memory_local-memory__analyze_directory({{"directory": "<dir>", "project_root": "{cwd}"}})
   - Call: mcp__plugin_local-memory_local-memory__generate_context({{"directory": "<dir>", "project_root": "{cwd}"}})
   - Call: mcp__plugin_local-memory_local-memory__write_context({{"directory": "<dir>", "content": "<generated>"}})

This creates CLAUDE.md files documenting modules you worked on."""

        if skipped_dirs:
            reason += f"\n\n(Skipped {len(skipped_dirs)} directories with recent CLAUDE.md updates)"

        result = {
            'decision': 'block',
            'reason': reason
        }
        print(json.dumps(result))
        sys.exit(0)

    except Exception:
        sys.exit(0)


if __name__ == '__main__':
    main()
