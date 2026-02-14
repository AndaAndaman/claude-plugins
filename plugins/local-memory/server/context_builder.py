#!/usr/bin/env python3
"""
MCP Server for local-memory plugin
Provides tools for directory analysis and CLAUDE.md generation
"""

import os
import sys
import json
import glob
import re
import hashlib
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional

# Add shared module to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'shared'))
from settings import DEFAULT_EXCLUDED_DIRS, load_settings as shared_load_settings, is_excluded_path, file_lock

# MCP SDK imports
try:
    from mcp.server.models import InitializationOptions
    from mcp.server import NotificationOptions, Server
    from mcp.server.stdio import stdio_server
    from mcp.types import Tool, TextContent, ImageContent, EmbeddedResource
except ImportError:
    print("Error: MCP SDK not installed. Run: pip install mcp", file=sys.stderr)
    sys.exit(1)


# Initialize MCP server
server = Server("local-memory")

# DEFAULT_EXCLUDED_DIRS imported from shared.settings

# ============================================================
# Pre-compiled regex patterns (module-level for performance)
# ============================================================

# Python patterns
_CLASS_PY = re.compile(r'^class\s+(\w+)', re.MULTILINE)
_DEF_PY = re.compile(r'^def\s+(\w+)', re.MULTILINE)
_DOCSTRING_PY = re.compile(r'^(?:\s*#[^\n]*\n)*\s*(?:\'\'\'|""")(.*?)(?:\'\'\'|""")', re.DOTALL)
_COMMENT_PY = re.compile(r'^\s*#(?!!)(.*)$', re.MULTILINE)
_CONSTANTS_PY = re.compile(r'^([A-Z][A-Z_0-9]{2,})\s*=', re.MULTILINE)

# TypeScript/JavaScript patterns
_CLASS_TS = re.compile(r'(?:export\s+)?class\s+(\w+)')
_FUNC_TS = re.compile(r'(?:export\s+)?(?:async\s+)?function\s+(\w+)')
_ARROW_TS = re.compile(r'export\s+(?:const|let)\s+(\w+)\s*=')
_JSDOC_TS = re.compile(r'/\*\*?\s*(.*?)(?:\*/)', re.DOTALL)
_EXPORTED_TYPES_TS = re.compile(r'export\s+(?:type|interface)\s+(\w+)')
_DECORATORS_TS = re.compile(r'@(\w+)\s*\(')
_CONSTANTS_TS = re.compile(r'(?:export\s+)?const\s+([A-Z][A-Z_0-9]{2,})\s*=')

# C#/Java/Go patterns
_CLASS_CS = re.compile(r'(?:public|internal|static)\s+(?:partial\s+)?class\s+(\w+)')
_FUNC_CS = re.compile(r'(?:public|private|protected|internal|static)\s+\w+\s+(\w+)\s*\(')
_DECORATORS_CS = re.compile(r'\[(\w+)(?:\(|\])')
_CLASS_JAVA = re.compile(r'(?:public|private|protected)\s+(?:abstract\s+)?class\s+(\w+)')
_FUNC_JAVA = re.compile(r'(?:public|private|protected)\s+\w+\s+(\w+)\s*\(')
_FUNC_GO = re.compile(r'^func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)', re.MULTILINE)

# Block comment pattern (C-style languages)
_BLOCK_COMMENT = re.compile(r'/\*\*?\s*(.*?)(?:\*/)', re.DOTALL)

# File-type specific patterns
_YAML_KEYS = re.compile(r'^(\w[\w-]*):', re.MULTILINE)
_MD_HEADINGS = re.compile(r'^#{1,3}\s+(.+)', re.MULTILINE)
_BARREL_EXPORTS = re.compile(r"export\s+(?:\*|\{[^}]+\})\s+from\s+['\"]([^'\"]+)['\"]")
_DESCRIBE_BLOCKS = re.compile(r"describe\s*\(\s*['\"]([^'\"]+)['\"]")
_TEST_CLASSES_PY = re.compile(r'^class\s+(Test\w+)', re.MULTILINE)
_CSS_SELECTORS = re.compile(r'\.[\w-]+')
_OVERVIEW_ARTIFACTS = re.compile(r'(?:Defines?|defining)\s+(\w+)')

# Import patterns
_IMPORT_TS = re.compile(r'import\s+.*\s+from\s+[\'"]([^\'"]+)[\'"]')
_IMPORT_PY = re.compile(r'(?:from\s+(\S+)\s+import|import\s+(\S+))')

# Smart merge patterns
_OPEN_MARKER_RE = re.compile(r'<!-- AUTO-GENERATED\b[^>]*-->')
_CLOSE_MARKER_RE = re.compile(r'<!-- END AUTO-GENERATED CONTENT -->')
_UPDATES_RE = re.compile(r'<!-- Updates: ([^>]+) -->')


def read_settings(project_root: str) -> Dict:
    """Read settings from shared module (single source of truth)."""
    return shared_load_settings(project_root)


def is_excluded(path: str, exclusions: List[str]) -> bool:
    """Check if path contains any excluded directory."""
    return is_excluded_path(path, exclusions)


