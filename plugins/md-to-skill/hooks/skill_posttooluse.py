#!/usr/bin/env python3
"""
md-to-skill PostToolUse Hook - Consolidated Skill Dispatcher

Combines three previously separate Skill hooks into one:
1. Usage tracking - logs every skill invocation
2. Quick-wins bridge - writes observations for quick-wins skills
3. Clarification bridge - writes observations for ask-before-code skills

Each handler runs independently with its own error isolation.
This hook never blocks execution.
"""

import json
import sys
import os
import time
import fnmatch
import glob as glob_mod
import re
from datetime import datetime

# Add plugin root to sys.path for imports
PLUGIN_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PLUGIN_ROOT not in sys.path:
    sys.path.insert(0, PLUGIN_ROOT)

try:
    from config.config_loader import load_config, get_privacy_config, get_integration_config, get_observer_config
    CONFIG_AVAILABLE = True
except ImportError:
    CONFIG_AVAILABLE = False

# Try to import hook_utils (created by implementer-1)
try:
    from hooks.hook_utils import is_secret_file, get_observations_path, parse_frontmatter, update_frontmatter_field
    HOOK_UTILS_AVAILABLE = True
except ImportError:
    HOOK_UTILS_AVAILABLE = False

# Skill name patterns for ask-before-code bridge
ABC_PATTERNS = ('clarify', 'ask-before-code', 'request-clarification')

# Timeout guard: early exit at 4000ms to stay within 5000ms hook timeout
START_TIME = time.time()
TIMEOUT_MS = 4000


def _check_timeout():
    """Return True if we're approaching the timeout limit."""
    elapsed_ms = (time.time() - START_TIME) * 1000
    return elapsed_ms >= TIMEOUT_MS


# ---- Fallback functions (used when hook_utils not available) ----

def _is_secret_file(file_path: str, secret_patterns: list) -> bool:
    """Check if file path matches any secret file pattern."""
    if not file_path or not secret_patterns:
        return False
    basename = os.path.basename(file_path)
    for pattern in secret_patterns:
        if fnmatch.fnmatch(basename, pattern):
            return True
    return False


def _get_observations_path(cwd: str) -> str:
    """Get path to observations JSONL file."""
    return os.path.join(cwd, '.claude', 'md-to-skill-observations.jsonl')


def _parse_frontmatter(content: str) -> dict:
    """Parse YAML frontmatter from markdown content."""
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


def _update_frontmatter_field(content: str, key: str, new_value) -> str:
    """Update a single field in YAML frontmatter."""
    match = re.match(r'^(---\s*\n)(.*?)(\n---)', content, re.DOTALL)
    if not match:
        return content
    prefix = match.group(1)
    fm_body = match.group(2)
    suffix = match.group(3)
    rest = content[match.end():]
    if isinstance(new_value, bool):
        val_str = 'true' if new_value else 'false'
    elif isinstance(new_value, float):
        val_str = str(new_value)
    elif isinstance(new_value, int):
        val_str = str(new_value)
    else:
        val_str = '"{}"'.format(new_value)
    pattern = re.compile(r'^(' + re.escape(key) + r'\s*:\s*)(.*)$', re.MULTILINE)
    if pattern.search(fm_body):
        fm_body = pattern.sub(r'\g<1>' + val_str, fm_body)
    else:
        fm_body = fm_body.rstrip() + '\n' + key + ': ' + val_str
    return prefix + fm_body + suffix + rest


# ---- Resolve functions (prefer hook_utils, fallback to local) ----

def _resolve_is_secret_file(file_path, secret_patterns):
    if HOOK_UTILS_AVAILABLE:
        return is_secret_file(file_path, secret_patterns)
    return _is_secret_file(file_path, secret_patterns)


def _resolve_get_observations_path(cwd):
    if HOOK_UTILS_AVAILABLE:
        return get_observations_path(cwd)
    return _get_observations_path(cwd)


def _resolve_parse_frontmatter(content):
    if HOOK_UTILS_AVAILABLE:
        return parse_frontmatter(content)
    return _parse_frontmatter(content)


def _resolve_update_frontmatter_field(content, key, new_value):
    if HOOK_UTILS_AVAILABLE:
        return update_frontmatter_field(content, key, new_value)
    return _update_frontmatter_field(content, key, new_value)


# ---- Usage tracking helpers (from skill-usage_posttooluse.py) ----

