#!/usr/bin/env python3
"""
md-to-skill PostToolUse Hook - Structural Code Pattern Capture

Extracts structural elements (imports, function signatures, class names,
decorators, exports) from Write/Edit/Bash tool_input content. Writes to
a separate .claude/md-to-skill-structural.jsonl file.

Privacy: captures only structural signatures and names, never function
bodies, variable values, or business logic. Bash commands are sanitized
to remove secrets.

Hooks on: Write|Edit|Bash
Never blocks execution.
"""

import json
import sys
import os
import re
from datetime import datetime

from hook_utils import (
    setup_plugin_path,
    load_hook_input,
    is_secret_file,
    get_structural_observations_path,
    get_session_cache_path,
)

# Setup plugin path for config imports
setup_plugin_path()

try:
    from config.config_loader import load_config, get_structural_config, get_privacy_config
    CONFIG_AVAILABLE = True
except ImportError:
    CONFIG_AVAILABLE = False

# --- Constants ---

MAX_CONTENT_BYTES = 51200  # 50KB fallback
MAX_COMMAND_LENGTH = 2000
FALLBACK_SECRET_PATTERNS = [
    r'--token=\S+', r'--password=\S+', r'API_KEY=\S+',
    r'Bearer\s+\S+', r'--secret=\S+',
]

# --- Language family detection ---

LANG_EXTENSIONS = {
    '.ts': 'ts', '.tsx': 'ts', '.js': 'ts', '.jsx': 'ts', '.mjs': 'ts',
    '.py': 'py',
    '.cs': 'cs',
}


def get_language_family(file_path: str, lang_config: dict = None) -> str | None:
    """Map file extension to language family. Returns None for non-code files."""
    if not file_path:
        return None
    ext = os.path.splitext(file_path)[1].lower()

    # Use config-driven mapping if available
    if lang_config:
        for family, extensions in lang_config.items():
            if ext in extensions:
                return family
        return None

    # Fallback to built-in mapping
    return LANG_EXTENSIONS.get(ext)


# --- Compiled regex patterns per language family ---

# TypeScript/JavaScript patterns
TS_IMPORT_RE = re.compile(
    r'^import\s+'
    r'(?:'
    r'(?:type\s+)?'
    r'(?:\{([^}]+)\}|(\w+))'
    r'(?:\s*,\s*(?:\{([^}]+)\}|(\w+)))?'
    r'\s+from\s+'
    r"['\"]([^'\"]+)['\"]"
    r'|'
    r"['\"]([^'\"]+)['\"]"  # side-effect import
    r')',
    re.MULTILINE
)
TS_FUNCTION_RE = re.compile(
    r'(?:export\s+)?(?:async\s+)?function\s+(\w+)'
    r'\s*(?:<[^>]+>)?\s*'
    r'\(([^)]*)\)'
    r'(?:\s*:\s*([^\s{]+))?',
    re.MULTILINE
)
TS_ARROW_RE = re.compile(
    r'(?:export\s+)?(?:const|let|var)\s+(\w+)'
    r'(?:\s*:\s*[^=]+?)?\s*=\s*'
    r'(?:async\s+)?'
    r'(?:\([^)]*\)|(\w+))\s*'
    r'(?::\s*([^\s=>{]+))?\s*=>',
    re.MULTILINE
)
TS_CLASS_RE = re.compile(
    r'(?:export\s+)?(?:abstract\s+)?class\s+(\w+)'
    r'(?:\s+extends\s+(\w+))?'
    r'(?:\s+implements\s+([\w,\s]+))?',
    re.MULTILINE
)
TS_INTERFACE_RE = re.compile(
    r'(?:export\s+)?interface\s+(\w+)'
    r'(?:\s+extends\s+([\w,\s]+))?',
    re.MULTILINE
)
TS_DECORATOR_RE = re.compile(
    r'@(\w+)\s*(?:\([^)]*\))?\s*\n\s*(?:export\s+)?(?:class|function)\s+(\w+)',
    re.MULTILINE
)
TS_EXPORT_RE = re.compile(
    r'^export\s+(?:default\s+)?(?:class|function|const|let|var|interface|type|enum|abstract)\s+(\w+)',
    re.MULTILINE
)