def detect_language(files: List[str]) -> str:
    """Detect primary programming language from file extensions"""
    ext_counts = {}
    for f in files:
        ext = Path(f).suffix.lower()
        if ext:
            ext_counts[ext] = ext_counts.get(ext, 0) + 1

    if not ext_counts:
        return "unknown"

    # Map extensions to languages
    ext_map = {
        '.ts': 'typescript', '.tsx': 'typescript',
        '.js': 'javascript', '.jsx': 'javascript',
        '.py': 'python',
        '.go': 'go',
        '.cs': 'csharp',
        '.java': 'java',
        '.rb': 'ruby',
        '.php': 'php'
    }

    most_common_ext = max(ext_counts, key=ext_counts.get)
    return ext_map.get(most_common_ext, most_common_ext[1:])


def _summarize_by_filetype(file_path: str, content: str, lines: List[str]) -> Optional[str]:
    """Handle non-code files that generic class/function extraction misses.

    Returns a summary string if the file type is recognized, None otherwise.
    """
    file_name = os.path.basename(file_path)
    stem = Path(file_path).stem
    ext = Path(file_path).suffix.lower()

    # JSON/YAML config: extract top-level keys
    if ext in ('.json', '.yaml', '.yml'):
        if ext == '.json':
            try:
                data = json.loads(content)
                if isinstance(data, dict):
                    keys = list(data.keys())[:8]
                    return f"JSON config with keys: {', '.join(keys)}."
            except (json.JSONDecodeError, ValueError):
                pass
        else:
            # YAML: extract top-level keys via regex
            yaml_keys = _YAML_KEYS.findall(content)
            if yaml_keys:
                keys = yaml_keys[:8]
                return f"YAML config with keys: {', '.join(keys)}."

    # Markdown: extract title + first headings
    if ext in ('.md', '.mdx'):
        headings = _MD_HEADINGS.findall(content)
        if headings:
            title = headings[0]
            sub = headings[1:4]
            if sub:
                return f"{title}. Sections: {', '.join(sub)}."
            return f"{title}."
        return f"Markdown document."

    # Barrel/index files: list re-exports
    if stem == 'index' and ext in ('.ts', '.js', '.tsx', '.jsx'):
        exports = _BARREL_EXPORTS.findall(content)
        if exports:
            return f"Barrel file re-exporting from {', '.join(exports[:6])}."

    # Test files: extract describe/test suite names
    if '.test.' in file_name or '.spec.' in file_name or file_name.startswith('test_'):
        describes = _DESCRIBE_BLOCKS.findall(content)
        if describes:
            return f"Tests for {', '.join(describes[:4])}."
        # Python test classes
        test_classes = _TEST_CLASSES_PY.findall(content)
        if test_classes:
            return f"Tests: {', '.join(test_classes[:4])}."
        return f"Test file for {stem.replace('.test', '').replace('.spec', '').replace('test_', '')}."

    # CSS/SCSS: count class selectors
    if ext in ('.css', '.scss', '.less'):
        selectors = _CSS_SELECTORS.findall(content)
        unique = list(dict.fromkeys(selectors))[:6]
        if unique:
            return f"Stylesheet with {len(set(selectors))} class selectors including {', '.join(unique)}."
        return f"Stylesheet."

    return None


def _decorator_to_role(decorators: List[str]) -> str:
    """Map decorator names to human-readable role prefixes."""
    role_map = {
        'Component': 'Angular component',
        'Injectable': 'Angular service',
        'Directive': 'Angular directive',
        'Pipe': 'Angular pipe',
        'NgModule': 'Angular module',
        'Controller': 'NestJS controller',
        'Module': 'NestJS module',
        'Entity': 'TypeORM entity',
        'Table': 'Sequelize model',
        'ApiTags': 'API endpoint',
    }
    for dec in decorators:
        if dec in role_map:
            return role_map[dec]
    return ""


