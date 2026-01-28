#!/usr/bin/env python3
"""
Quick Wins Permission-Asking Stop Hook

Detects completion signals and politely asks permission to run a quick wins scan
instead of forcing it. Respects user flow and autonomy.

Decision Logic:
1. Check exclusion criteria (urgency, mid-development, docs only, etc.) → Allow stop
2. Check for strong completion signals (1+) → Ask permission
3. Check for moderate completion signals (2+) → Ask permission
4. Otherwise → Allow stop
"""

import json
import sys
import re
from pathlib import Path


# Strong completion signals (1+ triggers permission request)
STRONG_SIGNALS = [
    # Explicit completion
    r'\b(done|finished|ready|complete|completed)\b',
    r'\blooks?\s+(good|great|fine|ok|okay)\b',
    r'\ball\s+set\b',
    r"that'?s?\s+it\b",

    # Commit intent
    r'\bready\s+to\s+commit\b',
    r"\blet'?s?\s+commit\b",
    r'\bcommit\s+(this|these|changes)\b',

    # Next steps queries
    r'\bwhat\s*\'?s?\s+next\b',
    r'\banything\s+else\b',
    r'\bwhat\s+(should\s+)?i\s+do\s+now\b',
    r'\bnow\s+what(\s+next)?\b',

    # Testing complete
    r'\btests?\s+(pass|passed|passing)\b',
    r'\ball\s+(green|tests?\s+green)\b',
    r'\btested\s+and\s+working\b',

    # Deployment mentions
    r'\bready\s+to\s+deploy\b',
    r'\bpush\s+to\s+prod\b',
]

# Moderate signals (2+ trigger permission request)
MODERATE_SIGNALS = [
    r'\bfeature\s+(is\s+)?(working|complete|done)\b',
    r'\bimplementation\s+(is\s+)?(complete|done|finished)\b',
    r'\brefactoring\s+(is\s+)?(complete|done|finished)\b',
    r'\bbuild\s+(passes|passed|successful)\b',
    r'\bno\s+(errors|issues|problems)\b',
]

# Exclusion keywords (if present, always allow stop)
EXCLUSION_SIGNALS = [
    # Urgency
    r'\b(urgent|critical|hotfix|emergency|asap|immediately)\b',
    r'\bproduction\s+(down|issue|bug)\b',

    # Explicit decline
    r'\bskip\s+(scan|review|quick\s+wins)\b',
    r'\bno\s+quick\s+wins\b',
    r'\bdon\'?t\s+(scan|check|review)\b',
    r'\bnot\s+now\b',

    # Mid-development indicators
    r'\bstill\s+(not\s+)?working\b',
    r'\blet\s+me\s+try\b',
    r'\btrying\s+to\b',
    r'\bdebugging\b',
]

# Code file extensions
CODE_EXTENSIONS = {
    '.ts', '.tsx', '.js', '.jsx',  # TypeScript/JavaScript
    '.cs',                          # C#
    '.component.ts', '.service.ts', '.module.ts', '.guard.ts',  # Angular
    '.controller.cs', '.facade.cs', '.logic.cs',  # .NET patterns
}

# Documentation/config extensions
DOC_EXTENSIONS = {
    '.md', '.txt', '.rst',
    '.json', '.yaml', '.yml', '.xml', '.toml', '.ini',
    '.gitignore', '.editorconfig',
}


def is_code_file(file_path: str) -> bool:
    """Check if a file is a code file."""
    if not file_path:
        return False

    path = Path(file_path)
    suffix = path.suffix.lower()

    if suffix in CODE_EXTENSIONS:
        return True

    # Check compound extensions
    name = path.name.lower()
    for ext in CODE_EXTENSIONS:
        if name.endswith(ext):
            return True

    return False


def is_doc_file(file_path: str) -> bool:
    """Check if a file is a documentation/config file."""
    if not file_path:
        return False

    path = Path(file_path)
    suffix = path.suffix.lower()
    return suffix in DOC_EXTENSIONS


def check_pattern_in_text(patterns: list, text: str) -> int:
    """Count how many patterns match in the text."""
    text_lower = text.lower()
    count = 0
    for pattern in patterns:
        if re.search(pattern, text_lower, re.IGNORECASE):
            count += 1
    return count


