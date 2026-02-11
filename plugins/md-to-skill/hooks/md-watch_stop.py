#!/usr/bin/env python3
"""
md-to-skill Stop Hook - Watch for Markdown Changes

Monitors the session for new/changed markdown files that look like skill candidates.
When the session appears complete, suggests /convert-to-skill for qualifying files.

Decision Logic:
1. Read stdin for hook input (cwd, transcript_path)
2. Guard: if stop_hook_active -> exit (prevent infinite loop)
3. Load config from centralized config_loader
4. Load session state (.claude/md-to-skill-state-{hash}.json)
5. Parse transcript for Write tool operations on .md files (incremental)
6. Filter out known non-skill files (README.md, CHANGELOG.md, etc.)
7. Filter out files inside skill directories
8. Filter out files already suggested this session
9. Lightweight checks: file exists, >minWords words, has headings
10. If candidates found -> block stop with suggestion
11. Save session state
"""

import json
import sys
import re
import os
import hashlib
from pathlib import Path
from datetime import datetime

# Add plugin root to sys.path for config imports
PLUGIN_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PLUGIN_ROOT not in sys.path:
    sys.path.insert(0, PLUGIN_ROOT)

try:
    from config.config_loader import (
        load_config, get_watch_config, get_observer_config, get_instinct_config
    )
    CONFIG_AVAILABLE = True
except ImportError:
    CONFIG_AVAILABLE = False


# Global debug state
DEBUG_ENABLED = False
DEBUG_LOG_PATH = None


def debug_log(message: str):
    """Write debug message to log file if debug mode is enabled."""
    if not DEBUG_ENABLED or not DEBUG_LOG_PATH:
        return
    try:
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        with open(DEBUG_LOG_PATH, 'a', encoding='utf-8') as f:
            f.write(f"[{timestamp}] {message}\n")
    except Exception:
        pass


def init_debug(cwd: str, debug_flag: bool):
    """Initialize debug mode based on config or environment."""
    global DEBUG_ENABLED, DEBUG_LOG_PATH

    if os.environ.get('MD_TO_SKILL_DEBUG', '').lower() in ('1', 'true', 'yes'):
        DEBUG_ENABLED = True

    if debug_flag:
        DEBUG_ENABLED = True

    if DEBUG_ENABLED:
        DEBUG_LOG_PATH = os.path.join(cwd, '.claude', 'md-to-skill-debug.log')
        os.makedirs(os.path.dirname(DEBUG_LOG_PATH), exist_ok=True)
        debug_log("=" * 60)
        debug_log("md-watch stop hook triggered")
        debug_log(f"CWD: {cwd}")


def get_session_state_path(cwd: str, transcript_path: str) -> str:
    """Get path for session state file based on transcript path."""
    transcript_hash = hashlib.md5(transcript_path.encode()).hexdigest()[:12]
    return os.path.join(cwd, '.claude', f'md-to-skill-state-{transcript_hash}.json')


def load_session_state(state_path: str) -> dict:
    """Load session state from file."""
    default_state = {
        'last_processed_line': 0,
        'suggested_files': [],
        'last_run_time': None
    }

    if not os.path.exists(state_path):
        return default_state

    try:
        with open(state_path, 'r', encoding='utf-8') as f:
            state = json.load(f)
            for key, default_val in default_state.items():
                if key not in state:
                    state[key] = default_val
            return state
    except Exception:
        return default_state


def save_session_state(state_path: str, state: dict):
    """Save session state to file."""
    try:
        os.makedirs(os.path.dirname(state_path), exist_ok=True)
        state['last_run_time'] = datetime.now().isoformat()
        with open(state_path, 'w', encoding='utf-8') as f:
            json.dump(state, f, indent=2)
    except Exception as e:
        debug_log(f"Failed to save session state: {e}")


def extract_md_file_paths(transcript_path: str, cwd: str, start_line: int = 0) -> tuple:
    """
    Extract .md file paths from Write tool invocations in the transcript.

    Returns:
        Tuple of (md_file_paths: list, last_line: int)
    """
    md_paths = []
    seen_paths = set()
    last_line = start_line

    try:
        with open(transcript_path, 'r', encoding='utf-8') as f:
            for line_num, line in enumerate(f):
                if line_num < start_line:
                    continue

                last_line = line_num + 1
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
                    if tool_name != 'Write':
                        continue

                    tool_input = item.get('input', {})
                    if not isinstance(tool_input, dict):
                        continue

                    file_path = tool_input.get('file_path', '')
                    if not file_path:
                        continue

                    # Only care about .md files
                    if not file_path.lower().endswith('.md'):
                        continue

                    # Normalize path
                    file_path = file_path.replace('\\', '/')
                    normalized_cwd = cwd.replace('\\', '/')

                    if file_path.startswith(normalized_cwd):
                        file_path = file_path[len(normalized_cwd):].lstrip('/')

                    if file_path not in seen_paths:
                        seen_paths.add(file_path)
                        md_paths.append(file_path)

    except Exception as e:
        debug_log(f"Error extracting paths: {e}")

    return md_paths, last_line


