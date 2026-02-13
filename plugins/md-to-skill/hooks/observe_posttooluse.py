#!/usr/bin/env python3
"""
md-to-skill PostToolUse Hook - Observation Collector

Captures tool use patterns to .claude/md-to-skill-observations.jsonl for later
analysis by the /observe command. Detects richer patterns including user
corrections, error resolutions, naming conventions, and tool preferences.

Hooks on: Write|Edit|Bash|Read (actions that reveal preferences)
Never blocks execution.
"""

import json
import sys
import os
import re
import random
import hashlib
from datetime import datetime

from hook_utils import (
    setup_plugin_path,
    load_hook_input,
    is_secret_file,
    get_observations_path,
    get_session_cache_path,
)

# Setup plugin path for config imports
setup_plugin_path()

try:
    from config.config_loader import load_config, get_observer_config, get_privacy_config
    CONFIG_AVAILABLE = True
except ImportError:
    CONFIG_AVAILABLE = False

# Fallback defaults
FALLBACK_MAX_FILE_SIZE_MB = 10
FALLBACK_MAX_COMMAND_PREVIEW = 200
SESSION_CACHE_MAX_ENTRIES = 20
FALLBACK_SESSION_CACHE_TTL_HOURS = 4

# Default sampling rates per tool
DEFAULT_SAMPLING_RATES = {
    'Write': 1.0,
    'Edit': 1.0,
    'Bash': 1.0,
    'Read': 0.2,
}


def load_session_cache(cwd: str, session_id: str = '', ttl_hours: float = FALLBACK_SESSION_CACHE_TTL_HOURS) -> dict:
    """Load session cache tracking recent Write operations.

    Applies hybrid TTL:
    - If session_id differs from cached last_session_id, clear entries
    - If no session_id, filter out entries older than ttl_hours
    """
    cache_path = get_session_cache_path(cwd)
    default = {'writes': [], 'bash_failures': [], 'last_session_id': ''}

    if not os.path.exists(cache_path):
        return default

    try:
        with open(cache_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            if 'writes' not in data:
                data['writes'] = []
            if 'bash_failures' not in data:
                data['bash_failures'] = []

            cached_session_id = data.get('last_session_id', '')

            # Session-based TTL: if session changed, clear entries
            if session_id and cached_session_id and session_id != cached_session_id:
                data['writes'] = []
                data['bash_failures'] = []
                data['last_session_id'] = session_id
                return data

            # Time-based TTL: if no session_id, filter old entries
            if not session_id:
                now = datetime.now()
                cutoff_seconds = ttl_hours * 3600

                data['writes'] = _filter_by_ttl(data['writes'], now, cutoff_seconds)
                data['bash_failures'] = _filter_by_ttl(data['bash_failures'], now, cutoff_seconds)

            return data
    except Exception:
        return default


def _filter_by_ttl(entries: list, now: datetime, cutoff_seconds: float) -> list:
    """Filter entries older than cutoff_seconds."""
    result = []
    for entry in entries:
        try:
            ts = datetime.fromisoformat(entry.get('timestamp', ''))
            if (now - ts).total_seconds() < cutoff_seconds:
                result.append(entry)
        except Exception:
            # Keep entries with unparseable timestamps (don't discard data)
            result.append(entry)
    return result


def save_session_cache(cwd: str, cache: dict, session_id: str = ''):
    """Save session cache, keeping only the most recent entries."""
    cache_path = get_session_cache_path(cwd)
    try:
        # Trim to max entries
        cache['writes'] = cache['writes'][-SESSION_CACHE_MAX_ENTRIES:]
        cache['bash_failures'] = cache['bash_failures'][-SESSION_CACHE_MAX_ENTRIES:]

        # Store session_id for TTL detection
        if session_id:
            cache['last_session_id'] = session_id

        os.makedirs(os.path.dirname(cache_path), exist_ok=True)
        with open(cache_path, 'w', encoding='utf-8') as f:
            json.dump(cache, f)
    except Exception:
        pass


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

    elif tool_name == 'Read':
        # Privacy-first: capture only file_path, never content
        summary['file_path'] = tool_input.get('file_path', '')

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


def is_correction_pattern(tool_name: str, file_path: str, session_cache: dict) -> bool:
    """Check if this Edit targets a file with a recent Write (correction pattern)."""
    if tool_name != 'Edit' or not file_path:
        return False
    now = datetime.now()
    for write_entry in reversed(session_cache.get('writes', [])):
        if write_entry.get('file_path') == file_path:
            try:
                write_time = datetime.fromisoformat(write_entry['timestamp'])
                if (now - write_time).total_seconds() < 300:
                    return True
            except Exception:
                pass
            break
    return False


def should_sample(tool_name: str, sampling_rates: dict, output_summary: dict,
                  is_correction: bool) -> bool:
    """Determine whether to record this observation based on sampling.

    Exemptions (always record):
    - Errors (output_summary.success is False)
    - Correction patterns (Edit after recent Write to same file)
    """
    # Always record errors
    if not output_summary.get('success', True):
        return True

    # Always record corrections
    if is_correction:
        return True

    # Apply sampling rate
    rate = sampling_rates.get(tool_name, 1.0)
    return random.random() < rate


def main():
    """Main entry point for the observation collector hook."""
    try:
        input_data = load_hook_input()

        cwd = input_data.get('cwd', '.')
        session_id = input_data.get('session_id', '')

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
                'samplingRates': DEFAULT_SAMPLING_RATES,
                'sessionCacheTTLHours': FALLBACK_SESSION_CACHE_TTL_HOURS,
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

        # Load session cache with TTL support
        ttl_hours = observer_cfg.get('sessionCacheTTLHours', FALLBACK_SESSION_CACHE_TTL_HOURS)
        session_cache = load_session_cache(cwd, session_id, ttl_hours)

        # Per-tool sampling (M5) - check before doing heavy pattern detection
        sampling_rates = observer_cfg.get('samplingRates', DEFAULT_SAMPLING_RATES)
        correction = is_correction_pattern(tool_name, file_path, session_cache)

        if not should_sample(tool_name, sampling_rates, output_summary, correction):
            # Still update session cache even if not recording
            _update_session_cache(tool_name, file_path, input_summary, output_summary,
                                  cwd, session_cache, session_id)
            print(json.dumps({"ok": True}))
            sys.exit(0)

        # Detect patterns
        capture_config = observer_cfg.get('capturePatterns', {})
        patterns = detect_patterns(
            tool_name, tool_input, tool_output,
            input_summary, output_summary,
            session_cache, capture_config
        )

        # Update session cache (Write tracking and Bash failure tracking)
        _update_session_cache(tool_name, file_path, input_summary, output_summary,
                              cwd, session_cache, session_id)

        # Build observation entry
        observation = {
            'timestamp': datetime.now().isoformat(),
            'tool': tool_name,
            'input_summary': input_summary,
            'output_summary': output_summary,
            'session_id': session_id,
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


def _update_session_cache(tool_name: str, file_path: str, input_summary: dict,
                          output_summary: dict, cwd: str, session_cache: dict,
                          session_id: str):
    """Update session cache with Write and Bash failure tracking.

    Note: Read is NOT added to session cache writes (Read is not a Write).
    """
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

    save_session_cache(cwd, session_cache, session_id)


if __name__ == '__main__':
    main()
