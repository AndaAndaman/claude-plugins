#!/usr/bin/env python3
"""
Quick Wins Stop Hook

Analyzes the conversation transcript to determine if a quick wins
code quality scan should be triggered after the user stops.

Decision Logic:
1. Check if significant code changes were made (Write/Edit tools on code files)
2. Skip if urgent/hotfix keywords detected
3. Skip if user explicitly said "skip scan" or "no quick wins"
4. Skip if only documentation changes
5. Trigger scan for TypeScript, JavaScript, Angular, C#/.NET code changes
"""

import json
import sys
import re
from pathlib import Path


# Supported code file extensions
CODE_EXTENSIONS = {
    '.ts', '.tsx', '.js', '.jsx',  # TypeScript/JavaScript
    '.cs',                          # C#/.NET
    '.component.ts', '.service.ts', '.module.ts',  # Angular
}

# Documentation/config extensions to ignore
DOC_EXTENSIONS = {
    '.md', '.txt', '.json', '.yaml', '.yml', '.xml',
    '.gitignore', '.editorconfig',
}

# Keywords that indicate we should skip scanning
SKIP_KEYWORDS = [
    'urgent', 'critical', 'hotfix', 'production issue',
    'skip scan', 'no quick wins', 'don\'t scan', 'skip review',
]


def is_code_file(file_path: str) -> bool:
    """Check if a file path is a supported code file."""
    if not file_path:
        return False

    path = Path(file_path)
    suffix = path.suffix.lower()

    # Check direct extension match
    if suffix in CODE_EXTENSIONS:
        return True

    # Check compound extensions (e.g., .component.ts)
    name = path.name.lower()
    for ext in CODE_EXTENSIONS:
        if name.endswith(ext):
            return True

    return False


def is_doc_file(file_path: str) -> bool:
    """Check if a file path is a documentation/config file."""
    if not file_path:
        return False

    path = Path(file_path)
    suffix = path.suffix.lower()
    return suffix in DOC_EXTENSIONS


def should_skip_scan(transcript_content: str) -> bool:
    """Check if any skip keywords are present in the conversation."""
    content_lower = transcript_content.lower()
    for keyword in SKIP_KEYWORDS:
        if keyword in content_lower:
            return True
    return False


def extract_modified_files(transcript_path: str) -> list:
    """
    Read the transcript and extract files modified by Write/Edit/NotebookEdit tools.
    Returns a list of file paths that were modified.
    """
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

                # Look for tool use entries
                if entry.get('type') == 'assistant':
                    message = entry.get('message', {})
                    content = message.get('content', [])

                    for block in content:
                        if block.get('type') == 'tool_use':
                            tool_name = block.get('name', '')
                            tool_input = block.get('input', {})

                            # Check for file modification tools
                            if tool_name in ('Write', 'Edit', 'NotebookEdit'):
                                file_path = tool_input.get('file_path', '')
                                if file_path:
                                    modified_files.append(file_path)

    except Exception as e:
        # If we can't read transcript, return empty list
        pass

    return modified_files


def analyze_changes(transcript_path: str) -> dict:
    """
    Analyze the transcript to determine if quick wins scan should run.
    Returns a dict with 'should_scan', 'reason', and 'code_files'.
    """
    result = {
        'should_scan': False,
        'reason': '',
        'code_files': [],
    }

    # Read transcript content for skip keyword check
    try:
        with open(transcript_path, 'r', encoding='utf-8') as f:
            transcript_content = f.read()
    except Exception:
        result['reason'] = 'Could not read transcript'
        return result

    # Check for skip keywords
    if should_skip_scan(transcript_content):
        result['reason'] = 'Skip keyword detected'
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

    # Code files modified - trigger scan
    if code_files:
        result['should_scan'] = True
        result['code_files'] = code_files
        result['reason'] = f'Code changes in {len(code_files)} file(s)'

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

        # Analyze changes
        analysis = analyze_changes(transcript_path)

        if analysis['should_scan']:
            # Block stop and trigger quick wins scan
            code_files = analysis['code_files']
            # Deduplicate files
            unique_files = list(dict.fromkeys(code_files))
            file_list = ', '.join(Path(f).name for f in unique_files[:3])
            if len(unique_files) > 3:
                file_list += f' (+{len(unique_files) - 3} more)'

            result = {
                'decision': 'block',
                'reason': f'IMPORTANT: Before stopping, you MUST use the Skill tool to invoke "quick-wins" Skill(quick-wins:quick-wins) to scan these modified files for code quality improvements: {file_list}. This is required by the quick-wins plugin.'
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