def is_excluded_file(file_path: str, exclude_patterns: list) -> bool:
    """Check if file matches any exclusion pattern."""
    basename = os.path.basename(file_path)

    # Check direct name matches
    for pattern in exclude_patterns:
        if basename == pattern:
            return True
        # Check if pattern matches as suffix (e.g., .local.md)
        if file_path.endswith(pattern):
            return True

    return False


def is_inside_skill_directory(file_path: str) -> bool:
    """Check if file is already inside a skill directory."""
    normalized = file_path.replace('\\', '/')
    parts = normalized.split('/')

    # Check for SKILL.md (indicates it IS a skill file)
    if os.path.basename(file_path) == 'SKILL.md':
        return True

    # Check if path contains /skills/ directory
    for i, part in enumerate(parts):
        if part == 'skills' and i < len(parts) - 1:
            return True

    # Check for .local.md files
    if file_path.endswith('.local.md'):
        return True

    return False


def check_file_quality(file_path: str, cwd: str, min_words: int) -> dict:
    """
    Lightweight quality check on a markdown file.

    Returns dict with:
    - passes: bool
    - word_count: int
    - has_headings: bool
    - reason: str (if fails)
    """
    result = {
        'passes': False,
        'word_count': 0,
        'has_headings': False,
        'reason': ''
    }

    # Build absolute path
    if os.path.isabs(file_path):
        abs_path = file_path
    else:
        abs_path = os.path.join(cwd, file_path)

    abs_path = os.path.normpath(abs_path)

    # Check file exists
    if not os.path.exists(abs_path):
        result['reason'] = 'File no longer exists'
        return result

    try:
        with open(abs_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        result['reason'] = f'Cannot read file: {e}'
        return result

    # Word count
    words = content.split()
    result['word_count'] = len(words)

    if result['word_count'] < min_words:
        result['reason'] = f'Only {result["word_count"]} words (need {min_words})'
        return result

    # Check for headings
    heading_pattern = re.compile(r'^#{1,6}\s+\S', re.MULTILINE)
    headings = heading_pattern.findall(content)
    result['has_headings'] = len(headings) >= 1

    if not result['has_headings']:
        result['reason'] = 'No markdown headings found'
        return result

    result['passes'] = True
    return result


def count_observations_since_last_analysis(cwd: str) -> int:
    """Count observation entries in JSONL file since last /observe run."""
    obs_path = os.path.join(cwd, '.claude', 'md-to-skill-observations.jsonl')
    if not os.path.exists(obs_path):
        return 0

    try:
        count = 0
        with open(obs_path, 'r', encoding='utf-8') as f:
            for line in f:
                if line.strip():
                    count += 1
        return count
    except Exception:
        return 0


def count_auto_approved_instincts(cwd: str, threshold: float) -> int:
    """Count instincts with auto_approved: true in the instincts directory."""
    instincts_dir = os.path.join(cwd, '.claude', 'md-to-skill-instincts')
    if not os.path.isdir(instincts_dir):
        return 0

    try:
        count = 0
        for filename in os.listdir(instincts_dir):
            if not filename.endswith('.md'):
                continue
            filepath = os.path.join(instincts_dir, filename)
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read(2000)  # Only need frontmatter
                match = re.search(r'^---\s*\n(.*?)\n---', content, re.DOTALL | re.MULTILINE)
                if match:
                    fm = match.group(1)
                    if re.search(r'auto_approved:\s*true', fm, re.IGNORECASE):
                        count += 1
            except Exception:
                continue
        return count
    except Exception:
        return 0


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

        # Load config (centralized or fallback)
        if CONFIG_AVAILABLE:
            config = load_config(cwd)
            watch_cfg = get_watch_config(config)
            observer_cfg = get_observer_config(config)
            instinct_cfg = get_instinct_config(config)
            debug_flag = config.get('debug', False)
        else:
            watch_cfg = {
                'enabled': True,
                'minWords': 200,
                'excludePatterns': ['README.md', 'CHANGELOG.md', 'LICENSE.md', 'CLAUDE.md'],
                'observeSuggestionThreshold': 50,
            }
            observer_cfg = {'enabled': True}
            instinct_cfg = {'autoApproveThreshold': 0.7}
            debug_flag = False

        # Initialize debug mode
        init_debug(cwd, debug_flag)
        debug_log(f"Config: watchEnabled={watch_cfg.get('enabled')}, minWords={watch_cfg.get('minWords')}")

        if not watch_cfg.get('enabled', True):
            debug_log("EXIT: watchEnabled=False (disabled)")
            sys.exit(0)

        # Load session state
        state_path = get_session_state_path(cwd, transcript_path)
        session_state = load_session_state(state_path)
        debug_log(f"Session state: last_line={session_state['last_processed_line']}, suggested={session_state['suggested_files']}")

        # Extract .md file paths from transcript (incremental)
        md_paths, last_line = extract_md_file_paths(
            transcript_path, cwd, session_state['last_processed_line']
        )
        debug_log(f"Found {len(md_paths)} new .md file writes (lines {session_state['last_processed_line']}-{last_line})")

        if not md_paths:
            debug_log("EXIT: No new .md file writes found")
            session_state['last_processed_line'] = last_line
            save_session_state(state_path, session_state)

            # Still check for observation accumulation even without .md candidates
            observe_enabled = observer_cfg.get('enabled', True)
            if observe_enabled:
                obs_threshold = watch_cfg.get('observeSuggestionThreshold', 50)
                obs_count = count_observations_since_last_analysis(cwd)
                if obs_count > obs_threshold:
                    auto_threshold = instinct_cfg.get('autoApproveThreshold', 0.7)
                    auto_count = count_auto_approved_instincts(cwd, auto_threshold)
                    auto_hint = ""
                    if auto_count > 0:
                        auto_hint = f" ({auto_count} instincts above auto-approve threshold)"

                    debug_log(f"TRIGGER: Blocking stop for instinct suggestion ({obs_count} observations{auto_hint})")
                    result = {
                        'decision': 'block',
                        'reason': f"{obs_count} tool use observations have accumulated{auto_hint}.\nRun /observe to analyze patterns and extract instincts."
                    }
                    print(json.dumps(result))
            sys.exit(0)

        # Filter candidates
        exclude_patterns = watch_cfg.get('excludePatterns', ['README.md', 'CHANGELOG.md', 'LICENSE.md', 'CLAUDE.md'])
        min_words = watch_cfg.get('minWords', 200)

        candidates = []
        for file_path in md_paths:
            debug_log(f"Checking: {file_path}")

            # Skip excluded files
            if is_excluded_file(file_path, exclude_patterns):
                debug_log(f"  SKIP (excluded pattern): {file_path}")
                continue

            # Skip files inside skill directories
            if is_inside_skill_directory(file_path):
                debug_log(f"  SKIP (skill directory): {file_path}")
                continue

            # Skip already suggested files
            if file_path in session_state['suggested_files']:
                debug_log(f"  SKIP (already suggested): {file_path}")
                continue

            # Quality check
            quality = check_file_quality(file_path, cwd, min_words)
            if not quality['passes']:
                debug_log(f"  SKIP (quality): {file_path} - {quality['reason']}")
                continue

            candidates.append({
                'path': file_path,
                'word_count': quality['word_count']
            })
            debug_log(f"  CANDIDATE: {file_path} ({quality['word_count']} words)")

        # Update session state
        session_state['last_processed_line'] = last_line

        # Check for accumulated observations (instinct suggestion)
        observe_enabled = observer_cfg.get('enabled', True)
        obs_count = 0
        instinct_suggestion = ""

        if observe_enabled:
            obs_threshold = watch_cfg.get('observeSuggestionThreshold', 50)
            obs_count = count_observations_since_last_analysis(cwd)
            debug_log(f"Observation count: {obs_count} (threshold: {obs_threshold})")

            if obs_count > obs_threshold:
                auto_threshold = instinct_cfg.get('autoApproveThreshold', 0.7)
                auto_count = count_auto_approved_instincts(cwd, auto_threshold)
                auto_hint = ""
                if auto_count > 0:
                    auto_hint = f" ({auto_count} instincts above auto-approve threshold)"

                instinct_suggestion = f"""

---

Also: {obs_count} tool use observations have accumulated{auto_hint}.
Run /observe to analyze patterns and extract instincts."""

        if not candidates:
            debug_log("EXIT: No qualifying candidates after filtering")
            save_session_state(state_path, session_state)

            # Even without .md candidates, suggest /observe if observations accumulated
            if instinct_suggestion:
                debug_log("TRIGGER: Blocking stop for instinct suggestion only")
                auto_threshold = instinct_cfg.get('autoApproveThreshold', 0.7)
                auto_count = count_auto_approved_instincts(cwd, auto_threshold)
                auto_hint = ""
                if auto_count > 0:
                    auto_hint = f" ({auto_count} instincts above auto-approve threshold)"

                result = {
                    'decision': 'block',
                    'reason': f"{obs_count} tool use observations have accumulated{auto_hint}.\nRun /observe to analyze patterns and extract instincts."
                }
                print(json.dumps(result))
            sys.exit(0)

        # Track suggested files
        for c in candidates:
            session_state['suggested_files'].append(c['path'])
        save_session_state(state_path, session_state)

        # Build suggestion message
        file_list = "\n".join(
            f"  - {c['path']} ({c['word_count']} words)"
            for c in candidates
        )

        reason = f"""Detected {len(candidates)} new markdown file(s) that look like skill candidates:

{file_list}

These files have substantial content with headings - they could become useful Claude skills!

To convert, run:
  /convert-to-skill <file-path>

Or scan all candidates:
  /learn-skill{instinct_suggestion}"""

        debug_log(f"TRIGGER: Blocking stop with {len(candidates)} candidates")

        result = {
            'decision': 'block',
            'reason': reason
        }
        print(json.dumps(result))
        sys.exit(0)

    except Exception as e:
        debug_log(f"EXIT: Exception - {e}")
        sys.exit(0)


if __name__ == '__main__':
    main()
