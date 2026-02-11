#!/usr/bin/env python3
"""
md-to-skill PostToolUse Hook - Observation Collector

Captures tool use patterns to .claude/md-to-skill-observations.jsonl for later
analysis by the /observe command. Detects richer patterns including user
corrections, error resolutions, naming conventions, and tool preferences.

Hooks on: Write|Edit|Bash (actions that reveal preferences)
Never blocks execution.
"""

import json
import sys
import os
import re
import hashlib
import fnmatch
from datetime import datetime

# Add plugin root to sys.path for config imports
PLUGIN_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PLUGIN_ROOT not in sys.path:
    sys.path.insert(0, PLUGIN_ROOT)

try:
    from config.config_loader import load_config, get_observer_config, get_privacy_config
    CONFIG_AVAILABLE = True
except ImportError:
    CONFIG_AVAILABLE = False

# Fallback defaults
FALLBACK_MAX_FILE_SIZE_MB = 10
FALLBACK_MAX_COMMAND_PREVIEW = 200
SESSION_CACHE_MAX_ENTRIES = 20


def get_observations_path(cwd: str) -> str:
    """Get path to observations JSONL file."""
    return os.path.join(cwd, '.claude', 'md-to-skill-observations.jsonl')


def get_session_cache_path(cwd: str) -> str:
    """Get path to lightweight session cache for tracking recent writes."""
    return os.path.join(cwd, '.claude', 'md-to-skill-session-cache.json')