def summarize_file(file_path: str, language: str) -> str:
    """Read first ~80 lines of a file and generate a 1-2 sentence summary.

    Extracts docstrings/module comments, class/function names, and infers purpose.
    """
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            lines = []
            for i, line in enumerate(f):
                if i >= 80:
                    break
                lines.append(line)
    except Exception:
        return ""

    if not lines:
        return ""

    content = ''.join(lines)
    file_name = os.path.basename(file_path)
    stem = Path(file_path).stem

    # --- Extract docstring / leading comment ---
    docstring = ""

    if language == 'python':
        # Python: triple-quote docstring at top of file
        m = _DOCSTRING_PY.search(content)
        if m:
            docstring = m.group(1).strip().split('\n')[0]  # first line only
        else:
            # Fall back to first comment block
            comment_lines = []
            for line in lines:
                stripped = line.strip()
                if stripped.startswith('#') and not stripped.startswith('#!'):
                    comment_lines.append(stripped.lstrip('# ').strip())
                elif stripped and not stripped.startswith('#'):
                    break
            if comment_lines:
                docstring = comment_lines[0]

    elif language in ['typescript', 'javascript']:
        # JSDoc or block comment at top
        m = _JSDOC_TS.search(content)
        if m:
            raw = m.group(1)
            # Clean JSDoc: remove leading * and @tags
            cleaned = []
            for cline in raw.split('\n'):
                cline = cline.strip().lstrip('* ').strip()
                if cline.startswith('@'):
                    break
                if cline:
                    cleaned.append(cline)
            if cleaned:
                docstring = cleaned[0]
        else:
            # Single-line comments at top
            comment_lines = []
            for line in lines:
                stripped = line.strip()
                if stripped.startswith('//'):
                    comment_lines.append(stripped.lstrip('/ ').strip())
                elif stripped and not stripped.startswith('//'):
                    break
            if comment_lines:
                docstring = comment_lines[0]

    elif language in ['csharp', 'java', 'go']:
        # Block or line comments
        m = _BLOCK_COMMENT.search(content)
        if m:
            raw = m.group(1)
            cleaned = []
            for cline in raw.split('\n'):
                cline = cline.strip().lstrip('* ').strip()
                if cline.startswith('@') or cline.startswith('<'):
                    break
                if cline:
                    cleaned.append(cline)
            if cleaned:
                docstring = cleaned[0]

    # --- Check filetype-specific handler first ---
    filetype_summary = _summarize_by_filetype(file_path, content, lines)
    if filetype_summary:
        return filetype_summary[:200]

    # --- Extract class and function names ---
    classes = []
    functions = []

    if language == 'python':
        classes = _CLASS_PY.findall(content)
        functions = _DEF_PY.findall(content)
        # Filter out dunder/private
        functions = [f for f in functions if not f.startswith('_')]

    elif language in ['typescript', 'javascript']:
        classes = _CLASS_TS.findall(content)
        # Named exports, arrow functions, regular functions
        functions = _FUNC_TS.findall(content)
        arrow_fns = _ARROW_TS.findall(content)
        functions.extend(arrow_fns)

    elif language == 'csharp':
        classes = _CLASS_CS.findall(content)
        functions = _FUNC_CS.findall(content)

    elif language == 'go':
        functions = _FUNC_GO.findall(content)

    elif language == 'java':
        classes = _CLASS_JAVA.findall(content)
        functions = _FUNC_JAVA.findall(content)

    # --- Extract additional symbols (TS/JS specific) ---
    exported_types = []
    decorators = []
    constants = []

    if language in ['typescript', 'javascript']:
        exported_types = _EXPORTED_TYPES_TS.findall(content)
        decorators = _DECORATORS_TS.findall(content)
        constants = _CONSTANTS_TS.findall(content)
    elif language == 'python':
        constants = _CONSTANTS_PY.findall(content)
    elif language == 'csharp':
        decorators = _DECORATORS_CS.findall(content)

    # --- Build summary ---
    # 1. Use docstring if found
    if docstring:
        return docstring[:200]

    # 2. Build from extracted symbols
    parts = []

    # Decorator-based role prefix
    role = _decorator_to_role(decorators) if decorators else ""

    if classes:
        cls_str = ', '.join(classes[:3])
        if len(classes) > 3:
            cls_str += f" (+{len(classes) - 3} more)"
        if role:
            parts.append(f"{role} defining {cls_str}")
        else:
            parts.append(f"Defines {cls_str}")

    if functions:
        top_fns = ', '.join(f"{fn}()" for fn in functions[:4])
        if len(functions) > 4:
            top_fns += f" (+{len(functions) - 4} more)"
        if classes:
            parts.append(f"with {top_fns}")
        else:
            if role:
                parts.append(f"{role} with {top_fns}")
            else:
                parts.append(f"Defines {top_fns}")

    if exported_types:
        type_str = ', '.join(exported_types[:4])
        parts.append(f"Exports types {type_str}")

    if constants and not classes:
        const_str = ', '.join(constants[:4])
        parts.append(f"Constants: {const_str}")

    if parts:
        summary = '. '.join(parts) + '.'
        return summary[:200]

    # 3. Last resort: language + source file (no "Handles X logic")
    lang_label = language.capitalize() if language != 'unknown' else ''
    if lang_label:
        return f"{lang_label} source file."
    return "Source file."


def analyze_imports(file_path: str, language: str) -> Dict:
    """Analyze imports/exports in a file"""
    imports = {"internal": [], "external": []}

    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()

        if language in ['typescript', 'javascript']:
            for match in _IMPORT_TS.finditer(content):
                module = match.group(1)
                if module.startswith('.'):
                    imports["internal"].append(module)
                else:
                    imports["external"].append(module)

        elif language == 'python':
            for match in _IMPORT_PY.finditer(content):
                module = match.group(1) or match.group(2)
                if module.startswith('.'):
                    imports["internal"].append(module)
                else:
                    imports["external"].append(module)

    except Exception as e:
        print(f"Warning: Error analyzing {file_path}: {e}", file=sys.stderr)

    return imports