def extract_modified_files(transcript_path: str) -> list:
    """Extract files modified by Write/Edit/NotebookEdit tools."""
    modified_files = []

    try:
        with open(transcript_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue

                try:
                    entry = json.loads(line)
                except json.JSONDecodeError:
                    continue

                if entry.get('type') == 'assistant':
                    message = entry.get('message', {})
                    content = message.get('content', [])

                    for block in content:
                        if block.get('type') == 'tool_use':
                            tool_name = block.get('name', '')
                            tool_input = block.get('input', {})

                            if tool_name in ('Write', 'Edit', 'NotebookEdit'):
                                file_path = tool_input.get('file_path', '')
                                if file_path:
                                    modified_files.append(file_path)

    except Exception:
        pass

    return modified_files


def get_recent_user_messages(transcript_path: str, limit: int = 3) -> str:
    """Get the last N user messages from the transcript."""
    user_messages = []

    try:
        with open(transcript_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue

                try:
                    entry = json.loads(line)
                except json.JSONDecodeError:
                    continue

                if entry.get('type') == 'user':
                    message = entry.get('message', {})
                    content = message.get('content', [])

                    for block in content:
                        if block.get('type') == 'text':
                            text = block.get('text', '')
                            if text:
                                user_messages.append(text)

    except Exception:
        pass

    # Return last N messages
    return ' '.join(user_messages[-limit:]) if user_messages else ''


def analyze_completion_signals(transcript_path: str) -> dict:
    """
    Analyze the transcript to determine if we should ask permission for a scan.
    Returns a dict with 'should_ask', 'reason', and 'code_files'.
    """
    result = {
        'should_ask': False,
        'reason': '',
        'code_files': [],
    }

    # Get recent user messages (last 3 messages)
    recent_messages = get_recent_user_messages(transcript_path, limit=3)

    if not recent_messages:
        result['reason'] = 'No recent user messages'
        return result

    # Check for exclusion signals
    exclusion_count = check_pattern_in_text(EXCLUSION_SIGNALS, recent_messages)
    if exclusion_count > 0:
        result['reason'] = 'Exclusion signal detected'
        return result

    # Extract modified files
    modified_files = extract_modified_files(transcript_path)

    if not modified_files:
        result['reason'] = 'No files modified'
        return result

    # Categorize files
    code_files = [f for f in modified_files if is_code_file(f)]
    doc_files = [f for f in modified_files if is_doc_file(f)]

    # Only doc files modified
    if not code_files and doc_files:
        result['reason'] = 'Only documentation changes'
        return result

    if not code_files:
        result['reason'] = 'No code files modified'
        return result

    # Check for completion signals
    strong_signal_count = check_pattern_in_text(STRONG_SIGNALS, recent_messages)
    moderate_signal_count = check_pattern_in_text(MODERATE_SIGNALS, recent_messages)

    # Decision logic: Strong (1+) or Moderate (2+) triggers permission request
    if strong_signal_count >= 1 or moderate_signal_count >= 2:
        result['should_ask'] = True
        result['code_files'] = code_files
        result['reason'] = f'Completion signals detected (strong: {strong_signal_count}, moderate: {moderate_signal_count})'
    else:
        result['reason'] = f'Insufficient signals (strong: {strong_signal_count}, moderate: {moderate_signal_count})'

    return result


def main():
    """Main entry point for the stop hook."""
    try:
        # Read hook input from stdin
        input_data = json.load(sys.stdin)

        # Check if stop hook is already active (prevent infinite loops)
        if input_data.get('stop_hook_active', False):
            print(json.dumps({'ok': True}))
            sys.exit(0)

        # Get transcript path
        transcript_path = input_data.get('transcript_path', '')

        if not transcript_path:
            # No transcript, allow stop
            print(json.dumps({'ok': True}))
            sys.exit(0)

        # Analyze completion signals
        analysis = analyze_completion_signals(transcript_path)

        if analysis['should_ask']:
            # Ask permission instead of forcing
            code_files = analysis['code_files']
            unique_files = list(dict.fromkeys(code_files))

            # Format file list
            if len(unique_files) <= 3:
                file_list = ', '.join(Path(f).name for f in unique_files)
            else:
                file_list = ', '.join(Path(f).name for f in unique_files[:3])
                file_list += f' (+{len(unique_files) - 3} more)'

            # Friendly permission request
            result = {
                'decision': 'block',
                'reason': f'I noticed you modified {file_list}. Would you like me to run a quick wins scan to check for easy improvements? (Say "yes" to scan, or "no"/"skip" to continue)'
            }
            print(json.dumps(result))
        else:
            # Allow stop
            print(json.dumps({'ok': True}))

        sys.exit(0)

    except Exception as e:
        # On any error, allow stop (don't block user)
        print(json.dumps({'ok': True}))
        sys.exit(0)


if __name__ == '__main__':
    main()