def load_session_cache(cwd: str) -> dict:
    """Load session cache tracking recent Write operations."""
    cache_path = get_session_cache_path(cwd)
    default = {'writes': [], 'bash_failures': []}

    if not os.path.exists(cache_path):
        return default

    try:
        with open(cache_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            if 'writes' not in data:
                data['writes'] = []
            if 'bash_failures' not in data:
                data['bash_failures'] = []
            return data
    except Exception:
        return default


def save_session_cache(cwd: str, cache: dict):
    """Save session cache, keeping only the most recent entries."""
    cache_path = get_session_cache_path(cwd)
    try:
        # Trim to max entries
        cache['writes'] = cache['writes'][-SESSION_CACHE_MAX_ENTRIES:]
        cache['bash_failures'] = cache['bash_failures'][-SESSION_CACHE_MAX_ENTRIES:]

        os.makedirs(os.path.dirname(cache_path), exist_ok=True)
        with open(cache_path, 'w', encoding='utf-8') as f:
            json.dump(cache, f)
    except Exception:
        pass


def is_secret_file(file_path: str, secret_patterns: list) -> bool:
    """Check if file path matches any secret file pattern."""
    if not file_path or not secret_patterns:
        return False

    basename = os.path.basename(file_path)
    for pattern in secret_patterns:
        if fnmatch.fnmatch(basename, pattern):
            return True
    return False


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


def detect_case_style(name: str) -> str:
    """Detect naming case style from a file or directory name."""
    # Remove extension
    base = name.rsplit('.', 1)[0] if '.' in name else name

    if '-' in base:
        return 'kebab-case'
    if '_' in base:
        return 'snake_case'
    if base[0:1].isupper() and any(c.isupper() for c in base[1:]):
        return 'PascalCase'
    if base[0:1].islower() and any(c.isupper() for c in base[1:]):
        return 'camelCase'
    return 'unknown'


def get_suffix_pattern(file_path: str) -> str:
    """Extract suffix pattern like .test.ts, .spec.js, .module.ts."""
    basename = os.path.basename(file_path)
    parts = basename.split('.')
    if len(parts) >= 3:
        return '.' + '.'.join(parts[-2:])
    elif len(parts) >= 2:
        return '.' + parts[-1]
    return ''


def compute_workflow_hash(tool_name: str, input_summary: dict) -> str:
    """Compute a lightweight hash representing the workflow pattern."""
    key_parts = [tool_name]

    if 'file_path' in input_summary:
        ext = os.path.splitext(input_summary['file_path'])[1]
        key_parts.append(ext)

    if 'command_preview' in input_summary:
        # Hash just the first token of the command (e.g., 'npm', 'git', 'python')
        cmd = input_summary['command_preview'].strip()
        first_token = cmd.split()[0] if cmd else ''
        key_parts.append(first_token)

    raw = '|'.join(key_parts)
    return hashlib.md5(raw.encode()).hexdigest()[:8]


def detect_patterns(tool_name: str, tool_input: dict, tool_output: dict,
                    input_summary: dict, output_summary: dict,
                    session_cache: dict, capture_config: dict) -> dict:
    """Detect richer patterns from the tool use context."""
    patterns = {}

    file_path = input_summary.get('file_path', '')

    # --- User corrections: Edit after recent Write to same file ---
    if capture_config.get('userCorrections', True) and tool_name == 'Edit' and file_path:
        now = datetime.now()
        for write_entry in reversed(session_cache.get('writes', [])):
            if write_entry.get('file_path') == file_path:
                try:
                    write_time = datetime.fromisoformat(write_entry['timestamp'])
                    seconds_since = (now - write_time).total_seconds()
                    if seconds_since < 300:  # Within 5 minutes
                        patterns['correction'] = {
                            'target_file': file_path,
                            'seconds_since_write': round(seconds_since)
                        }
                        # Also mark in input_summary for backward compat
                        input_summary['is_correction'] = True
                except Exception:
                    pass
                break

    # --- Error resolutions: Bash success after previous Bash failure ---
    if capture_config.get('errorResolutions', True) and tool_name == 'Bash':
        if output_summary.get('success', False):
            cmd_preview = input_summary.get('command_preview', '')
            first_token = cmd_preview.split()[0] if cmd_preview else ''
            for failure in reversed(session_cache.get('bash_failures', [])):
                failed_first_token = failure.get('first_token', '')
                if first_token and first_token == failed_first_token:
                    patterns['error_resolution'] = {
                        'command_prefix': first_token,
                        'resolved': True
                    }
                    break

    # --- File naming conventions ---
    if capture_config.get('fileNamingConventions', True) and file_path:
        basename = os.path.basename(file_path)
        case_style = detect_case_style(basename)
        suffix = get_suffix_pattern(file_path)
        if case_style != 'unknown':
            naming = {'case': case_style}
            if suffix:
                naming['suffix_pattern'] = suffix
            patterns['naming'] = naming

    # --- Tool preferences ---
    if capture_config.get('toolPreferences', True) and tool_name == 'Bash':
        cmd = input_summary.get('command_preview', '')
        if cmd:
            # Detect grep vs Grep tool usage
            if re.match(r'\b(grep|rg)\b', cmd):
                patterns['tool_preference'] = {
                    'category': 'search',
                    'chose': 'bash_grep'
                }
            # Detect echo/cat redirect vs Write tool
            elif re.match(r'\b(echo|cat)\b.*>', cmd):
                patterns['tool_preference'] = {
                    'category': 'write',
                    'chose': 'bash_redirect'
                }

    # --- Workflow hash ---
    patterns['workflow_hash'] = compute_workflow_hash(tool_name, input_summary)

    return patterns


def extract_input_summary(tool_name: str, tool_input: dict, max_cmd_preview: int) -> dict:
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
        # Only capture first N chars of command to avoid leaking secrets
        summary['command_preview'] = command[:max_cmd_preview]
        summary['command_length'] = len(command)

    return summary


def extract_output_summary(tool_name: str, tool_output: dict) -> dict:
    """Extract lightweight summary from tool output."""
    summary = {}

    if isinstance(tool_output, dict):
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

        # Load config (centralized or fallback)
        if CONFIG_AVAILABLE:
            config = load_config(cwd)
            observer_cfg = get_observer_config(config)
            privacy_cfg = get_privacy_config(config)
        else:
            observer_cfg = {
                'enabled': True,
                'maxObservationsMB': FALLBACK_MAX_FILE_SIZE_MB,
                'capturePatterns': {},
                'excludeTools': [],
                'excludePathPatterns': [],
            }
            privacy_cfg = {
                'maxCommandPreviewLength': FALLBACK_MAX_COMMAND_PREVIEW,
                'excludeSecretFiles': [],
            }

        if not observer_cfg.get('enabled', True):
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

        # Check if tool is excluded
        if tool_name in observer_cfg.get('excludeTools', []):
            print(json.dumps({"ok": True}))
            sys.exit(0)

        # Extract summaries
        max_cmd_preview = privacy_cfg.get('maxCommandPreviewLength', FALLBACK_MAX_COMMAND_PREVIEW)
        input_summary = extract_input_summary(tool_name, tool_input, max_cmd_preview)
        output_summary = extract_output_summary(tool_name, tool_output)

        # Privacy enforcement: skip secret files
        file_path = input_summary.get('file_path', '')
        secret_patterns = privacy_cfg.get('excludeSecretFiles', [])
        if file_path and is_secret_file(file_path, secret_patterns):
            print(json.dumps({"ok": True}))
            sys.exit(0)

        # Check excluded path patterns
        exclude_path_patterns = observer_cfg.get('excludePathPatterns', [])
        if file_path:
            normalized = file_path.replace('\\', '/')
            for pattern in exclude_path_patterns:
                if pattern in normalized:
                    print(json.dumps({"ok": True}))
                    sys.exit(0)

        # Load session cache for pattern detection
        session_cache = load_session_cache(cwd)

        # Detect patterns
        capture_config = observer_cfg.get('capturePatterns', {})
        patterns = detect_patterns(
            tool_name, tool_input, tool_output,
            input_summary, output_summary,
            session_cache, capture_config
        )

        # Update session cache
        now_iso = datetime.now().isoformat()
        if tool_name == 'Write' and file_path:
            session_cache['writes'].append({
                'file_path': file_path,
                'timestamp': now_iso
            })

        if tool_name == 'Bash' and not output_summary.get('success', True):
            cmd_preview = input_summary.get('command_preview', '')
            first_token = cmd_preview.split()[0] if cmd_preview else ''
            if first_token:
                session_cache['bash_failures'].append({
                    'first_token': first_token,
                    'timestamp': now_iso
                })

        save_session_cache(cwd, session_cache)

        # Build observation entry
        observation = {
            'timestamp': now_iso,
            'tool': tool_name,
            'input_summary': input_summary,
            'output_summary': output_summary,
            'session_id': input_data.get('session_id', ''),
            'patterns': patterns,
        }

        # Write observation
        obs_path = get_observations_path(cwd)
        max_mb = observer_cfg.get('maxObservationsMB', FALLBACK_MAX_FILE_SIZE_MB)
        max_bytes = max_mb * 1024 * 1024

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
