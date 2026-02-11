#!/usr/bin/env python3
"""
md-to-skill PostToolUse Hook - Skill Usage Tracking

Logs every skill invocation to .claude/md-to-skill-usage.json.
Tracks trigger counts, first seen, and last triggered timestamps.
Also reinforces source instincts when a skill evolved from instincts is used.

This hook runs on the Skill tool and never blocks execution.
"""

import json
import sys
import os
import fnmatch
import glob as glob_mod
import re
from datetime import datetime

# Add plugin root to sys.path for config imports
PLUGIN_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PLUGIN_ROOT not in sys.path:
    sys.path.insert(0, PLUGIN_ROOT)

try:
    from config.config_loader import load_config, get_privacy_config
    CONFIG_AVAILABLE = True
except ImportError:
    CONFIG_AVAILABLE = False


def is_secret_file(file_path: str, secret_patterns: list) -> bool:
    """Check if file path matches any secret file pattern."""
    if not file_path or not secret_patterns:
        return False

    basename = os.path.basename(file_path)
    for pattern in secret_patterns:
        if fnmatch.fnmatch(basename, pattern):
            return True
    return False


def load_tracking_file(cwd: str) -> dict:
    """Load the usage tracking file."""
    tracking_path = os.path.join(cwd, '.claude', 'md-to-skill-usage.json')

    default_data = {
        'skills': {},
        'total_invocations': 0
    }

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


def save_tracking_file(cwd: str, data: dict):
    """Save the usage tracking file."""
    tracking_path = os.path.join(cwd, '.claude', 'md-to-skill-usage.json')

    try:
        os.makedirs(os.path.dirname(tracking_path), exist_ok=True)
        with open(tracking_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
    except Exception:
        pass


def get_session_dedup_path(cwd: str) -> str:
    """Get path for session-level dedup tracking of instinct reinforcements."""
    return os.path.join(cwd, '.claude', 'md-to-skill-reinforcement-dedup.json')


def load_dedup(cwd: str) -> dict:
    """Load dedup tracking. Keys are skill names, values are lists of reinforced instinct IDs."""
    dedup_path = get_session_dedup_path(cwd)
    if not os.path.exists(dedup_path):
        return {}
    try:
        with open(dedup_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {}


def save_dedup(cwd: str, data: dict):
    """Save dedup tracking."""
    dedup_path = get_session_dedup_path(cwd)
    try:
        os.makedirs(os.path.dirname(dedup_path), exist_ok=True)
        with open(dedup_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
    except Exception:
        pass


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


def reinforce_source_instincts(cwd: str, skill_name: str, max_confidence: float):
    """Find instincts that evolved into this skill and boost their confidence."""
    instinct_dir = os.path.join(cwd, '.claude', 'md-to-skill-instincts')
    if not os.path.isdir(instinct_dir):
        return

    # Load dedup tracking
    dedup = load_dedup(cwd)
    already_reinforced = dedup.get(skill_name, [])

    instinct_files = glob_mod.glob(os.path.join(instinct_dir, '*.md'))

    for fpath in instinct_files:
        try:
            with open(fpath, 'r', encoding='utf-8') as f:
                content = f.read()

            fm = parse_frontmatter(content)
            evolved_to = fm.get('evolved_to', '')
            instinct_id = fm.get('id', '')

            if evolved_to != skill_name:
                continue

            # Skip if already reinforced this session
            if instinct_id in already_reinforced:
                continue

            # Boost confidence by 0.02, cap at maxConfidence
            current_conf = fm.get('confidence', 0.3)
            if isinstance(current_conf, (int, float)):
                new_conf = min(current_conf + 0.02, max_confidence)
                new_conf = round(new_conf, 2)
            else:
                continue

            # Update the instinct file
            content = update_frontmatter_field(content, 'confidence', new_conf)
            content = update_frontmatter_field(content, 'usage_reinforced', True)

            # Increment usage_reinforcement_count
            current_count = fm.get('usage_reinforcement_count', 0)
            if not isinstance(current_count, int):
                current_count = 0
            content = update_frontmatter_field(content, 'usage_reinforcement_count', current_count + 1)

            with open(fpath, 'w', encoding='utf-8') as f:
                f.write(content)

            # Track in dedup
            already_reinforced.append(instinct_id)

        except Exception:
            continue

    # Save dedup
    if already_reinforced:
        dedup[skill_name] = already_reinforced
        save_dedup(cwd, dedup)


def main():
    """Main entry point for the PostToolUse hook."""
    try:
        input_data = json.load(sys.stdin)

        cwd = input_data.get('cwd', '.')

        # Load config for privacy checks
        secret_patterns = []
        if CONFIG_AVAILABLE:
            config = load_config(cwd)
            privacy_cfg = get_privacy_config(config)
            secret_patterns = privacy_cfg.get('excludeSecretFiles', [])

        # Extract skill name from tool input
        tool_input = input_data.get('tool_input', {})
        if isinstance(tool_input, str):
            try:
                tool_input = json.loads(tool_input)
            except (json.JSONDecodeError, TypeError):
                tool_input = {}

        skill_name = tool_input.get('skill', '')

        if not skill_name:
            # No skill name found, nothing to track
            print(json.dumps({"ok": True}))
            sys.exit(0)

        # Privacy check: skip if skill args reference a secret file
        skill_args = tool_input.get('args', '')
        if skill_args and secret_patterns:
            # Check if any arg token looks like a secret file
            for token in str(skill_args).split():
                if is_secret_file(token, secret_patterns):
                    print(json.dumps({"ok": True}))
                    sys.exit(0)

        # Load tracking data
        tracking = load_tracking_file(cwd)

        now = datetime.now().isoformat()

        # Update or create skill entry
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

        # Save tracking data
        save_tracking_file(cwd, tracking)

        # Reinforce source instincts (feedback loop)
        max_confidence = 0.95
        if CONFIG_AVAILABLE:
            try:
                instinct_cfg = config.get('instincts', {})
                max_confidence = instinct_cfg.get('maxConfidence', 0.95)
            except Exception:
                pass
        reinforce_source_instincts(cwd, skill_name, max_confidence)

        # Never block - always allow
        print(json.dumps({"ok": True}))
        sys.exit(0)

    except Exception:
        # Never block on errors
        print(json.dumps({"ok": True}))
        sys.exit(0)


if __name__ == '__main__':
    main()
