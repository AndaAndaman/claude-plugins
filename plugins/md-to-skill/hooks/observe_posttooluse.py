#!/usr/bin/env python3
"""
md-to-skill PostToolUse Hook - Observation Collector

Captures tool use patterns to .claude/md-to-skill-observations.jsonl for later
analysis by the /observe command. Only captures lightweight metadata, NOT full
file contents.

Hooks on: Write|Edit|Bash (actions that reveal preferences)
Never blocks execution.
"""

import json
import sys
import os
from datetime import datetime


MAX_FILE_SIZE_MB = 10
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024


def get_observations_path(cwd: str) -> str:
    """Get path to observations JSONL file."""
    return os.path.join(cwd, '.claude', 'md-to-skill-observations.jsonl')


def load_settings(cwd: str) -> dict:
    """Load instinct-related settings from .claude/md-to-skill.local.md."""
    import re
    settings = {
        'observeEnabled': True,
        'maxObservationsMB': MAX_FILE_SIZE_MB,
        'debug': False,
    }

    settings_file = os.path.join(cwd, '.claude', 'md-to-skill.local.md')
    if not os.path.exists(settings_file):
        return settings

    try:
        with open(settings_file, 'r', encoding='utf-8') as f:
            content = f.read()

        match = re.search(r'^---\s*\n(.*?)\n---', content, re.DOTALL | re.MULTILINE)
        if not match:
            return settings

        frontmatter = match.group(1)

        observe_match = re.search(r'observeEnabled:\s*(true|false)', frontmatter, re.IGNORECASE)
        if observe_match:
            settings['observeEnabled'] = observe_match.group(1).lower() == 'true'

        max_mb_match = re.search(r'maxObservationsMB:\s*(\d+)', frontmatter)
        if max_mb_match:
            settings['maxObservationsMB'] = int(max_mb_match.group(1))

        debug_match = re.search(r'debug:\s*(true|false)', frontmatter, re.IGNORECASE)
        if debug_match:
            settings['debug'] = debug_match.group(1).lower() == 'true'

    except Exception:
        pass

    return settings


def rotate_if_needed(obs_path: str, max_bytes: int):
    """Rotate observations file if it exceeds max size."""
    try:
        if not os.path.exists(obs_path):
            return
        size = os.path.getsize(obs_path)
        if size < max_bytes:
            return

        date_str = datetime.now().strftime('%Y%m%d-%H%M%S')
        archive_path = obs_path.replace('.jsonl', f'.archive-{date_str}.jsonl')
        os.rename(obs_path, archive_path)
    except Exception:
        pass


def extract_input_summary(tool_name: str, tool_input: dict) -> dict:
    """Extract lightweight summary from tool input (no full content)."""
    summary = {}

    if tool_name == 'Write':
        summary['file_path'] = tool_input.get('file_path', '')
        content = tool_input.get('content', '')
        summary['content_length'] = len(content)

    elif tool_name == 'Edit':
        summary['file_path'] = tool_input.get('file_path', '')
        summary['has_old_string'] = bool(tool_input.get('old_string', ''))
        summary['replace_all'] = tool_input.get('replace_all', False)

    elif tool_name == 'Bash':
        command = tool_input.get('command', '')
        # Only capture first 200 chars of command to avoid leaking secrets
        summary['command_preview'] = command[:200]
        summary['command_length'] = len(command)

    return summary


def extract_output_summary(tool_name: str, tool_output: dict) -> dict:
    """Extract lightweight summary from tool output."""
    summary = {}

    if isinstance(tool_output, dict):
        # Check for error indicators
        if 'error' in tool_output:
            summary['success'] = False
            summary['error_type'] = str(tool_output.get('error', ''))[:100]
        else:
            summary['success'] = True
    elif isinstance(tool_output, str):
        summary['success'] = 'error' not in tool_output.lower()[:200]
    else:
        summary['success'] = True

    return summary


def main():
    """Main entry point for the observation collector hook."""
    try:
        input_data = json.load(sys.stdin)

        cwd = input_data.get('cwd', '.')

        # Load settings
        settings = load_settings(cwd)

        if not settings['observeEnabled']:
            print(json.dumps({"ok": True}))
            sys.exit(0)

        tool_name = input_data.get('tool_name', '')
        tool_input = input_data.get('tool_input', {})
        tool_output = input_data.get('tool_output', {})

        if isinstance(tool_input, str):
            try:
                tool_input = json.loads(tool_input)
            except (json.JSONDecodeError, TypeError):
                tool_input = {}

        if not tool_name:
            print(json.dumps({"ok": True}))
            sys.exit(0)

        # Build observation entry
        observation = {
            'timestamp': datetime.now().isoformat(),
            'tool': tool_name,
            'input_summary': extract_input_summary(tool_name, tool_input),
            'output_summary': extract_output_summary(tool_name, tool_output),
            'session_id': input_data.get('session_id', ''),
        }

        # Write observation
        obs_path = get_observations_path(cwd)
        max_bytes = settings['maxObservationsMB'] * 1024 * 1024

        # Rotate if needed
        rotate_if_needed(obs_path, max_bytes)

        # Append observation
        os.makedirs(os.path.dirname(obs_path), exist_ok=True)
        with open(obs_path, 'a', encoding='utf-8') as f:
            f.write(json.dumps(observation) + '\n')

        # Never block
        print(json.dumps({"ok": True}))
        sys.exit(0)

    except Exception:
        # Never block on errors
        print(json.dumps({"ok": True}))
        sys.exit(0)


if __name__ == '__main__':
    main()
