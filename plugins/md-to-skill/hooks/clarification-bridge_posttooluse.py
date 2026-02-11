#!/usr/bin/env python3
"""
md-to-skill PostToolUse Hook - Ask-Before-Code Bridge

Detects when clarify, ask-before-code, or request-clarification skills are
invoked and writes an observation entry so the learning pipeline can discover
requirement clarification patterns.

Hooks on: Skill (PostToolUse)
Never blocks execution.
"""

import json
import sys
import os
from datetime import datetime

# Add plugin root to sys.path for config imports
PLUGIN_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PLUGIN_ROOT not in sys.path:
    sys.path.insert(0, PLUGIN_ROOT)

try:
    from config.config_loader import load_config
    CONFIG_AVAILABLE = True
except ImportError:
    CONFIG_AVAILABLE = False

# Skill name patterns that indicate ask-before-code usage
ABC_PATTERNS = ('clarify', 'ask-before-code', 'request-clarification')


def get_observations_path(cwd: str) -> str:
    """Get path to observations JSONL file."""
    return os.path.join(cwd, '.claude', 'md-to-skill-observations.jsonl')


def main():
    """Main entry point for the clarification bridge hook."""
    try:
        input_data = json.load(sys.stdin)
        cwd = input_data.get('cwd', '.')

        # Check integration config
        if CONFIG_AVAILABLE:
            config = load_config(cwd)
            integration = config.get('integration', {})
            if not integration.get('askBeforeCodeEnabled', True):
                print(json.dumps({"ok": True}))
                sys.exit(0)

        # Extract skill name from tool input
        tool_input = input_data.get('tool_input', {})
        if isinstance(tool_input, str):
            try:
                tool_input = json.loads(tool_input)
            except (json.JSONDecodeError, TypeError):
                tool_input = {}

        skill_name = tool_input.get('skill', '')

        # Only process ask-before-code related skills
        if not skill_name or not any(p in skill_name for p in ABC_PATTERNS):
            print(json.dumps({"ok": True}))
            sys.exit(0)

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

        # Append observation
        obs_path = get_observations_path(cwd)
        os.makedirs(os.path.dirname(obs_path), exist_ok=True)
        with open(obs_path, 'a', encoding='utf-8') as f:
            f.write(json.dumps(observation) + '\n')

        print(json.dumps({"ok": True}))
        sys.exit(0)

    except Exception:
        # Never block on errors
        print(json.dumps({"ok": True}))
        sys.exit(0)


if __name__ == '__main__':
    main()
