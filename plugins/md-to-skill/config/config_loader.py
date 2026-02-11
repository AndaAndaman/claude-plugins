"""
Centralized configuration loader for md-to-skill plugin.

Loads defaults from config/defaults.json and overlays user overrides
from .claude/md-to-skill.local.md YAML frontmatter.
"""

import json
import os
import re
import copy


def _get_defaults_path() -> str:
    """Get path to defaults.json relative to this module."""
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), 'defaults.json')


def _load_defaults() -> dict:
    """Load default configuration from defaults.json."""
    defaults_path = _get_defaults_path()
    try:
        with open(defaults_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return _fallback_defaults()


def _fallback_defaults() -> dict:
    """Hardcoded fallback if defaults.json is missing."""
    return {
        "version": "0.6.0",
        "observer": {
            "enabled": True,
            "maxObservationsMB": 10,
            "capturePatterns": {},
            "excludeTools": [],
            "excludePathPatterns": []
        },
        "instincts": {
            "initialConfidence": 0.3,
            "confidenceIncrement": 0.1,
            "maxConfidence": 0.95,
            "autoApproveThreshold": 0.7,
            "confidenceDecay": {
                "enabled": True,
                "gracePeriodDays": 14,
                "decayPerWeek": 0.05,
                "minimumConfidence": 0.1
            },
            "maxInstincts": 100,
            "pruneThresholds": {
                "autoRemoveConfidence": 0.2,
                "autoRemoveStalenessDays": 60,
                "reviewConfidence": 0.3,
                "reviewStalenessDays": 30
            }
        },
        "evolution": {
            "minClusterSize": 3,
            "minAverageConfidence": 0.5
        },
        "watch": {
            "enabled": True,
            "minWords": 200,
            "excludePatterns": ["README.md", "CHANGELOG.md", "LICENSE.md", "CLAUDE.md"],
            "observeSuggestionThreshold": 50
        },
        "privacy": {
            "neverCaptureContent": True,
            "maxCommandPreviewLength": 200,
            "excludeSecretFiles": [".env", ".env.*", "credentials.*", "*.key", "*.pem"]
        },
        "integration": {
            "quickWinsEnabled": True,
            "askBeforeCodeEnabled": True,
            "localMemoryExportEnabled": True
        },
        "debug": False
    }


def _parse_local_md_frontmatter(cwd: str) -> dict:
    """Parse YAML frontmatter from .claude/md-to-skill.local.md."""
    settings_file = os.path.join(cwd, '.claude', 'md-to-skill.local.md')
    if not os.path.exists(settings_file):
        return {}

    try:
        with open(settings_file, 'r', encoding='utf-8') as f:
            content = f.read()

        match = re.search(r'^---\s*\n(.*?)\n---', content, re.DOTALL | re.MULTILINE)
        if not match:
            return {}

        frontmatter = match.group(1)
        overrides = {}

        # Map frontmatter keys to config paths
        mappings = {
            'watchEnabled': ('watch', 'enabled'),
            'minWords': ('watch', 'minWords'),
            'observeEnabled': ('observer', 'enabled'),
            'maxObservationsMB': ('observer', 'maxObservationsMB'),
            'autoApproveThreshold': ('instincts', 'autoApproveThreshold'),
            'confidenceDecayPerWeek': ('instincts', 'confidenceDecay', 'decayPerWeek'),
            'maxInstincts': ('instincts', 'maxInstincts'),
            'debug': ('debug',),
        }

        for key, path in mappings.items():
            # Try boolean
            bool_match = re.search(rf'{key}:\s*(true|false)', frontmatter, re.IGNORECASE)
            if bool_match:
                value = bool_match.group(1).lower() == 'true'
                _set_nested(overrides, path, value)
                continue

            # Try float (must check before integer to avoid matching "0" from "0.7")
            float_match = re.search(rf'{key}:\s*(\d+\.\d+)', frontmatter)
            if float_match:
                _set_nested(overrides, path, float(float_match.group(1)))
                continue

            # Try integer
            int_match = re.search(rf'{key}:\s*(\d+)', frontmatter)
            if int_match:
                _set_nested(overrides, path, int(int_match.group(1)))
                continue

        # Handle excludePatterns list
        exclude_match = re.search(r'excludePatterns:\s*\n((?:\s+-\s+.+\n?)+)', frontmatter)
        if exclude_match:
            patterns = re.findall(r'^\s+-\s+(.+)$', exclude_match.group(1), re.MULTILINE)
            if patterns:
                _set_nested(overrides, ('watch', 'excludePatterns'),
                            [p.strip() for p in patterns])

        return overrides
    except Exception:
        return {}


def _set_nested(d: dict, path: tuple, value):
    """Set a value in a nested dict using a path tuple."""
    for key in path[:-1]:
        d = d.setdefault(key, {})
    d[path[-1]] = value


def _deep_merge(base: dict, overlay: dict) -> dict:
    """Deep merge overlay into base, returning new dict."""
    result = copy.deepcopy(base)
    for key, value in overlay.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = _deep_merge(result[key], value)
        else:
            result[key] = copy.deepcopy(value)
    return result


def load_config(cwd: str) -> dict:
    """
    Load merged configuration: defaults.json + user overrides.

    Args:
        cwd: Current working directory (project root)

    Returns:
        Merged configuration dict
    """
    defaults = _load_defaults()
    overrides = _parse_local_md_frontmatter(cwd)
    return _deep_merge(defaults, overrides)


def get_observer_config(config: dict) -> dict:
    """Extract observer section from config."""
    return config.get('observer', {})


def get_instinct_config(config: dict) -> dict:
    """Extract instinct section from config."""
    return config.get('instincts', {})


def get_privacy_config(config: dict) -> dict:
    """Extract privacy section from config."""
    return config.get('privacy', {})


def get_watch_config(config: dict) -> dict:
    """Extract watch section from config."""
    return config.get('watch', {})


def get_evolution_config(config: dict) -> dict:
    """Extract evolution section from config."""
    return config.get('evolution', {})


def get_integration_config(config: dict) -> dict:
    """Extract integration section from config."""
    return config.get('integration', {})