def _detect_patterns(files: List[str]) -> List[str]:
    """Detect architectural patterns from filenames. Expands on basic pattern detection."""
    patterns = []
    lower_files = [f.lower() for f in files]
    basenames = [os.path.basename(f) for f in lower_files]

    checks = [
        (lambda: any(f.endswith(('.test.ts', '.spec.ts', '.test.js', '.spec.js', '.test.py')) or f.startswith('test_') for f in lower_files),
         "Contains test files"),
        (lambda: any(f.startswith('index.') for f in basenames),
         "Has barrel/index file (module entry point)"),
        (lambda: any('controller' in f for f in lower_files),
         "Contains controller classes"),
        (lambda: any('service' in f and 'service-worker' not in f for f in lower_files),
         "Contains service classes"),
        (lambda: any(x in f for f in lower_files for x in ('repository', 'repo.', 'dao.')),
         "Contains repository/DAO layer"),
        (lambda: any('factory' in f for f in lower_files),
         "Uses factory pattern"),
        (lambda: any('middleware' in f for f in lower_files),
         "Contains middleware"),
        (lambda: any(x in f for f in lower_files for x in ('model.', 'entity.', '.entity.', '.model.')),
         "Contains model/entity definitions"),
        (lambda: any('.component.' in f for f in lower_files),
         "Contains UI components"),
        (lambda: any(re.match(r'use[A-Z]', os.path.basename(f)) for f in files if f.lower().endswith(('.ts', '.js', '.tsx'))),
         "Contains React hooks"),
        (lambda: any('.guard.' in f for f in lower_files),
         "Contains guard classes"),
        (lambda: any('.pipe.' in f for f in lower_files),
         "Contains pipe transforms"),
        (lambda: any('.directive.' in f for f in lower_files),
         "Contains directives"),
        (lambda: any('enum' in f for f in lower_files),
         "Contains enum definitions"),
        (lambda: any(x in f for f in lower_files for x in ('constants', 'config.')),
         "Contains constants/configuration"),
        (lambda: any(x in f for f in lower_files for x in ('types.', 'interfaces.', '.d.ts')),
         "Contains type/interface definitions"),
        (lambda: any('migration' in f for f in lower_files),
         "Contains database migrations"),
        (lambda: any(x in f for f in lower_files for x in ('util', 'helper', 'helpers')),
         "Contains utility/helper functions"),
    ]

    for check_fn, label in checks:
        if check_fn():
            patterns.append(label)

    return patterns


def _detect_directory_role(file_summaries: Dict[str, str], files: List[str], dir_name: str) -> str:
    """Infer directory role from aggregated file summaries and filenames."""
    all_summaries = ' '.join(file_summaries.values()).lower()
    all_files = ' '.join(f.lower() for f in files)

    role_signals = [
        ('controller', 'API controller layer'),
        ('service', 'Service layer'),
        ('component', 'UI component module'),
        ('repository', 'Data access layer'),
        ('middleware', 'Middleware layer'),
        ('guard', 'Guard/authorization layer'),
        ('pipe', 'Transform/pipe module'),
        ('directive', 'Directive module'),
        ('entity', 'Entity/model definitions'),
        ('migration', 'Database migration module'),
        ('util', 'Utility module'),
    ]

    for signal, role in role_signals:
        if signal in all_files or signal in all_summaries:
            return role

    return ""


def _compose_overview(dir_name: str, file_summaries: Dict[str, str], files: List[str],
                      patterns: List[str], language: str, total_files: int) -> str:
    """Generate content-aware overview from file summaries and patterns."""
    role = _detect_directory_role(file_summaries, files, dir_name)

    # Extract key artifact names from summaries
    artifacts = []
    for summary in file_summaries.values():
        # Pull class/component names from "Defines X" or "Angular component defining X"
        m = _OVERVIEW_ARTIFACTS.findall(summary)
        artifacts.extend(m)
    # Deduplicate preserving order
    seen = set()
    unique_artifacts = []
    for a in artifacts:
        if a not in seen and a not in ('type', 'interface', 'const'):
            seen.add(a)
            unique_artifacts.append(a)

    parts = []
    if role:
        purpose = dir_name.replace('-', ' ').replace('_', ' ')
        parts.append(f"{role} for {purpose}")
    elif unique_artifacts:
        parts.append(f"Contains {', '.join(unique_artifacts[:4])}")
        if len(unique_artifacts) > 4:
            parts[-1] += f" and {len(unique_artifacts) - 4} more"
    else:
        purpose = dir_name.replace('-', ' ').replace('_', ' ')
        parts.append(f"Module for {purpose}")

    parts.append(f"{total_files} files ({language})")

    return '. '.join(parts) + '.'


