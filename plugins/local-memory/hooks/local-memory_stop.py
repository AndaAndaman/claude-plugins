#!/usr/bin/env python3
"""
Local Memory Stop Hook

Analyzes conversation history to detect if CLAUDE.md files should be generated.
Checks for Edit/Write/NotebookEdit operations, groups files by directory,
and triggers context generation when thresholds are met.

Decision Logic:
1. Load settings from .claude/local-memory.local.md (autoGenerate, threshold, etc.)
2. If autoGenerate is false → Allow stop
3. Parse transcript for Edit/Write/NotebookEdit operations
4. Group files by directory, exclude specified directories
5. If any directory has >= threshold files → Block and suggest MCP tools
6. Otherwise → Allow stop
"""

import json
import sys
import re
from pathlib import Path
from collections import defaultdict


# Default settings
DEFAULT_THRESHOLD = 2
DEFAULT_AUTO_GENERATE = True
DEFAULT_MAX_FILES = 50
DEFAULT_EXCLUDED_DIRS = [
    "node_modules", "vendor", "packages",
    ".git", ".svn", ".hg", ".bzr",
    "dist", "build", "out", "target", "bin", "obj",
    "test", "tests", "spec", "specs", "__tests__", "__snapshots__",
    "coverage", ".next", ".nuxt", ".angular", "__pycache__",
    "temp", "tmp", "cache"
]


def load_settings(cwd: str) -> dict:
    """
    Load settings from .claude/local-memory.local.md YAML frontmatter.
    Returns dict with threshold, autoGenerate, maxFilesAnalyzed, excludedDirectories.
    """
    settings = {
        'threshold': DEFAULT_THRESHOLD,
        'autoGenerate': DEFAULT_AUTO_GENERATE,
        'maxFilesAnalyzed': DEFAULT_MAX_FILES,
        'excludedDirectories': DEFAULT_EXCLUDED_DIRS.copy()
    }

    settings_file = Path(cwd) / '.claude' / 'local-memory.local.md'

    if not settings_file.exists():
        return settings

    try:
        with open(settings_file, 'r', encoding='utf-8') as f:
            content = f.read()

        # Extract YAML frontmatter between --- markers
        match = re.search(r'^---\s*\n(.*?)\n---', content, re.DOTALL | re.MULTILINE)
        if not match:
            return settings

        frontmatter = match.group(1)

        # Extract autoGenerate
        auto_gen_match = re.search(r'autoGenerate:\s*(true|false)', frontmatter, re.IGNORECASE)
        if auto_gen_match:
            settings['autoGenerate'] = auto_gen_match.group(1).lower() == 'true'

        # Extract threshold
        threshold_match = re.search(r'threshold:\s*(\d+)', frontmatter)
        if threshold_match:
            settings['threshold'] = int(threshold_match.group(1))

        # Extract maxFilesAnalyzed
        max_files_match = re.search(r'maxFilesAnalyzed:\s*(\d+)', frontmatter)
        if max_files_match:
            settings['maxFilesAnalyzed'] = int(max_files_match.group(1))

        # Extract excludedDirectories
        excluded_match = re.search(r'excludedDirectories:\s*\n((?:\s+-\s+.+\n?)+)', frontmatter)
        if excluded_match:
            excluded_list = excluded_match.group(1)
            excluded_dirs = re.findall(r'^\s+-\s+(.+)$', excluded_list, re.MULTILINE)
            if excluded_dirs:
                # Add to existing defaults instead of replacing
                settings['excludedDirectories'].extend(excluded_dirs)

    except Exception:
        # On error, return defaults
        pass

    return settings
def extract_file_paths_from_transcript(transcript_path: str, cwd: str) -> list:
    """Extract file paths from Edit/Write/NotebookEdit tool invocations."""
    file_paths = []
    
    try:
        with open(transcript_path, 'r', encoding='utf-8') as f:
            for line in f:
                if '<parameter name="file_path">' in line:
                    # Extract with proper closing tag
                    pattern = r'<parameter name="file_path">(.*?)<.antml:parameter>'
                    match = re.search(pattern, line)
                    if match:
                        file_path = match.group(1)
                        
                        # Convert to relative path from CWD if needed
                        if file_path.startswith(cwd):
                            file_path = file_path[len(cwd):].lstrip(r'\/')
                        
                        file_paths.append(file_path)
    
    except Exception:
        pass
    
    return file_paths


def group_files_by_directory(file_paths: list, cwd: str, excluded_dirs: list) -> dict:
    """Group files by directory and count them. Exclude specified directories."""
    dir_counts = defaultdict(int)
    
    for file_path in file_paths:
        # Get parent directory
        dir_path = str(Path(file_path).parent)
        
        # Skip if directory contains any excluded pattern
        skip = False
        for excluded in excluded_dirs:
            if excluded in dir_path:
                skip = True
                break
        
        if not skip:
            dir_counts[dir_path] += 1
    
    return dict(dir_counts)


def main():
    """Main entry point for the stop hook."""
    try:
        # Read hook input from stdin
        input_data = json.load(sys.stdin)

        # Check if we're already in a stop hook loop to prevent infinite recursion
        if input_data.get('stop_hook_active'):
            sys.exit(0)

        # Get CWD and transcript path
        cwd = input_data.get('cwd', '.')
        transcript_path = input_data.get('transcript_path', '')
        
        if not transcript_path:
            # No transcript, allow stop
            sys.exit(0)
        
        # Load settings
        settings = load_settings(cwd)
        
        # If autoGenerate is false, exit without blocking
        if not settings['autoGenerate']:
            sys.exit(0)
        
        # Extract file paths from transcript
        file_paths = extract_file_paths_from_transcript(transcript_path, cwd)
        
        if not file_paths:
            # No files modified, allow stop
            sys.exit(0)
        
        # Group files by directory
        dir_counts = group_files_by_directory(
            file_paths, 
            cwd, 
            settings['excludedDirectories']
        )
        
        # Find directories that meet threshold
        candidate_dirs = [
            (dir_path, count) 
            for dir_path, count in dir_counts.items() 
            if count >= settings['threshold']
        ]
        
        if not candidate_dirs:
            # No directories meet threshold, allow stop
            sys.exit(0)
        
        # Build directories list for MCP tool invocation
        dirs_list = [dir_path for dir_path, _ in candidate_dirs]
        
        # Build human-readable summary
        summary_parts = [f"{dir_path} ({count} files)" for dir_path, count in candidate_dirs]
        summary = ", ".join(summary_parts)
        
        # Build reason message with MCP tool suggestions
        reason = f"""Detected file changes in {summary}.

Use local-memory MCP tools to build context:
1. For each directory in {json.dumps(dirs_list)}:
   - Call: use_mcp_tool("mcp__plugin_local-memory_local-memory__analyze_directory", {{"directory": "<dir>", "project_root": "{cwd}"}})
   - Call: use_mcp_tool("mcp__plugin_local-memory_local-memory__generate_context", {{"directory": "<dir>", "project_root": "{cwd}"}})
   - Call: use_mcp_tool("mcp__plugin_local-memory_local-memory__write_context", {{"directory": "<dir>", "content": "<generated_content>"}})

This will create CLAUDE.md files documenting the modules you worked on."""
        
        # Return decision to block stop
        result = {
            'decision': 'block',
            'reason': reason
        }
        print(json.dumps(result))
        sys.exit(0)
    
    except Exception:
        # On any error, allow stop (don't block user)
        sys.exit(0)


if __name__ == '__main__':
    main()
