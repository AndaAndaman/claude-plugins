#!/usr/bin/env python3
"""
Local Memory Stop Hook

Analyzes conversation history to detect if CLAUDE.md files should be generated.
Only triggers when coding session appears complete (not during active development).

Decision Logic:
1. Load settings from .claude/local-memory.local.md
2. If autoGenerate is false -> Allow stop
3. Check for session completion signals (git commit, tests pass, etc.)
4. If session not complete -> Allow stop (don't interrupt active coding)
5. Load session state (last processed line, already suggested directories)
6. Parse transcript for NEW Edit/Write/NotebookEdit operations (since last run)
7. Group files by directory, exclude specified directories
8. Skip directories already suggested in this session
9. Skip directories with recently-updated CLAUDE.md (within cooldown period)
10. If any directory has >= threshold files -> Block and suggest MCP tools
11. Save session state (processed line, suggested directories)
12. Otherwise -> Allow stop

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
from settings import DEFAULT_EXCLUDED_DIRS, load_settings as _shared_load_settings, file_lock


# Global debug state
DEBUG_ENABLED = False
DEBUG_LOG_PATH = None


# ============================================================
# Pre-compiled regex patterns (module-level for performance)
# ============================================================

# Completion signal categories
_GIT_PATTERNS = [re.compile(p, re.IGNORECASE) for p in [
    r'git\s+(commit|push)',
]]

_TEST_PATTERNS = [re.compile(p, re.IGNORECASE) for p in [
    r'pass(ed|ing)?.*0\s+fail',
    r'0\s+failing',
    r'All\s+\d+\s+tests?\s+passed',
    r'OK\s+\(\d+',
    r'Passed!.*Failed[:\s]+0',
    r'Failed[:\s]+0',
]]

_BUILD_PATTERNS = [re.compile(p, re.IGNORECASE) for p in [
    r'Build\s+succeeded',
    r'0\s+Error\(s\)',
    r'Successfully\s+compiled',
    r'Compiled\s+successfully',
    r'nx\s+run.*succeeded',
]]

_TASK_PATTERNS = [re.compile(p, re.IGNORECASE) for p in [
    r'TaskUpdate.*completed',
]]

_COMPLETION_PHRASE_PATTERNS = [re.compile(p, re.IGNORECASE) for p in [
    r'"role":\s*"assistant".*\b(committed|pushed|done|complete|finished|ready to commit|looks good|that.s all|tests pass|build succeeded)\b',
    r'"role":\s*"assistant".*\b(all good|all set|here.s the summary|that.s it|wrap.?up|changes are ready|refactored|summary of changes)\b',
]]

_ACTIVE_CODING_PATTERNS = [re.compile(p) for p in [
    r'"name":\s*"(Edit|Write|NotebookEdit)"',
]]

# Tool use detection for file path extraction (cheap string check first)
_TOOL_USE_MARKER = '"tool_use"'
_TARGET_TOOLS = {'Edit', 'Write', 'NotebookEdit'}


def get_session_state_path(cwd: str, transcript_path: str) -> str:
    """Get path for session state file based on transcript path."""
    # Create a hash of the transcript path for a unique state file per session
    transcript_hash = hashlib.md5(transcript_path.encode()).hexdigest()[:12]
    state_dir = os.path.join(cwd, '.claude', 'local-memory-state')
    new_path = os.path.join(state_dir, f'{transcript_hash}.json')

    # Migrate from old flat layout if needed
    old_path = os.path.join(cwd, '.claude', f'local-memory-state-{transcript_hash}.json')
    if os.path.exists(old_path) and not os.path.exists(new_path):
        os.makedirs(state_dir, exist_ok=True)
        try:
            os.rename(old_path, new_path)
        except OSError:
            pass  # Fall through — load will handle either location

    return new_path


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
    """Save session state to file with file locking."""
    try:
        os.makedirs(os.path.dirname(state_path), exist_ok=True)
        state['last_run_time'] = datetime.now().isoformat()
        with file_lock(state_path):
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


def load_settings(cwd: str) -> dict:
    """Load settings from shared module (single source of truth)."""
    return _shared_load_settings(cwd)


def cleanup_stale_files(cwd: str, max_age_days: int = 7):
    """Remove session state and cache files older than max_age_days."""
    claude_dir = os.path.join(cwd, '.claude')
    if not os.path.isdir(claude_dir):
        return

    now = time.time()
    max_age_secs = max_age_days * 86400

    # Clean up new subdirectory layout
    for subdir_name in ('local-memory-state', 'local-memory-cache'):
        subdir = os.path.join(claude_dir, subdir_name)
        if not os.path.isdir(subdir):
            continue
        try:
            for entry in os.scandir(subdir):
                if entry.is_file() and entry.name.endswith('.json'):
                    try:
                        if now - entry.stat().st_mtime > max_age_secs:
                            os.remove(entry.path)
                            debug_log(f"Cleaned up stale file: {subdir_name}/{entry.name}")
                    except OSError:
                        pass
        except OSError:
            pass

    # Also clean up leftover old flat-layout files (migration period)
    try:
        for entry in os.scandir(claude_dir):
            if not entry.is_file():
                continue
            if (entry.name.startswith('local-memory-state-') or
                    entry.name.startswith('local-memory-cache-')) and entry.name.endswith('.json'):
                try:
                    os.remove(entry.path)
                    debug_log(f"Cleaned up old flat-layout file: {entry.name}")
                except OSError:
                    pass
    except OSError:
        pass


def scan_transcript(transcript_path: str, cwd: str, start_line: int = 0,
                    cached: dict = None) -> dict:
    """Single-pass transcript scan. Returns both completion signals and file paths.

    Merges the previously separate check_session_completion() and
    extract_file_paths_from_transcript() into one pass over the file.

    Args:
        transcript_path: Path to the JSONL transcript file
        cwd: Current working directory
        start_line: Line number to start from for file extraction (0-indexed)
        cached: Previous completion_cache from session state

    Returns dict with:
    - completion: dict with is_complete, reason, signals
    - file_paths: list of relative file paths from Edit/Write/NotebookEdit
    - last_line: int - last line number processed (for next run)
    - completion_cache: dict - updated cache for session state
    """
    # Initialize completion signals from cache
    has_commit = False
    has_test_success = False
    has_build_success = False
    has_task_complete = False
    has_completion_phrase = False
    last_edit_index = -1
    completion_start_line = 0

    if cached and isinstance(cached, dict) and cached.get('last_scanned_line', 0) > 0:
        completion_start_line = cached['last_scanned_line']
        has_commit = cached.get('has_commit', False)
        has_test_success = cached.get('has_test_success', False)
        has_build_success = cached.get('has_build_success', False)
        has_task_complete = cached.get('has_task_complete', False)
        has_completion_phrase = cached.get('has_completion_phrase', False)
        last_edit_index = cached.get('last_edit_index', -1)

    # File extraction state
    file_paths = []
    seen_paths = set()
    total_entries = 0
    last_line = start_line

    normalized_cwd = os.path.normpath(cwd)

    try:
        with open(transcript_path, 'r', encoding='utf-8') as f:
            for line_num, raw_line in enumerate(f):
                total_entries = line_num + 1

                # Phase 1: Completion signal detection (from completion_start_line)
                if line_num >= completion_start_line:
                    for pat in _GIT_PATTERNS:
                        if pat.search(raw_line):
                            has_commit = True
                            break

                    for pat in _TEST_PATTERNS:
                        if pat.search(raw_line):
                            has_test_success = True
                            break

                    for pat in _BUILD_PATTERNS:
                        if pat.search(raw_line):
                            has_build_success = True
                            break

                    for pat in _TASK_PATTERNS:
                        if pat.search(raw_line):
                            has_task_complete = True
                            break

                    for pat in _COMPLETION_PHRASE_PATTERNS:
                        if pat.search(raw_line):
                            has_completion_phrase = True
                            break

                    # Track last Edit/Write operation
                    for pat in _ACTIVE_CODING_PATTERNS:
                        if pat.search(raw_line):
                            last_edit_index = line_num
                            break

                # Phase 2: File path extraction (from start_line, only for tool_use lines)
                if line_num >= start_line:
                    last_line = line_num + 1

                    if _TOOL_USE_MARKER in raw_line:
                        try:
                            entry = json.loads(raw_line.strip())
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
                            if tool_name not in _TARGET_TOOLS:
                                continue

                            tool_input = item.get('input', {})
                            if not isinstance(tool_input, dict):
                                continue

                            file_path = tool_input.get('file_path', '') or tool_input.get('notebook_path', '')
                            if not file_path:
                                continue

                            # Normalize path to OS-native separators
                            file_path = os.path.normpath(file_path)

                            # Strip cwd prefix to get relative path
                            if file_path.startswith(normalized_cwd):
                                file_path = file_path[len(normalized_cwd):].lstrip(os.sep)
                            elif os.path.isabs(file_path):
                                # File is outside project root — skip it
                                continue

                            if file_path not in seen_paths:
                                seen_paths.add(file_path)
                                file_paths.append(file_path)

    except Exception as e:
        debug_log(f"Error scanning transcript: {e}")

    # Build completion cache
    completion_cache = {
        'last_scanned_line': total_entries,
        'has_commit': has_commit,
        'has_test_success': has_test_success,
        'has_build_success': has_build_success,
        'has_task_complete': has_task_complete,
        'has_completion_phrase': has_completion_phrase,
        'last_edit_index': last_edit_index
    }

    # Determine if session is complete
    entries_since_last_edit = total_entries - last_edit_index
    is_complete = False
    reason = 'No completion signals detected'

    if has_commit and entries_since_last_edit > 3:
        is_complete = True
        reason = 'Git commit/push detected with no recent edits'
    elif has_test_success and entries_since_last_edit > 5:
        is_complete = True
        reason = 'Tests passed (0 failures) with no recent edits'
    elif has_build_success and entries_since_last_edit > 5:
        is_complete = True
        reason = 'Build succeeded (0 errors) with no recent edits'
    elif has_task_complete and entries_since_last_edit > 5:
        is_complete = True
        reason = 'Task marked complete with no recent edits'
    elif has_completion_phrase and entries_since_last_edit > 5:
        is_complete = True
        reason = 'Completion phrase detected with no recent edits'
    elif last_edit_index == -1:
        is_complete = False
        reason = 'No file modifications in session'
    elif entries_since_last_edit > 15:
        is_complete = True
        reason = f'No edits in last {entries_since_last_edit} transcript entries'

    return {
        'completion': {
            'is_complete': is_complete,
            'reason': reason,
            'has_commit': has_commit,
            'has_test_success': has_test_success,
            'has_build_success': has_build_success,
            'has_task_complete': has_task_complete,
            'has_completion_phrase': has_completion_phrase,
            'last_edit_index': last_edit_index,
            'total_entries': total_entries,
        },
        'file_paths': file_paths,
        'last_line': last_line,
        'completion_cache': completion_cache,
    }


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

        # Team detection: check if running inside a team session
        is_team_session = bool(input_data.get('team_name'))
        if is_team_session:
            debug_log(f"Team session detected: {input_data.get('team_name')}")

        # Load session state for incremental processing
        state_path = get_session_state_path(cwd, transcript_path)
        session_state = load_session_state(state_path)
        debug_log(f"Session state: last_line={session_state['last_processed_line']}, already_suggested={session_state['suggested_directories']}")

        # Cleanup stale state/cache files on first invocation
        if session_state['last_processed_line'] == 0:
            cleanup_stale_files(cwd)

        # Single-pass transcript scan (replaces separate completion check + file extraction)
        scan_result = scan_transcript(
            transcript_path, cwd,
            start_line=session_state['last_processed_line'],
            cached=session_state.get('completion_cache')
        )

        completion = scan_result['completion']
        file_paths = scan_result['file_paths']
        last_line = scan_result['last_line']

        debug_log(f"Transcript scan (single-pass): is_complete={completion['is_complete']}, reason='{completion['reason']}'")
        debug_log(f"  - has_commit={completion['has_commit']}, has_test_success={completion['has_test_success']}")
        debug_log(f"  - has_build_success={completion['has_build_success']}, has_task_complete={completion['has_task_complete']}")
        debug_log(f"  - has_completion_phrase={completion['has_completion_phrase']}")
        debug_log(f"  - last_edit_index={completion['last_edit_index']}, total_entries={completion['total_entries']}")
        debug_log(f"  - extracted {len(file_paths)} file paths (lines {session_state['last_processed_line']}-{last_line})")

        # Always update completion cache in session state
        session_state['completion_cache'] = scan_result['completion_cache']

        if not completion['is_complete']:
            debug_log(f"EXIT: Session not complete - {completion['reason']}")
            # Save updated completion cache even when exiting early
            save_session_state(state_path, session_state)
            sys.exit(0)

        if not file_paths:
            debug_log("EXIT: No NEW Edit/Write/NotebookEdit operations found")
            # Still update the processed line to avoid re-scanning
            session_state['last_processed_line'] = last_line
            save_session_state(state_path, session_state)
            sys.exit(0)

        debug_log(f"Extracted {len(file_paths)} file paths from transcript")

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

        debug_log(f"TRIGGER: {'Suggesting' if is_team_session else 'Blocking'} stop with {len(candidate_dirs)} directories")

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

        # Team detection: use 'allow' + systemMessage instead of 'block' to avoid
        # interrupting teammate workflows
        if is_team_session:
            result = {
                'decision': 'allow',
                'reason': reason
            }
        else:
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
