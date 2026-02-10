#!/usr/bin/env python3
"""
md-to-skill PostToolUse Hook - Skill Usage Tracking

Logs every skill invocation to .claude/md-to-skill-usage.json.
Tracks trigger counts, first seen, and last triggered timestamps.

This hook runs on the Skill tool and never blocks execution.
"""

import json
import sys
import os
from datetime import datetime


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


def main():
    """Main entry point for the PostToolUse hook."""
    try:
        input_data = json.load(sys.stdin)

        cwd = input_data.get('cwd', '.')

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

        # Never block - always allow
        print(json.dumps({"ok": True}))
        sys.exit(0)

    except Exception:
        # Never block on errors
        print(json.dumps({"ok": True}))
        sys.exit(0)


if __name__ == '__main__':
    main()