def _score_quality(file_summaries: Dict[str, str], overview: str,
                   patterns: List[str], total_files: int) -> Dict:
    """Score generated content quality (0-100).

    Returns dict with score, grade, and issues list.
    """
    issues = []

    # File summary specificity: 0-40 pts
    generic_phrases = ['source file.', 'stylesheet.', 'markdown document.']
    non_empty = [s for s in file_summaries.values() if s]
    if non_empty:
        generic_count = sum(1 for s in non_empty if any(g in s.lower() for g in generic_phrases))
        specific_ratio = 1 - (generic_count / len(non_empty))
        summary_score = int(specific_ratio * 40)
        if specific_ratio < 0.5:
            issues.append(f"{generic_count}/{len(non_empty)} summaries are generic")
    else:
        summary_score = 0
        issues.append("No file summaries generated")

    # Overview specificity: 0-30 pts
    overview_lower = overview.lower()
    overview_score = 30
    if 'module for' in overview_lower and not any(x in overview_lower for x in ['contains', 'layer', 'definitions']):
        overview_score = 10
        issues.append("Overview lacks specific artifacts")
    elif any(x in overview_lower for x in ['layer', 'definitions', 'contains']):
        overview_score = 25

    # Pattern coverage: 0-15 pts
    pattern_score = min(len(patterns) * 3, 15)
    if not patterns:
        issues.append("No patterns detected")

    # Completeness: 0-15 pts
    analyzed = len(file_summaries)
    if total_files > 0:
        coverage = analyzed / total_files
        completeness_score = int(coverage * 15)
        if coverage < 0.5:
            issues.append(f"Only {analyzed}/{total_files} files analyzed")
    else:
        completeness_score = 15

    total = summary_score + overview_score + pattern_score + completeness_score

    if total >= 90:
        grade = 'A'
    elif total >= 75:
        grade = 'B'
    elif total >= 60:
        grade = 'C'
    elif total >= 40:
        grade = 'D'
    else:
        grade = 'F'

    return {"score": total, "grade": grade, "issues": issues}


# ============================================================
# Summary caching for incremental generation
# ============================================================

def _get_cache_path(directory: str, project_root: str) -> str:
    """Get the cache file path for a directory."""
    cache_hash = hashlib.md5(directory.encode()).hexdigest()[:12]
    cache_dir = os.path.join(project_root, '.claude', 'local-memory-cache')
    new_path = os.path.join(cache_dir, f'{cache_hash}.json')

    # Migrate from old flat layout if needed
    old_path = os.path.join(project_root, '.claude', f'local-memory-cache-{cache_hash}.json')
    if os.path.exists(old_path) and not os.path.exists(new_path):
        os.makedirs(cache_dir, exist_ok=True)
        try:
            os.rename(old_path, new_path)
        except OSError:
            pass  # Fall through — load will handle either location

    return new_path


def _load_summary_cache(directory: str, project_root: str) -> dict:
    """Load summary cache for a directory."""
    cache_path = _get_cache_path(directory, project_root)
    if not os.path.exists(cache_path):
        return {"directory": directory, "summaries": {}}

    try:
        with open(cache_path, 'r', encoding='utf-8') as f:
            cache = json.load(f)
            if cache.get("directory") != directory:
                return {"directory": directory, "summaries": {}}
            return cache
    except Exception:
        return {"directory": directory, "summaries": {}}


def _save_summary_cache(directory: str, project_root: str, cache: dict):
    """Save summary cache for a directory with file locking."""
    cache_path = _get_cache_path(directory, project_root)
    try:
        os.makedirs(os.path.dirname(cache_path), exist_ok=True)
        with file_lock(cache_path):
            with open(cache_path, 'w', encoding='utf-8') as f:
                json.dump(cache, f, indent=2)
    except Exception:
        pass


@server.list_tools()
async def handle_list_tools() -> List[Tool]:
    """List available MCP tools"""
    return [
        Tool(
            name="analyze_directory",
            description="Analyze directory structure, detect files, patterns, and dependencies. Returns JSON with file list, language, patterns, and import analysis.",
            inputSchema={
                "type": "object",
                "properties": {
                    "directory": {
                        "type": "string",
                        "description": "Directory path to analyze (relative or absolute)"
                    },
                    "project_root": {
                        "type": "string",
                        "description": "Project root directory (default: current directory)"
                    },
                    "depth": {
                        "type": "integer",
                        "description": "Directory scan depth (default: 1, immediate children only). Set >1 to include subdirectory files."
                    }
                },
                "required": ["directory"]
            }
        ),
        Tool(
            name="generate_context",
            description="Generate CLAUDE.md content for a directory based on analysis. Returns markdown content (does not write file).",
            inputSchema={
                "type": "object",
                "properties": {
                    "directory": {
                        "type": "string",
                        "description": "Directory path to generate context for"
                    },
                    "project_root": {
                        "type": "string",
                        "description": "Project root directory"
                    },
                    "max_files": {
                        "type": "integer",
                        "description": "Maximum files to analyze (default: 50)"
                    },
                    "analysis": {
                        "type": "object",
                        "description": "Pre-computed analysis JSON from a previous analyze_directory call. If provided, skips internal re-analysis."
                    }
                },
                "required": ["directory"]
            }
        ),
        Tool(
            name="write_context",
            description="Write or update CLAUDE.md file with smart merge. Preserves user content outside auto-generated blocks.",
            inputSchema={
                "type": "object",
                "properties": {
                    "directory": {
                        "type": "string",
                        "description": "Directory to write CLAUDE.md in"
                    },
                    "content": {
                        "type": "string",
                        "description": "Markdown content to write"
                    },
                    "project_root": {
                        "type": "string",
                        "description": "Project root directory (for resolving relative paths)"
                    },
                    "smart_merge": {
                        "type": "boolean",
                        "description": "Enable smart merge (default: true)"
                    }
                },
                "required": ["directory", "content"]
            }
        ),
        Tool(
            name="list_context_files",
            description="List all existing CLAUDE.md files in project. Returns list of paths.",
            inputSchema={
                "type": "object",
                "properties": {
                    "project_root": {
                        "type": "string",
                        "description": "Project root directory (default: current directory)"
                    }
                },
                "required": []
            }
        )
    ]