def _load_tracking_file(cwd: str) -> dict:
    """Load the usage tracking file."""
    tracking_path = os.path.join(cwd, '.claude', 'md-to-skill-usage.json')
    default_data = {'skills': {}, 'total_invocations': 0}
    if not os.path.exists(tracking_path):
        return default_data
    try:
        with open(tracking_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            if 'skills' not in data:
                data['skills'] = {}
            if 'total_invocations' not in data:
                data['total_invocations'] = 0
            return data
    except Exception:
        return default_data


def _save_tracking_file(cwd: str, data: dict):
    """Save the usage tracking file."""
    tracking_path = os.path.join(cwd, '.claude', 'md-to-skill-usage.json')
    try:
        os.makedirs(os.path.dirname(tracking_path), exist_ok=True)
        with open(tracking_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
    except Exception:
        pass


def _load_dedup(cwd: str) -> dict:
    """Load dedup tracking for instinct reinforcements."""
    dedup_path = os.path.join(cwd, '.claude', 'md-to-skill-reinforcement-dedup.json')
    if not os.path.exists(dedup_path):
        return {}
    try:
        with open(dedup_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {}


def _save_dedup(cwd: str, data: dict):
    """Save dedup tracking."""
    dedup_path = os.path.join(cwd, '.claude', 'md-to-skill-reinforcement-dedup.json')
    try:
        os.makedirs(os.path.dirname(dedup_path), exist_ok=True)
        with open(dedup_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
    except Exception:
        pass


def _reinforce_source_instincts(cwd: str, skill_name: str, max_confidence: float):
    """Find instincts that evolved into this skill and boost their confidence."""
    instinct_dir = os.path.join(cwd, '.claude', 'md-to-skill-instincts')
    if not os.path.isdir(instinct_dir):
        return

    dedup = _load_dedup(cwd)
    already_reinforced = dedup.get(skill_name, [])

    instinct_files = glob_mod.glob(os.path.join(instinct_dir, '*.md'))

    for fpath in instinct_files:
        if _check_timeout():
            break
        try:
            with open(fpath, 'r', encoding='utf-8') as f:
                content = f.read()

            fm = _resolve_parse_frontmatter(content)
            evolved_to = fm.get('evolved_to', '')
            instinct_id = fm.get('id', '')

            if evolved_to != skill_name:
                continue
            if instinct_id in already_reinforced:
                continue

            current_conf = fm.get('confidence', 0.3)
            if isinstance(current_conf, (int, float)):
                new_conf = min(current_conf + 0.02, max_confidence)
                new_conf = round(new_conf, 2)
            else:
                continue

            content = _resolve_update_frontmatter_field(content, 'confidence', new_conf)
            content = _resolve_update_frontmatter_field(content, 'usage_reinforced', True)

            current_count = fm.get('usage_reinforcement_count', 0)
            if not isinstance(current_count, int):
                current_count = 0
            content = _resolve_update_frontmatter_field(content, 'usage_reinforcement_count', current_count + 1)

            with open(fpath, 'w', encoding='utf-8') as f:
                f.write(content)

            already_reinforced.append(instinct_id)

        except Exception:
            continue

    if already_reinforced:
        dedup[skill_name] = already_reinforced
        _save_dedup(cwd, dedup)


# ---- Handler 1: Usage Tracking ----

def handle_usage_tracking(input_data: dict, cwd: str, config: dict, skill_name: str, tool_input: dict):
    """Track skill usage and reinforce source instincts. Always runs."""
    try:
        # Privacy check: skip if skill args reference a secret file
        secret_patterns = []
        if CONFIG_AVAILABLE:
            privacy_cfg = get_privacy_config(config)
            secret_patterns = privacy_cfg.get('excludeSecretFiles', [])

        skill_args = tool_input.get('args', '')
        if skill_args and secret_patterns:
            for token in str(skill_args).split():
                if _resolve_is_secret_file(token, secret_patterns):
                    return

        # Load and update tracking data
        tracking = _load_tracking_file(cwd)
        now = datetime.now().isoformat()

        if skill_name in tracking['skills']:
            tracking['skills'][skill_name]['trigger_count'] += 1
            tracking['skills'][skill_name]['last_triggered'] = now
        else:
            tracking['skills'][skill_name] = {
                'trigger_count': 1,
                'first_seen': now,
                'last_triggered': now
            }

        tracking['total_invocations'] += 1
        _save_tracking_file(cwd, tracking)

        # Reinforce source instincts (feedback loop)
        max_confidence = 0.95
        if CONFIG_AVAILABLE:
            try:
                instinct_cfg = config.get('instincts', {})
                max_confidence = instinct_cfg.get('maxConfidence', 0.95)
            except Exception:
                pass
        _reinforce_source_instincts(cwd, skill_name, max_confidence)

    except Exception:
        pass  # Never propagate


# ---- Handler 2: Quick-Wins Bridge ----

def handle_quickwins_bridge(input_data: dict, cwd: str, config: dict, skill_name: str):
    """Write observation for quick-wins skill usage. Conditional on feature flag + observer.enabled."""
    try:
        # Check integration flag
        if CONFIG_AVAILABLE:
            integration = get_integration_config(config)
            if not integration.get('quickWinsEnabled', True):
                return

        # Check observer.enabled (QW-12 fix)
        if CONFIG_AVAILABLE:
            observer_cfg = get_observer_config(config)
            if not observer_cfg.get('enabled', True):
                return

        # Only process quick-wins related skills
        if not skill_name.startswith('quick-wins'):
            return

        # Build observation entry
        now_iso = datetime.now().isoformat()
        observation = {
            'timestamp': now_iso,
            'tool': 'QuickWinsScan',
            'input_summary': {
                'skill': skill_name,
                'source': 'quick-wins-plugin'
            },
            'output_summary': {'success': True},
            'session_id': input_data.get('session_id', ''),
            'patterns': {
                'integration': {
                    'source_plugin': 'quick-wins',
                    'type': 'code-quality-scan'
                }
            }
        }

        obs_path = _resolve_get_observations_path(cwd)
        os.makedirs(os.path.dirname(obs_path), exist_ok=True)
        with open(obs_path, 'a', encoding='utf-8') as f:
            f.write(json.dumps(observation) + '\n')

    except Exception:
        pass  # Never propagate


# ---- Handler 3: Clarification Bridge ----

def handle_clarification_bridge(input_data: dict, cwd: str, config: dict, skill_name: str):
    """Write observation for ask-before-code skill usage. Conditional on feature flag + observer.enabled."""
    try:
        # Check integration flag
        if CONFIG_AVAILABLE:
            integration = get_integration_config(config)
            if not integration.get('askBeforeCodeEnabled', True):
                return

        # Check observer.enabled (QW-12 fix)
        if CONFIG_AVAILABLE:
            observer_cfg = get_observer_config(config)
            if not observer_cfg.get('enabled', True):
                return

        # Only process ask-before-code related skills
        if not any(p in skill_name for p in ABC_PATTERNS):
            return

        # Build observation entry
        now_iso = datetime.now().isoformat()
        observation = {
            'timestamp': now_iso,
            'tool': 'ClarificationComplete',
            'input_summary': {
                'skill': skill_name,
                'source': 'ask-before-code-plugin'
            },
            'output_summary': {'success': True},
            'session_id': input_data.get('session_id', ''),
            'patterns': {
                'integration': {
                    'source_plugin': 'ask-before-code',
                    'type': 'requirement-clarification'
                }
            }
        }

        obs_path = _resolve_get_observations_path(cwd)
        os.makedirs(os.path.dirname(obs_path), exist_ok=True)
        with open(obs_path, 'a', encoding='utf-8') as f:
            f.write(json.dumps(observation) + '\n')

    except Exception:
        pass  # Never propagate


# ---- Main ----

def main():
    """Main entry point - load config once, dispatch to all handlers."""
    try:
        input_data = json.load(sys.stdin)
        cwd = input_data.get('cwd', '.')

        # Load config once for all handlers
        config = {}
        if CONFIG_AVAILABLE:
            config = load_config(cwd)

        # Extract skill name from tool input
        tool_input = input_data.get('tool_input', {})
        if isinstance(tool_input, str):
            try:
                tool_input = json.loads(tool_input)
            except (json.JSONDecodeError, TypeError):
                tool_input = {}

        skill_name = tool_input.get('skill', '')

        if not skill_name:
            print(json.dumps({"ok": True}))
            sys.exit(0)

        # Handler 1: Usage tracking (always runs)
        handle_usage_tracking(input_data, cwd, config, skill_name, tool_input)

        # Handler 2: Quick-wins bridge (conditional)
        if not _check_timeout():
            handle_quickwins_bridge(input_data, cwd, config, skill_name)

        # Handler 3: Clarification bridge (conditional)
        if not _check_timeout():
            handle_clarification_bridge(input_data, cwd, config, skill_name)

        # Never block
        print(json.dumps({"ok": True}))
        sys.exit(0)

    except Exception:
        print(json.dumps({"ok": True}))
        sys.exit(0)


if __name__ == '__main__':
    main()