# Python patterns
PY_IMPORT_RE = re.compile(
    r'^(?:from\s+([\w.]+)\s+import\s+([^#\n]+)|import\s+([\w]+(?:\s*,\s*[\w]+)*))\s*$',
    re.MULTILINE
)
PY_FUNCTION_RE = re.compile(
    r'^(\s*)(?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)'
    r'(?:\s*->\s*([^\s:]+))?',
    re.MULTILINE
)
PY_CLASS_RE = re.compile(
    r'^class\s+(\w+)\s*(?:\(([^)]*)\))?',
    re.MULTILINE
)
PY_DECORATOR_RE = re.compile(
    r'@(\w[\w.]*)\s*(?:\([^)]*\))?\s*\n\s*(?:class|(?:async\s+)?def)\s+(\w+)',
    re.MULTILINE
)

# C# patterns
CS_USING_RE = re.compile(
    r'^using\s+([\w.]+)\s*;',
    re.MULTILINE
)
CS_NAMESPACE_RE = re.compile(
    r'namespace\s+([\w.]+)',
    re.MULTILINE
)
CS_CLASS_RE = re.compile(
    r'(?:public|private|internal|protected)?\s*(?:static\s+)?'
    r'(?:abstract\s+|sealed\s+)?class\s+(\w+)'
    r'(?:\s*<[^>]+>)?'
    r'(?:\s*:\s*([\w,\s.<>]+))?',
    re.MULTILINE
)
CS_METHOD_RE = re.compile(
    r'(?:public|private|internal|protected)\s+'
    r'(?:static\s+)?(?:async\s+)?(?:virtual\s+|override\s+|abstract\s+)?'
    r'([\w<>\[\]?]+)\s+(\w+)\s*'
    r'(?:<[^>]+>)?\s*\(([^)]*)\)',
    re.MULTILINE
)
CS_ATTRIBUTE_RE = re.compile(
    r'\[(\w+)(?:\([^)]*\))?\]\s*\n\s*'
    r'(?:public|private|internal|protected)',
    re.MULTILINE
)


# --- Structural extraction functions ---

def extract_structural_elements(content: str, lang: str, capture_cfg: dict = None) -> dict:
    """Extract structural elements from Write content. No implementation bodies."""
    if capture_cfg is None:
        capture_cfg = {}

    result = {
        'imports': [],
        'functions': [],
        'classes': [],
        'interfaces': [],
        'decorators': [],
        'exports': [],
        'metrics': {
            'lines': content.count('\n') + 1,
            'function_count': 0,
            'class_count': 0,
        }
    }

    if lang == 'ts':
        _extract_ts(content, result, capture_cfg)
    elif lang == 'py':
        _extract_py(content, result, capture_cfg)
    elif lang == 'cs':
        _extract_cs(content, result, capture_cfg)

    # Update metrics
    result['metrics']['function_count'] = len(result['functions'])
    result['metrics']['class_count'] = len(result['classes'])

    return result


def _extract_ts(content: str, result: dict, capture_cfg: dict):
    """Extract TypeScript/JavaScript structural elements."""
    if capture_cfg.get('imports', True):
        for m in TS_IMPORT_RE.finditer(content):
            names_parts = []
            for g in (m.group(1), m.group(2), m.group(3), m.group(4)):
                if g:
                    names_parts.extend(n.strip() for n in g.split(',') if n.strip())
            module = m.group(5) or m.group(6) or ''
            if module:
                result['imports'].append({
                    'module': module,
                    'names': names_parts if names_parts else [],
                })

    if capture_cfg.get('functionSignatures', True):
        for m in TS_FUNCTION_RE.finditer(content):
            is_async = 'async' in content[max(0, m.start()-10):m.start()+6]
            result['functions'].append({
                'name': m.group(1),
                'params': len([p for p in m.group(2).split(',') if p.strip()]) if m.group(2) else 0,
                'return_type': m.group(3) or None,
                'is_async': is_async,
            })
        for m in TS_ARROW_RE.finditer(content):
            is_async = 'async' in content[max(0, m.start()-10):m.start()+20]
            result['functions'].append({
                'name': m.group(1),
                'params': -1,  # arrow params harder to count reliably
                'return_type': m.group(3) or None,
                'is_async': is_async,
            })

    if capture_cfg.get('classNames', True):
        for m in TS_CLASS_RE.finditer(content):
            implements = []
            if m.group(3):
                implements = [i.strip() for i in m.group(3).split(',')]
            result['classes'].append({
                'name': m.group(1),
                'extends': m.group(2),
                'implements': implements,
            })
        for m in TS_INTERFACE_RE.finditer(content):
            extends = []
            if m.group(2):
                extends = [e.strip() for e in m.group(2).split(',')]
            result['interfaces'].append({
                'name': m.group(1),
                'extends': extends,
            })

    if capture_cfg.get('decorators', True):
        for m in TS_DECORATOR_RE.finditer(content):
            result['decorators'].append({
                'name': m.group(1),
                'target': m.group(2),
            })

    if capture_cfg.get('exports', True):
        for m in TS_EXPORT_RE.finditer(content):
            result['exports'].append(m.group(1))