@server.call_tool()
async def handle_call_tool(name: str, arguments: Dict) -> List[TextContent]:
    """Handle tool execution"""

    if name == "analyze_directory":
        directory = arguments.get("directory", ".")
        project_root = arguments.get("project_root", os.getcwd())
        depth = arguments.get("depth", 1)

        # Resolve path
        if not os.path.isabs(directory):
            directory = os.path.join(project_root, directory)

        if not os.path.exists(directory):
            return [TextContent(
                type="text",
                text=json.dumps({"error": f"Directory not found: {directory}"})
            )]

        # Read settings
        settings = read_settings(project_root)

        # Check if excluded
        if is_excluded(directory, settings["excludedDirectories"]):
            return [TextContent(
                type="text",
                text=json.dumps({"error": f"Directory is excluded: {directory}"})
            )]

        # Find files (with optional depth scanning)
        files = []
        try:
            if depth <= 1:
                # Original behavior: immediate children only
                for entry in os.scandir(directory):
                    if entry.is_file() and not entry.name.startswith('.'):
                        files.append(entry.name)
            else:
                # Recursive scan up to specified depth
                def _scan_recursive(dir_path: str, current_depth: int, max_depth: int, base_dir: str):
                    """Recursively scan directories up to max_depth."""
                    found = []
                    try:
                        for entry in os.scandir(dir_path):
                            if entry.name.startswith('.'):
                                continue
                            if entry.is_file():
                                # Use relative path from the base directory
                                rel_path = os.path.relpath(entry.path, base_dir)
                                found.append(rel_path)
                            elif entry.is_dir() and current_depth < max_depth:
                                if not is_excluded(entry.path, settings["excludedDirectories"]):
                                    found.extend(_scan_recursive(entry.path, current_depth + 1, max_depth, base_dir))
                    except PermissionError:
                        pass
                    return found

                files = _scan_recursive(directory, 1, depth, directory)
        except Exception as e:
            return [TextContent(
                type="text",
                text=json.dumps({"error": f"Error scanning directory: {e}"})
            )]

        # Detect language
        language = detect_language(files)

        # Analyze imports for first N files
        max_analyze = min(len(files), settings["maxFilesAnalyzed"])
        import_analysis = {}
        for file_name in files[:max_analyze]:
            file_path = os.path.join(directory, file_name)
            imports = analyze_imports(file_path, language)
            if imports["internal"] or imports["external"]:
                import_analysis[file_name] = imports

        # Detect patterns
        patterns = _detect_patterns(files)

        result = {
            "directory": os.path.relpath(directory, project_root),
            "totalFiles": len(files),
            "files": files[:max_analyze],
            "language": language,
            "patterns": patterns,
            "imports": import_analysis
        }

        return [TextContent(
            type="text",
            text=json.dumps(result, indent=2)
        )]

    elif name == "generate_context":
        directory = arguments.get("directory", ".")
        project_root = arguments.get("project_root", os.getcwd())
        max_files = arguments.get("max_files", 50)
        pre_analysis = arguments.get("analysis", None)

        # Use pre-computed analysis if provided, otherwise analyze
        if pre_analysis and isinstance(pre_analysis, dict) and "error" not in pre_analysis:
            analysis = pre_analysis
        else:
            analysis_result = await handle_call_tool("analyze_directory", {
                "directory": directory,
                "project_root": project_root
            })

            analysis = json.loads(analysis_result[0].text)
            if "error" in analysis:
                return analysis_result

        # Resolve directory path for file reading
        abs_directory = directory
        if not os.path.isabs(abs_directory):
            abs_directory = os.path.join(project_root, abs_directory)

        language = analysis.get("language", "unknown")

        # Load summary cache for incremental processing
        cache = _load_summary_cache(directory, project_root)
        cached_summaries = cache.get("summaries", {})
        cache_hits = 0
        cache_misses = 0

        # Generate file summaries (with caching)
        file_summaries = {}
        for file_name in analysis["files"]:
            file_path = os.path.join(abs_directory, file_name)

            # Check cache: compare mtime + size
            cached_entry = cached_summaries.get(file_name)
            if cached_entry:
                try:
                    stat = os.stat(file_path)
                    if (abs(stat.st_mtime - cached_entry.get("mtime", 0)) < 0.01 and
                            stat.st_size == cached_entry.get("size", -1)):
                        file_summaries[file_name] = cached_entry.get("summary", "")
                        cache_hits += 1
                        continue
                except OSError:
                    pass

            # Cache miss: generate summary
            summary = summarize_file(file_path, language)
            file_summaries[file_name] = summary
            cache_misses += 1

            # Update cache entry
            try:
                stat = os.stat(file_path)
                cached_summaries[file_name] = {
                    "mtime": stat.st_mtime,
                    "size": stat.st_size,
                    "summary": summary
                }
            except OSError:
                pass

        # Save updated cache
        cache["summaries"] = cached_summaries
        _save_summary_cache(directory, project_root, cache)

        # Generate content-aware overview
        dir_name = os.path.basename(directory.rstrip('/\\'))
        patterns = analysis.get("patterns", [])

        overview = _compose_overview(
            dir_name, file_summaries, analysis["files"],
            patterns, language, analysis["totalFiles"]
        )

        # Quality scoring
        quality = _score_quality(file_summaries, overview, patterns, analysis["totalFiles"])
        quality_comment = f"<!-- Quality: {quality['score']}/100 ({quality['grade']})"
        if quality["issues"]:
            quality_comment += f" | Issues: {'; '.join(quality['issues'])}"
        quality_comment += " -->"

        content = f"""<!-- AUTO-GENERATED by local-memory plugin on {datetime.now().strftime('%Y-%m-%d')} -->
<!-- To preserve custom content, add sections outside auto-gen blocks -->
{quality_comment}

# Module: {dir_name}

## Overview

{overview}

## Files

"""

        # Add file descriptions with real summaries
        for file_name in analysis["files"]:
            summary = file_summaries.get(file_name, "")
            content += f"### {file_name}\n"
            content += f"{summary}\n\n" if summary else f"{file_name}\n\n"

        if analysis["totalFiles"] > len(analysis["files"]):
            remaining = analysis["totalFiles"] - len(analysis["files"])
            content += f"*Analysis covers {len(analysis['files'])} primary files. Additional {remaining} files not detailed.*\n\n"

        # Add patterns section
        if analysis["patterns"]:
            content += "## Key Patterns & Conventions\n\n"
            for pattern in analysis["patterns"]:
                content += f"- {pattern}\n"
            content += "\n"

        # Add dependencies section
        if analysis["imports"]:
            content += "## Dependencies\n\n"

            # Collect all internal and external imports
            all_internal = set()
            all_external = set()
            for imports in analysis["imports"].values():
                all_internal.update(imports.get("internal", []))
                all_external.update(imports.get("external", []))

            if all_internal:
                content += "**Internal Dependencies:**\n"
                for imp in sorted(all_internal):
                    content += f"- `{imp}`\n"
                content += "\n"

            if all_external:
                content += "**External Dependencies:**\n"
                for imp in sorted(all_external)[:10]:  # Limit to 10
                    content += f"- `{imp}`\n"
                content += "\n"

        # Line count warning
        line_count = content.count('\n') + 1
        if line_count > 400:
            content += f"\n<!-- WARNING: {line_count} lines exceeds 400-line guideline. Consider splitting into sub-modules. -->\n"

        content += "<!-- END AUTO-GENERATED CONTENT -->\n"

        return [TextContent(type="text", text=content)]

    elif name == "write_context":
        directory = arguments.get("directory", ".")
        content = arguments.get("content", "")
        smart_merge = arguments.get("smart_merge", True)
        project_root = arguments.get("project_root", os.getcwd())

        # Resolve path consistently with other tools (use project_root, not cwd)
        if not os.path.isabs(directory):
            directory = os.path.join(project_root, directory)

        claude_md_path = os.path.join(directory, "CLAUDE.md")
        warnings = []

        # --- M11: Content validation before writing ---
        if not content or not content.strip():
            return [TextContent(
                type="text",
                text=json.dumps({"error": "Content is empty. Refusing to write empty CLAUDE.md."})
            )]

        content_len = len(content.strip())
        if content_len < 50:
            warnings.append(f"Content is suspiciously short ({content_len} chars). May be incomplete.")
        if content_len > 15000:
            warnings.append(f"Content is suspiciously long ({content_len} chars). Consider splitting into sub-modules.")

        # Ensure auto-generated markers are present (agent may strip them when rewriting)
        today_str = datetime.now().strftime('%Y-%m-%d')
        opening_marker = f"<!-- AUTO-GENERATED by local-memory plugin on {today_str} -->"
        closing_marker = "<!-- END AUTO-GENERATED CONTENT -->"

        if "<!-- AUTO-GENERATED" not in content:
            content = opening_marker + "\n" + "<!-- To preserve custom content, add sections outside auto-gen blocks -->\n\n" + content

        if closing_marker not in content:
            content = content.rstrip("\n") + "\n\n" + closing_marker + "\n"

        # Verify markers are present after enforcement
        if "<!-- AUTO-GENERATED" not in content or closing_marker not in content:
            warnings.append("Marker enforcement failed. Content may have unexpected structure.")

        # --- M10: Smart merge with regex-based marker finding ---
        if smart_merge and os.path.exists(claude_md_path):
            try:
                with open(claude_md_path, 'r', encoding='utf-8') as f:
                    existing = f.read()

                # Use pre-compiled regex to find all opening and closing markers
                open_markers = list(_OPEN_MARKER_RE.finditer(existing))
                close_markers = list(_CLOSE_MARKER_RE.finditer(existing))

                if len(open_markers) > 1 or len(close_markers) > 1:
                    print(f"Warning: Multiple auto-gen marker pairs found in {claude_md_path} "
                          f"({len(open_markers)} open, {len(close_markers)} close). "
                          f"Using outermost pair.", file=sys.stderr)
                    warnings.append(f"Multiple marker pairs detected ({len(open_markers)} open, "
                                    f"{len(close_markers)} close). Used outermost pair for merge.")

                # --- Extract update history from existing auto-gen block ---
                previous_dates = []
                if open_markers and close_markers:
                    auto_gen_block = existing[open_markers[0].start():close_markers[-1].end()]
                    updates_match = _UPDATES_RE.search(auto_gen_block)
                    if updates_match:
                        previous_dates = [d.strip() for d in updates_match.group(1).split(",") if d.strip()]
                    else:
                        # Extract date from the opening marker itself as first history entry
                        marker_date_match = re.search(r'on (\d{4}-\d{2}-\d{2})', open_markers[0].group())
                        if marker_date_match:
                            previous_dates = [marker_date_match.group(1)]

                before_content = ""
                after_content = ""

                if open_markers and close_markers:
                    # Use FIRST opening marker and LAST closing marker (outermost pair)
                    first_open = open_markers[0]
                    last_close = close_markers[-1]

                    # Content BEFORE the first opening marker
                    before_part = existing[:first_open.start()]
                    if before_part.strip():
                        before_content = before_part

                    # Content AFTER the last closing marker
                    after_part = existing[last_close.end():]
                    if after_part.strip():
                        after_content = after_part
                elif open_markers:
                    # Only opening marker(s), no closing - take content before first open
                    before_part = existing[:open_markers[0].start()]
                    if before_part.strip():
                        before_content = before_part
                    warnings.append("Existing file has opening marker but no closing marker.")
                elif close_markers:
                    # Only closing marker(s), no opening - take content after last close
                    after_part = existing[close_markers[-1].end():]
                    if after_part.strip():
                        after_content = after_part
                    warnings.append("Existing file has closing marker but no opening marker.")
                else:
                    # --- No markers at all: existing file is entirely user-written ---
                    # Preserve ALL existing content as before_content
                    if existing.strip():
                        before_content = existing
                        warnings.append("Existing CLAUDE.md had no auto-generated markers. "
                                        "Preserved all existing content above auto-generated block.")

                # Build update history (current date + previous, deduplicated, max 10)
                all_dates = [today_str]
                for d in previous_dates:
                    if d not in all_dates:
                        all_dates.append(d)
                all_dates = all_dates[:10]  # Keep last 10 updates
                updates_comment = f"<!-- Updates: {', '.join(all_dates)} -->"

                # Inject updates comment right after the opening marker in new content
                content = _OPEN_MARKER_RE.sub(
                    lambda m: m.group() + "\n" + updates_comment,
                    content,
                    count=1
                )

                # Combine: user-before + new auto-gen + user-after
                if before_content.strip():
                    content = before_content.rstrip("\n") + "\n\n" + content
                if after_content.strip():
                    content = content + "\n" + after_content

            except Exception as e:
                print(f"Warning: Smart merge failed: {e}", file=sys.stderr)
                warnings.append(f"Smart merge failed: {e}")
        else:
            # New file (no existing CLAUDE.md) - add initial update entry
            updates_comment = f"<!-- Updates: {today_str} -->"
            content = _OPEN_MARKER_RE.sub(
                lambda m: m.group() + "\n" + updates_comment,
                content,
                count=1
            )

        # Write file with file locking for concurrent safety
        existed = os.path.exists(claude_md_path)
        try:
            with file_lock(claude_md_path):
                with open(claude_md_path, 'w', encoding='utf-8') as f:
                    f.write(content)

            result = {
                "success": True,
                "path": claude_md_path,
                "action": "updated" if existed else "created"
            }
            if warnings:
                result["warnings"] = warnings
            return [TextContent(type="text", text=json.dumps(result, indent=2))]

        except Exception as e:
            return [TextContent(
                type="text",
                text=json.dumps({"error": f"Failed to write file: {e}"})
            )]

    elif name == "list_context_files":
        project_root = arguments.get("project_root", os.getcwd())

        # Load user exclusions from settings
        settings = read_settings(project_root)
        user_exclusions = settings.get("excludedDirectories", [])

        # Find all CLAUDE.md files
        context_files = []
        try:
            for root, dirs, files in os.walk(project_root):
                # Skip excluded directories (respects both defaults and user config)
                dirs[:] = [d for d in dirs if not is_excluded(os.path.join(root, d), user_exclusions)]

                if "CLAUDE.md" in files:
                    rel_path = os.path.relpath(os.path.join(root, "CLAUDE.md"), project_root)
                    context_files.append(rel_path)

        except Exception as e:
            return [TextContent(
                type="text",
                text=json.dumps({"error": f"Error scanning project: {e}"})
            )]

        result = {
            "project_root": project_root,
            "total": len(context_files),
            "files": sorted(context_files)
        }

        return [TextContent(type="text", text=json.dumps(result, indent=2))]

    else:
        return [TextContent(
            type="text",
            text=json.dumps({"error": f"Unknown tool: {name}"})
        )]


async def main():
    """Run MCP server"""
    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            InitializationOptions(
                server_name="local-memory",
                server_version="0.3.1",
                capabilities=server.get_capabilities(
                    notification_options=NotificationOptions(),
                    experimental_capabilities={}
                )
            )
        )


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
