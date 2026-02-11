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
5. Load session state (last processed line, already suggested directories)
6. Parse transcript for NEW Edit/Write/NotebookEdit operations (since last run)
7. Group files by directory, exclude specified directories
8. Skip directories already suggested in this session
9. Skip directories with recently-updated CLAUDE.md (within cooldown period)
10. If any directory has >= threshold files → Block and suggest MCP tools
11. Save session state (processed line, suggested directories)
12. Otherwise → Allow stop

Debug Mode:
- Set debug: true in .claude/local-memory.local.md, OR
- Set environment variable LOCAL_MEMORY_DEBUG=1
- Logs written to .claude/local-memory-debug.log
"""

import json
import sys
import re
import os
import time
import hashlib
from pathlib import Path
from collections import defaultdict
from datetime import datetime

# Add shared module to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'shared'))
from settings import DEFAULT_EXCLUDED_DIRS, load_settings as _shared_load_settings


# Global debug state
DEBUG_ENABLED = False
DEBUG_LOG_PATH = None


def get_session_state_path(cwd: str, transcript_path: str) -> str:
    """Get path for session state file based on transcript path."""
    # Create a hash of the transcript path for a unique state file per session
    transcript_hash = hashlib.md5(transcript_path.encode()).hexdigest()[:12]
    return os.path.join(cwd, '.claude', f'local-memory-state-{transcript_hash}.json')


def load_session_state(state_path: str) -> dict:
    """Load session state from file."""
    default_completion_cache = {
        'last_scanned_line': 0,
        'has_commit': False,
        'has_test_success': False,
        'has_build_success': False,
        'has_task_complete': False,
        'has_completion_phrase': False,
        'last_edit_index': -1
    }
    default_state = {
        'last_processed_line': 0,
        'suggested_directories': [],
        'last_run_time': None,
        'generation_times': {},
        'completion_cache': dict(default_completion_cache)
    }

    if not os.path.exists(state_path):
        return default_state

    try:
        with open(state_path, 'r', encoding='utf-8') as f:
            state = json.load(f)
            # Ensure all required keys exist
            for key, default_val in default_state.items():
                if key not in state:
                    state[key] = default_val
            # Ensure completion_cache sub-keys exist
            if 'completion_cache' in state and isinstance(state['completion_cache'], dict):
                for key, default_val in default_completion_cache.items():
                    if key not in state['completion_cache']:
                        state['completion_cache'][key] = default_val
            else:
                state['completion_cache'] = dict(default_completion_cache)
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


def init_debug(cwd: str, settings: dict):
    """Initialize debug mode based on settings or environment."""
    global DEBUG_ENABLED, DEBUG_LOG_PATH

    # Check environment variable
    if os.environ.get('LOCAL_MEMORY_DEBUG', '').lower() in ('1', 'true', 'yes'):
        DEBUG_ENABLED = True

    # Check settings
    if settings.get('debug', False):
        DEBUG_ENABLED = True

    if DEBUG_ENABLED:
        DEBUG_LOG_PATH = os.path.join(cwd, '.claude', 'local-memory-debug.log')
        # Ensure .claude directory exists
        os.makedirs(os.path.dirname(DEBUG_LOG_PATH), exist_ok=True)
        debug_log("=" * 60)
        debug_log("Stop hook triggered")
        debug_log(f"CWD: {cwd}")


# Default settings (from shared module, kept as local references)
# DEFAULT_EXCLUDED_DIRS imported from shared.settings

# Completion signal patterns (detected in transcript)
COMPLETION_SIGNALS = [
    # Git operations indicate work is done
    r'"name":\s*"Bash".*"command":\s*"[^"]*git\s+(commit|push)',

    # Test success patterns (0 errors/failures in output)
    r'(\d+)\s+pass(ed|ing)?,?\s+0\s+fail',           # "5 passed, 0 failed"
    r'Tests:\s+\d+\s+passed,\s+0\s+failed',          # Jest: "Tests: 5 passed, 0 failed"
    r'0\s+failing',                                   # Mocha: "0 failing"
    r'passed.*0\s+errors?',                          # Generic: "passed, 0 errors"
    r'All\s+\d+\s+tests?\s+passed',                  # "All 5 tests passed"
    r'OK\s+\(\d+\s+tests?\)',                        # pytest: "OK (5 tests)"
    r'Passed!.*Failed[:\s]+0',                        # dotnet: "Passed! - Failed: 0"
    r'Failed[:\s]+0',                                 # Generic: "Failed: 0"

    # Build success patterns (0 errors in output)
    r'Build\s+succeeded',                            # dotnet/MSBuild
    r'0\s+Error\(s\)',                               # MSBuild: "0 Error(s)"
    r'Successfully\s+compiled',                      # Generic
    r'Compiled\s+successfully',                      # TypeScript/Webpack
    r'Build\s+complete.*0\s+errors?',                # Generic
    r'nx\s+run.*succeeded',                          # Nx: "nx run project:build succeeded"

    # Task completion
    r'"name":\s*"TaskUpdate".*"status":\s*"completed"',

    # Explicit completion phrases in assistant messages
    r'"role":\s*"assistant".*\b(committed|pushed|done|complete|finished|ready to commit|looks good|that.s all|tests pass|build succeeded)\b',
    r'"role":\s*"assistant".*\b(all good|all set|here.s the summary|that.s it|wrap.?up|changes are ready|refactored|summary of changes)\b',
]

# Active coding signals (should NOT trigger during these)
ACTIVE_CODING_SIGNALS = [
    # Recent Edit/Write operations (within last few entries)
    r'"name":\s*"(Edit|Write|NotebookEdit)"',
]


def load_settings(cwd: str) -> dict:
    """Load settings from shared module (single source of truth)."""
    return _shared_load_settings(cwd)


def check_session_completion(transcript_path: str, cached: dict = None) -> dict:
    """
    Analyze transcript to detect if coding session appears complete.
    Uses cached completion signals to avoid re-scanning the entire transcript.

    Args:
        transcript_path: Path to the JSONL transcript file
        cached: Previous completion_cache from session state. If provided,
                only new lines (after last_scanned_line) are scanned.

    Returns dict with:
    - is_complete: bool - True if session appears done
    - reason: str - Why we think session is/isn't complete
    - last_edit_index: int - Index of last Edit/Write operation
    - total_entries: int - Total transcript entries
    - completion_cache: dict - Updated cache to store in session state
    """
    result = {
        'is_complete': False,
        'reason': 'No completion signals detected',
        'last_edit_index': -1,
        'total_entries': 0,
        'has_commit': False,
        'has_test_success': False,
        'has_build_success': False,
        'has_task_complete': False,
        'has_completion_phrase': False
    }

    # Initialize from cache if provided
    start_line = 0
    if cached and isinstance(cached, dict) and cached.get('last_scanned_line', 0) > 0:
        start_line = cached['last_scanned_line']
        result['has_commit'] = cached.get('has_commit', False)
        result['has_test_success'] = cached.get('has_test_success', False)
        result['has_build_success'] = cached.get('has_build_success', False)
        result['has_task_complete'] = cached.get('has_task_complete', False)
        result['has_completion_phrase'] = cached.get('has_completion_phrase', False)
        result['last_edit_index'] = cached.get('last_edit_index', -1)

    # Signal categories for better reason reporting
    git_patterns = [r'git\s+(commit|push)']
    test_patterns = [r'pass(ed|ing)?.*0\s+fail', r'0\s+failing', r'All\s+\d+\s+tests?\s+passed', r'OK\s+\(\d+', r'Passed!.*Failed[:\s]+0', r'Failed[:\s]+0']
    build_patterns = [r'Build\s+succeeded', r'0\s+Error\(s\)', r'Successfully\s+compiled', r'Compiled\s+successfully', r'nx\s+run.*succeeded']
    task_patterns = [r'TaskUpdate.*completed']

    try:
        with open(transcript_path, 'r', encoding='utf-8') as f:
            for i, line in enumerate(f):
                # Always count total entries
                result['total_entries'] = i + 1

                # Skip already-scanned lines for signal detection
                if i < start_line:
                    continue

                # Check for completion signals by category
                for pattern in git_patterns:
                    if re.search(pattern, line, re.IGNORECASE):
                        result['has_commit'] = True

                for pattern in test_patterns:
                    if re.search(pattern, line, re.IGNORECASE):
                        result['has_test_success'] = True

                for pattern in build_patterns:
                    if re.search(pattern, line, re.IGNORECASE):
                        result['has_build_success'] = True

                for pattern in task_patterns:
                    if re.search(pattern, line, re.IGNORECASE):
                        result['has_task_complete'] = True

                # Check all COMPLETION_SIGNALS for general completion phrases
                for pattern in COMPLETION_SIGNALS:
                    if re.search(pattern, line, re.IGNORECASE):
                        if '"role"' in pattern and '"assistant"' in pattern:
                            result['has_completion_phrase'] = True

                # Track last Edit/Write operation
                for pattern in ACTIVE_CODING_SIGNALS:
                    if re.search(pattern, line):
                        result['last_edit_index'] = i

        # Build updated cache for next run
        result['completion_cache'] = {
            'last_scanned_line': result['total_entries'],
            'has_commit': result['has_commit'],
            'has_test_success': result['has_test_success'],
            'has_build_success': result['has_build_success'],
            'has_task_complete': result['has_task_complete'],
            'has_completion_phrase': result['has_completion_phrase'],
            'last_edit_index': result['last_edit_index']
        }

        # Determine if session is complete
        entries_since_last_edit = result['total_entries'] - result['last_edit_index']

        # Session is complete if:
        # 1. Has git commit/push, OR
        # 2. Has test success (0 failures) AND no edits in last 5 entries, OR
        # 3. Has build success (0 errors) AND no edits in last 5 entries, OR
        # 4. Has task marked complete AND no edits in last 5 entries, OR
        # 5. Has completion phrase AND no edits in last 5 entries, OR
        # 6. No edits in last 15 entries (long conversation gap)
        if result['has_commit'] and entries_since_last_edit > 3:
            result['is_complete'] = True
            result['reason'] = 'Git commit/push detected with no recent edits'
        elif result['has_test_success'] and entries_since_last_edit > 5:
            result['is_complete'] = True
            result['reason'] = 'Tests passed (0 failures) with no recent edits'
        elif result['has_build_success'] and entries_since_last_edit > 5:
            result['is_complete'] = True
            result['reason'] = 'Build succeeded (0 errors) with no recent edits'
        elif result['has_task_complete'] and entries_since_last_edit > 5:
            result['is_complete'] = True
            result['reason'] = 'Task marked complete with no recent edits'
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
        # Preserve existing cache on error
        result['completion_cache'] = cached if cached else {
            'last_scanned_line': 0, 'has_commit': False, 'has_test_success': False,
            'has_build_success': False, 'has_task_complete': False,
            'has_completion_phrase': False, 'last_edit_index': -1
        }

    return result


def is_claude_md_recent(dir_path: str, cwd: str, cooldown_minutes: int, session_state: dict = None) -> bool:
    """
    Check if CLAUDE.md in directory was generated within cooldown period.
    Uses session state generation_times instead of file mtime to avoid
    false cooldown resets when users manually edit CLAUDE.md.
    Returns True if should skip (recently generated), False otherwise.
    """
    # Normalize path separators for cross-platform compatibility
    dir_path = os.path.normpath(dir_path)
    cwd = os.path.normpath(cwd)

    # Build absolute path
    if not os.path.isabs(dir_path):
        full_dir = os.path.join(cwd, dir_path)
    else:
        full_dir = dir_path

    # Normalize again after join to ensure consistent separators
    full_dir = os.path.normpath(full_dir)

    debug_log(f"  Cooldown check: {full_dir}")

    # Check session state generation_times instead of file mtime
    generation_times = (session_state or {}).get('generation_times', {})

    # Look up by both the original dir_path and the full_dir (normalized)
    gen_time_str = generation_times.get(dir_path) or generation_times.get(full_dir)

    if not gen_time_str:
        debug_log(f"    -> No generation time recorded for this directory")
        return False

    try:
        gen_time = datetime.fromisoformat(gen_time_str)
        age_minutes = (datetime.now() - gen_time).total_seconds() / 60

        is_recent = age_minutes < cooldown_minutes
        debug_log(f"    -> Generated {age_minutes:.1f}min ago, cooldown: {cooldown_minutes}min, skip: {is_recent}")

        return is_recent

    except (ValueError, TypeError) as e:
        debug_log(f"    -> Error parsing generation time '{gen_time_str}': {e}")
        return False


def extract_file_paths_from_transcript(transcript_path: str, cwd: str, start_line: int = 0) -> tuple:
    """
    Extract file paths from Edit/Write/NotebookEdit tool invocations.

    Args:
        transcript_path: Path to the JSONL transcript file
        cwd: Current working directory
        start_line: Line number to start from (0-indexed, skips lines before this)

    Returns:
        Tuple of (file_paths: list, last_line: int)
    """
    file_paths = []
    seen_paths = set()
    target_tools = {'Edit', 'Write', 'NotebookEdit'}
    last_line = start_line

    try:
        with open(transcript_path, 'r', encoding='utf-8') as f:
            for line_num, line in enumerate(f):
                # Skip lines we've already processed
                if line_num < start_line:
                    continue

                last_line = line_num + 1  # Track progress (1-indexed for next run)

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

                    file_path = tool_input.get('file_path', '') or tool_input.get('notebook_path', '')
                    if not file_path:
                        continue

                    # Normalize path to OS-native separators
                    file_path = os.path.normpath(file_path)
                    normalized_cwd = os.path.normpath(cwd)

                    # Strip cwd prefix to get relative path
                    if file_path.startswith(normalized_cwd):
                        file_path = file_path[len(normalized_cwd):].lstrip(os.sep)

                    if file_path not in seen_paths:
                        seen_paths.add(file_path)
                        file_paths.append(file_path)

    except Exception as e:
        debug_log(f"Error extracting file paths: {e}")

    return file_paths, last_line


def group_files_by_directory(file_paths: list, cwd: str, excluded_dirs: list, threshold: int = 2) -> tuple:
    """Group files by directory with parent aggregation.

    Files are grouped by their immediate parent directory first.
    Then, sibling directories that individually fall below threshold
    are aggregated into their common parent directory.

    Returns:
        Tuple of (dir_counts: dict, aggregation_info: dict)
        - dir_counts maps directory path to file count
        - aggregation_info maps parent dirs to {direct, from_children, child_count}
    """
    dir_counts = defaultdict(int)

    for file_path in file_paths:
        # Normalize path to use OS-native separators
        file_path = os.path.normpath(file_path)
        dir_path = str(Path(file_path).parent)

        skip = False
        path_parts = Path(dir_path).parts
        for excluded in excluded_dirs:
            if excluded in path_parts:
                skip = True
                break

        if not skip:
            dir_counts[dir_path] += 1

    # Parent aggregation: when multiple sibling dirs are below threshold,
    # aggregate their counts into the parent directory.
    # Built in a separate pass to avoid mutating dir_counts during iteration.
    parent_overflow = defaultdict(int)
    below_threshold_dirs = []

    for dir_path, count in dir_counts.items():
        if count < threshold:
            parent = str(Path(dir_path).parent)
            parent_overflow[parent] += count
            below_threshold_dirs.append(dir_path)

    # Build final result in a new dict
    result = {}
    aggregation_info = {}

    # Keep dirs that are above threshold and NOT being aggregated into a parent
    aggregated_children = set()
    for parent, total in parent_overflow.items():
        existing = dir_counts.get(parent, 0)
        combined = existing + total

        if combined >= threshold:
            result[parent] = combined
            child_count = sum(1 for d in below_threshold_dirs if str(Path(d).parent) == parent)
            debug_log(f"  Parent aggregation: {parent} ({existing} direct + {total} from {child_count} subdirs = {combined} files)")
            aggregation_info[parent] = {
                'direct': existing,
                'from_children': total,
                'child_count': child_count
            }
            for child_dir in below_threshold_dirs:
                if str(Path(child_dir).parent) == parent:
                    aggregated_children.add(child_dir)

    # Copy over all non-aggregated dirs
    for dir_path, count in dir_counts.items():
        if dir_path not in aggregated_children and dir_path not in result:
            result[dir_path] = count

    return result, aggregation_info


def main():
    """Main entry point for the stop hook."""
    try:
        input_data = json.load(sys.stdin)

        # Infinite loop guard
        if input_data.get('stop_hook_active'):
            debug_log("EXIT: stop_hook_active=True (infinite loop guard)")
            sys.exit(0)

        cwd = input_data.get('cwd', '.')
        transcript_path = input_data.get('transcript_path', '')

        if not transcript_path:
            debug_log("EXIT: No transcript_path provided")
            sys.exit(0)

        # Load settings
        settings = load_settings(cwd)

        # Initialize debug mode
        init_debug(cwd, settings)
        debug_log(f"Settings: threshold={settings['threshold']}, autoGenerate={settings['autoGenerate']}, cooldown={settings['cooldownMinutes']}min")

        if not settings['autoGenerate']:
            debug_log("EXIT: autoGenerate=False (disabled)")
            sys.exit(0)

        # Load session state for incremental processing
        state_path = get_session_state_path(cwd, transcript_path)
        session_state = load_session_state(state_path)
        debug_log(f"Session state: last_line={session_state['last_processed_line']}, already_suggested={session_state['suggested_directories']}")

        # Check if session appears complete (using cached signals for incremental scanning)
        completion = check_session_completion(transcript_path, cached=session_state.get('completion_cache'))
        debug_log(f"Completion check: is_complete={completion['is_complete']}, reason='{completion['reason']}'")
        debug_log(f"  - has_commit={completion['has_commit']}, has_test_success={completion['has_test_success']}")
        debug_log(f"  - has_build_success={completion['has_build_success']}, has_task_complete={completion['has_task_complete']}")
        debug_log(f"  - has_completion_phrase={completion['has_completion_phrase']}")
        debug_log(f"  - last_edit_index={completion['last_edit_index']}, total_entries={completion['total_entries']}")

        # Always update completion cache in session state
        if 'completion_cache' in completion:
            session_state['completion_cache'] = completion['completion_cache']

        if not completion['is_complete']:
            debug_log(f"EXIT: Session not complete - {completion['reason']}")
            # Save updated completion cache even when exiting early
            save_session_state(state_path, session_state)
            sys.exit(0)

        # Extract file paths (only from new transcript entries)
        file_paths, last_line = extract_file_paths_from_transcript(
            transcript_path, cwd, session_state['last_processed_line']
        )
        debug_log(f"Extracted {len(file_paths)} file paths from transcript (lines {session_state['last_processed_line']}-{last_line})")

        if not file_paths:
            debug_log("EXIT: No NEW Edit/Write/NotebookEdit operations found")
            # Still update the processed line to avoid re-scanning
            session_state['last_processed_line'] = last_line
            save_session_state(state_path, session_state)
            sys.exit(0)

        # Group by directory (with parent aggregation for cross-dir refactoring)
        dir_counts, aggregation_info = group_files_by_directory(
            file_paths,
            cwd,
            settings['excludedDirectories'],
            settings['threshold']
        )
        debug_log(f"Directories with edits: {dict(dir_counts)}")

        # Find directories meeting threshold, excluding recently-updated or already-suggested ones
        candidate_dirs = []
        skipped_dirs = []
        skipped_already_suggested = []
        below_threshold_dirs = []

        for dir_path, count in dir_counts.items():
            if count < settings['threshold']:
                below_threshold_dirs.append((dir_path, count))
                continue

            # Skip directories already suggested in this session
            if dir_path in session_state['suggested_directories']:
                skipped_already_suggested.append(dir_path)
                debug_log(f"  SKIP (already suggested): {dir_path}")
                continue

            if is_claude_md_recent(dir_path, cwd, settings['cooldownMinutes'], session_state):
                skipped_dirs.append(dir_path)
                debug_log(f"  SKIP (cooldown): {dir_path} - CLAUDE.md recently generated")
                continue

            candidate_dirs.append((dir_path, count))
            debug_log(f"  CANDIDATE: {dir_path} ({count} files)")

        if below_threshold_dirs:
            debug_log(f"Below threshold (need {settings['threshold']}): {below_threshold_dirs}")

        # Update session state - track processed lines even if no candidates
        session_state['last_processed_line'] = last_line

        if not candidate_dirs:
            debug_log("EXIT: No candidate directories (all below threshold, cooldown, or already suggested)")
            save_session_state(state_path, session_state)
            sys.exit(0)

        # Build output
        dirs_list = [dir_path for dir_path, _ in candidate_dirs]

        # Build summary with clear direct vs aggregated counts
        summary_parts = []
        for dir_path, count in candidate_dirs:
            if dir_path in aggregation_info:
                info = aggregation_info[dir_path]
                summary_parts.append(
                    f"{dir_path} ({info['direct']} direct + {info['from_children']} from {info['child_count']} subdirs)"
                )
            else:
                summary_parts.append(f"{dir_path} ({count} files)")
        summary = ", ".join(summary_parts)

        debug_log(f"TRIGGER: Blocking stop with {len(candidate_dirs)} directories")

        # Update session state with newly suggested directories and generation times
        session_state['suggested_directories'].extend(dirs_list)
        now_iso = datetime.now().isoformat()
        for dir_path in dirs_list:
            session_state['generation_times'][dir_path] = now_iso
        save_session_state(state_path, session_state)

        reason = f"""Session complete ({completion['reason']}). Detected file changes in {summary}.

Use the Task tool to spawn the context-builder agent to build CLAUDE.md context files:

Task(local-memory:context-builder)

Prompt the agent with: "Build CLAUDE.md context files for the following directories: {json.dumps(dirs_list)}. Project root: {cwd}. Use the local-memory MCP tools (analyze_directory, generate_context, write_context) for each directory."

The context-builder agent has access to all local-memory MCP tools and will orchestrate the workflow automatically."""

        skip_notes = []
        if skipped_dirs:
            skip_notes.append(f"{len(skipped_dirs)} directories with recent CLAUDE.md updates")
        if skipped_already_suggested:
            skip_notes.append(f"{len(skipped_already_suggested)} directories already suggested this session")
        if skip_notes:
            reason += f"\n\n(Skipped: {', '.join(skip_notes)})"

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