def _extract_py(content: str, result: dict, capture_cfg: dict):
    """Extract Python structural elements."""
    if capture_cfg.get('imports', True):
        for m in PY_IMPORT_RE.finditer(content):
            if m.group(1):  # from X import Y
                names = [n.strip() for n in m.group(2).split(',') if n.strip()]
                result['imports'].append({
                    'module': m.group(1),
                    'names': names,
                })
            elif m.group(3):  # import X, Y
                modules = [n.strip() for n in m.group(3).split(',') if n.strip()]
                for mod in modules:
                    result['imports'].append({
                        'module': mod,
                        'names': [],
                    })

    if capture_cfg.get('functionSignatures', True):
        for m in PY_FUNCTION_RE.finditer(content):
            is_async = 'async' in content[max(0, m.start()-10):m.start()+6]
            params = len([p for p in m.group(3).split(',') if p.strip()]) if m.group(3) else 0
            result['functions'].append({
                'name': m.group(2),
                'params': params,
                'return_type': m.group(4) or None,
                'is_async': is_async,
            })

    if capture_cfg.get('classNames', True):
        for m in PY_CLASS_RE.finditer(content):
            bases = []
            if m.group(2):
                bases = [b.strip() for b in m.group(2).split(',') if b.strip()]
            result['classes'].append({
                'name': m.group(1),
                'extends': bases[0] if bases else None,
                'implements': bases[1:] if len(bases) > 1 else [],
            })

    if capture_cfg.get('decorators', True):
        for m in PY_DECORATOR_RE.finditer(content):
            result['decorators'].append({
                'name': m.group(1),
                'target': m.group(2),
            })


def _extract_cs(content: str, result: dict, capture_cfg: dict):
    """Extract C# structural elements."""
    if capture_cfg.get('imports', True):
        for m in CS_USING_RE.finditer(content):
            result['imports'].append({
                'module': m.group(1),
                'names': [],
            })

    if capture_cfg.get('functionSignatures', True):
        for m in CS_METHOD_RE.finditer(content):
            is_async = 'async' in content[max(0, m.start()-10):m.start()+20]
            params = len([p for p in m.group(3).split(',') if p.strip()]) if m.group(3) else 0
            result['functions'].append({
                'name': m.group(2),
                'params': params,
                'return_type': m.group(1) or None,
                'is_async': is_async,
            })

    if capture_cfg.get('classNames', True):
        for m in CS_CLASS_RE.finditer(content):
            bases = []
            if m.group(2):
                bases = [b.strip() for b in m.group(2).split(',') if b.strip()]
            result['classes'].append({
                'name': m.group(1),
                'extends': bases[0] if bases else None,
                'implements': bases[1:] if len(bases) > 1 else [],
            })

        # Also extract namespaces as a special class-level element
        for m in CS_NAMESPACE_RE.finditer(content):
            result.setdefault('namespaces', []).append(m.group(1))

    if capture_cfg.get('decorators', True):
        for m in CS_ATTRIBUTE_RE.finditer(content):
            result['decorators'].append({
                'name': m.group(1),
                'target': None,  # C# attributes don't always have an obvious target name
            })


def extract_structural_diff(old_string: str, new_string: str, lang: str,
                            capture_cfg: dict = None) -> dict:
    """Extract structural diff from Edit operation."""
    if capture_cfg is None:
        capture_cfg = {}

    if not capture_cfg.get('structuralDiffs', True):
        return {}

    old_struct = extract_structural_elements(old_string, lang, capture_cfg)
    new_struct = extract_structural_elements(new_string, lang, capture_cfg)

    diff = {}

    # Import diffs
    old_imports = {(i['module'], tuple(i.get('names', []))) for i in old_struct['imports']}
    new_imports = {(i['module'], tuple(i.get('names', []))) for i in new_struct['imports']}

    added_imports = new_imports - old_imports
    removed_imports = old_imports - new_imports

    if added_imports:
        diff['added_imports'] = [
            {'module': m, 'names': list(n)} for m, n in added_imports
        ]
    if removed_imports:
        diff['removed_imports'] = [
            {'module': m, 'names': list(n)} for m, n in removed_imports
        ]

    # Function diffs
    old_funcs = {f['name']: f for f in old_struct['functions']}
    new_funcs = {f['name']: f for f in new_struct['functions']}

    added_funcs = set(new_funcs.keys()) - set(old_funcs.keys())
    removed_funcs = set(old_funcs.keys()) - set(new_funcs.keys())

    if added_funcs:
        diff['added_functions'] = [
            {'name': n, 'params': new_funcs[n]['params']} for n in added_funcs
        ]
    if removed_funcs:
        diff['removed_functions'] = [n for n in removed_funcs]

    # Type changes on existing functions
    type_changes = []
    for name in set(old_funcs.keys()) & set(new_funcs.keys()):
        old_rt = old_funcs[name].get('return_type')
        new_rt = new_funcs[name].get('return_type')
        if old_rt != new_rt:
            type_changes.append({
                'function': name,
                'old_return': old_rt,
                'new_return': new_rt,
            })
    if type_changes:
        diff['type_changes'] = type_changes

    # Decorator diffs
    old_decorators = {(d['name'], d.get('target', '')) for d in old_struct['decorators']}
    new_decorators = {(d['name'], d.get('target', '')) for d in new_struct['decorators']}
    added_decorators = new_decorators - old_decorators
    removed_decorators = old_decorators - new_decorators

    if added_decorators:
        diff['added_decorators'] = [
            {'name': n, 'target': t} for n, t in added_decorators
        ]
    if removed_decorators:
        diff['removed_decorators'] = [
            {'name': n, 'target': t} for n, t in removed_decorators
        ]

    # Categorize the change
    diff['change_category'] = _categorize_change(diff)

    return diff


def _categorize_change(diff: dict) -> str:
    """Categorize a structural diff into a change type."""
    has_imports = bool(diff.get('added_imports') or diff.get('removed_imports'))
    has_funcs = bool(diff.get('added_functions') or diff.get('removed_functions'))
    has_types = bool(diff.get('type_changes'))
    has_decorators = bool(diff.get('added_decorators') or diff.get('removed_decorators'))

    if has_imports and not has_funcs and not has_types:
        return 'import_fix'
    if has_types and not has_funcs:
        return 'type_change'
    if has_decorators and not has_funcs:
        return 'decorator_change'
    if has_funcs and not has_imports:
        return 'function_change'
    if has_imports and has_funcs:
        return 'structural_addition'
    return 'mixed'


def extract_bash_structure(command: str, secret_patterns: list = None,
                           capture_cfg: dict = None) -> dict:
    """Extract structure from Bash command. Secrets sanitized."""
    if capture_cfg is None:
        capture_cfg = {}

    if not capture_cfg.get('bashFullCommand', True):
        return {}

    # Sanitize first
    sanitized = sanitize_command(command, secret_patterns or FALLBACK_SECRET_PATTERNS)

    result = {
        'operation': 'command',
        'full_command': sanitized,
    }

    # Parse command structure
    parts = sanitized.strip().split()
    if not parts:
        return result

    result['program'] = parts[0]

    # Extract subcommand (second non-flag arg)
    if len(parts) > 1 and not parts[1].startswith('-'):
        result['subcommand'] = parts[1]

    # Extract flags
    flags = [p for p in parts[1:] if p.startswith('-') and not '=' in p]
    if flags:
        result['flags'] = flags

    # Extract targets (non-flag args after subcommand)
    non_flag_args = [p for p in parts[2:] if not p.startswith('-')]
    if non_flag_args:
        result['targets'] = non_flag_args[:5]  # Cap at 5

    # Git-specific enrichment
    if result['program'] == 'git':
        _enrich_git(result, sanitized, parts)

    # Test-specific enrichment
    if result['program'] in ('npm', 'npx', 'yarn', 'pnpm', 'bun'):
        _enrich_node(result, parts)
    elif result['program'] in ('pytest', 'python', 'dotnet'):
        _enrich_test(result, parts)

    return result


def _enrich_git(result: dict, command: str, parts: list):
    """Extract git-specific structure."""
    subcommand = result.get('subcommand', '')
    if subcommand == 'commit':
        # Extract commit message
        msg_match = re.search(r'-m\s+["\']([^"\']+)["\']', command)
        if not msg_match:
            msg_match = re.search(r'-m\s+(\S+)', command)
        if msg_match:
            result['git_message'] = msg_match.group(1)


def _enrich_node(result: dict, parts: list):
    """Extract node package manager test/build targets."""
    if len(parts) > 1:
        subcmd = parts[1]
        if subcmd in ('test', 'run'):
            result['test_scope'] = ' '.join(parts[1:4])
        elif subcmd == 'build' or (subcmd == 'run' and len(parts) > 2 and parts[2] == 'build'):
            result['build_target'] = ' '.join(parts[1:4])


def _enrich_test(result: dict, parts: list):
    """Extract test framework targets."""
    if result['program'] == 'pytest':
        # Get test file/dir targets
        targets = [p for p in parts[1:] if not p.startswith('-')]
        if targets:
            result['test_scope'] = targets[0]
    elif result['program'] == 'dotnet' and len(parts) > 1 and parts[1] == 'test':
        result['test_scope'] = ' '.join(parts[1:3])


def sanitize_command(command: str, secret_patterns: list = None) -> str:
    """Strip secrets from command strings."""
    if not command:
        return command
    if secret_patterns is None:
        secret_patterns = FALLBACK_SECRET_PATTERNS

    sanitized = command
    for pattern in secret_patterns:
        try:
            sanitized = re.sub(pattern, '[REDACTED]', sanitized)
        except re.error:
            pass

    return sanitized


# --- Correction detection ---

def detect_correction(tool_name: str, file_path: str, cwd: str, session_id: str) -> bool:
    """Check if this Edit is a correction (Edit shortly after Write to same file)."""
    if tool_name != 'Edit' or not file_path:
        return False

    cache_path = get_session_cache_path(cwd)
    if not os.path.exists(cache_path):
        return False

    try:
        with open(cache_path, 'r', encoding='utf-8') as f:
            cache = json.load(f)

        now = datetime.now()
        for entry in reversed(cache.get('writes', [])):
            if entry.get('file_path') == file_path:
                try:
                    write_time = datetime.fromisoformat(entry['timestamp'])
                    if (now - write_time).total_seconds() < 300:  # 5 minutes
                        return True
                except Exception:
                    pass
                break
    except Exception:
        pass

    return False


# --- File rotation ---

def rotate_structural_if_needed(obs_path: str, max_bytes: int):
    """Rotate structural observations file if it exceeds max size."""
    try:
        if not os.path.exists(obs_path):
            return
        size = os.path.getsize(obs_path)
        if size < max_bytes:
            return
        date_str = datetime.now().strftime('%Y%m%d-%H%M%S')
        archive_path = obs_path.replace('.jsonl', f'.archive-{date_str}.jsonl')
        os.rename(obs_path, archive_path)
    except Exception:
        pass


# --- Main entry point ---

def main():
    """Main entry point for structural observation hook."""
    try:
        input_data = load_hook_input()

        cwd = input_data.get('cwd', '.')
        session_id = input_data.get('session_id', '')

        # Load config
        if CONFIG_AVAILABLE:
            config = load_config(cwd)
            structural_cfg = get_structural_config(config)
            privacy_cfg = get_privacy_config(config)
        else:
            structural_cfg = {
                'enabled': True,
                'maxContentBytes': MAX_CONTENT_BYTES,
                'maxCommandLength': MAX_COMMAND_LENGTH,
                'languages': {},
                'capturePatterns': {},
                'secretCommandPatterns': FALLBACK_SECRET_PATTERNS,
                'maxStructuralObservationsMB': 10,
            }
            privacy_cfg = {
                'excludeSecretFiles': [],
            }

        if not structural_cfg.get('enabled', True):
            print(json.dumps({"ok": True}))
            sys.exit(0)

        tool_name = input_data.get('tool_name', '')
        tool_input = input_data.get('tool_input', {})

        if tool_name not in ('Write', 'Edit', 'Bash'):
            print(json.dumps({"ok": True}))
            sys.exit(0)

        # --- Route by tool type ---

        max_content = structural_cfg.get('maxContentBytes', MAX_CONTENT_BYTES)
        max_cmd_len = structural_cfg.get('maxCommandLength', MAX_COMMAND_LENGTH)
        capture_cfg = structural_cfg.get('capturePatterns', {})
        lang_config = structural_cfg.get('languages', {})
        secret_patterns = structural_cfg.get('secretCommandPatterns', FALLBACK_SECRET_PATTERNS)
        secret_files = privacy_cfg.get('excludeSecretFiles', [])

        observation = None

        if tool_name == 'Write':
            observation = _handle_write(
                tool_input, max_content, capture_cfg, lang_config, secret_files, session_id
            )

        elif tool_name == 'Edit':
            observation = _handle_edit(
                tool_input, max_content, capture_cfg, lang_config, secret_files,
                session_id, cwd
            )

        elif tool_name == 'Bash':
            observation = _handle_bash(
                tool_input, max_cmd_len, capture_cfg, secret_patterns, session_id
            )

        if observation:
            # Write structural observation
            obs_path = get_structural_observations_path(cwd)
            max_mb = structural_cfg.get('maxStructuralObservationsMB', 10)
            max_bytes = max_mb * 1024 * 1024

            rotate_structural_if_needed(obs_path, max_bytes)

            os.makedirs(os.path.dirname(obs_path), exist_ok=True)
            with open(obs_path, 'a', encoding='utf-8') as f:
                f.write(json.dumps(observation) + '\n')

        print(json.dumps({"ok": True}))
        sys.exit(0)

    except Exception:
        print(json.dumps({"ok": True}))
        sys.exit(0)


def _handle_write(tool_input: dict, max_content: int, capture_cfg: dict,
                  lang_config: dict, secret_files: list, session_id: str) -> dict | None:
    """Handle Write tool - extract structural elements from new file content."""
    file_path = tool_input.get('file_path', '')
    content = tool_input.get('content', '')

    if not file_path or not content:
        return None

    # Skip secret files
    if is_secret_file(file_path, secret_files):
        return None

    # Check language family
    lang = get_language_family(file_path, lang_config)
    if not lang:
        return None

    # Content size guard
    if len(content.encode('utf-8', errors='ignore')) > max_content:
        return None

    structural = extract_structural_elements(content, lang, capture_cfg)
    structural['file_path'] = file_path
    structural['operation'] = 'create'

    return {
        'timestamp': datetime.now().isoformat(),
        'tool': 'Write',
        'structural': structural,
        'session_id': session_id,
    }


def _handle_edit(tool_input: dict, max_content: int, capture_cfg: dict,
                 lang_config: dict, secret_files: list, session_id: str,
                 cwd: str) -> dict | None:
    """Handle Edit tool - extract structural diff."""
    file_path = tool_input.get('file_path', '')
    old_string = tool_input.get('old_string', '')
    new_string = tool_input.get('new_string', '')

    if not file_path or (not old_string and not new_string):
        return None

    if is_secret_file(file_path, secret_files):
        return None

    lang = get_language_family(file_path, lang_config)
    if not lang:
        return None

    # Size guard on both strings
    combined_size = len((old_string + new_string).encode('utf-8', errors='ignore'))
    if combined_size > max_content:
        return None

    structural = extract_structural_diff(old_string, new_string, lang, capture_cfg)
    if not structural:
        return None

    structural['file_path'] = file_path
    structural['operation'] = 'modify'

    # Detect if this is a user correction
    is_correction = detect_correction('Edit', file_path, cwd, session_id)
    if is_correction:
        structural['is_correction'] = True

    return {
        'timestamp': datetime.now().isoformat(),
        'tool': 'Edit',
        'structural': structural,
        'session_id': session_id,
    }


def _handle_bash(tool_input: dict, max_cmd_len: int, capture_cfg: dict,
                 secret_patterns: list, session_id: str) -> dict | None:
    """Handle Bash tool - extract command structure."""
    command = tool_input.get('command', '')

    if not command:
        return None

    # Truncate overly long commands
    if len(command) > max_cmd_len:
        command = command[:max_cmd_len]

    structural = extract_bash_structure(command, secret_patterns, capture_cfg)
    if not structural:
        return None

    return {
        'timestamp': datetime.now().isoformat(),
        'tool': 'Bash',
        'structural': structural,
        'session_id': session_id,
    }


if __name__ == '__main__':
    main()
