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
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional

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

# Default exclusions
DEFAULT_EXCLUSIONS = [
    "node_modules", "vendor", "packages",
    ".git", ".svn", ".hg", ".bzr",
    "dist", "build", "out", "target", "bin", "obj",
    "test", "tests", "spec", "specs", "__tests__", "__snapshots__",
    "coverage", ".next", ".nuxt", ".angular", "__pycache__",
    "temp", "tmp", "cache"
]


def read_settings(project_root: str) -> Dict:
    """Read settings from .claude/local-memory.local.md"""
    settings = {
        "threshold": 2,
        "autoGenerate": True,
        "maxFilesAnalyzed": 50,
        "excludedDirectories": []
    }

    settings_file = os.path.join(project_root, ".claude", "local-memory.local.md")
    if not os.path.exists(settings_file):
        return settings

    try:
        with open(settings_file, 'r', encoding='utf-8') as f:
            content = f.read()

        # Extract YAML frontmatter
        if content.startswith('---'):
            parts = content.split('---', 2)
            if len(parts) >= 2:
                frontmatter = parts[1]

                # Parse simple YAML fields
                for line in frontmatter.split('\n'):
                    line = line.strip()
                    if ':' in line and not line.startswith('-'):
                        key, value = line.split(':', 1)
                        key = key.strip()
                        value = value.strip()

                        if key == "threshold":
                            settings["threshold"] = int(value)
                        elif key == "autoGenerate":
                            settings["autoGenerate"] = value.lower() == "true"
                        elif key == "maxFilesAnalyzed":
                            settings["maxFilesAnalyzed"] = int(value)
                    elif line.startswith('-') and 'excludedDirectories' in frontmatter:
                        # Extract excluded directory
                        excluded = line[1:].strip()
                        if excluded:
                            settings["excludedDirectories"].append(excluded)
    except Exception as e:
        print(f"Warning: Error reading settings: {e}", file=sys.stderr)

    return settings


def is_excluded(path: str, exclusions: List[str]) -> bool:
    """Check if path contains any excluded directory"""
    path_parts = Path(path).parts
    all_exclusions = DEFAULT_EXCLUSIONS + exclusions

    for excluded in all_exclusions:
        if excluded in path_parts:
            return True
    return False


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


def analyze_imports(file_path: str, language: str) -> Dict:
    """Analyze imports/exports in a file"""
    imports = {"internal": [], "external": []}

    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()

        if language in ['typescript', 'javascript']:
            # Find import statements
            import_pattern = r'import\s+.*\s+from\s+[\'"]([^\'"]+)[\'"]'
            for match in re.finditer(import_pattern, content):
                module = match.group(1)
                if module.startswith('.'):
                    imports["internal"].append(module)
                else:
                    imports["external"].append(module)

        elif language == 'python':
            # Find import statements
            import_pattern = r'(?:from\s+(\S+)\s+import|import\s+(\S+))'
            for match in re.finditer(import_pattern, content):
                module = match.group(1) or match.group(2)
                if module.startswith('.'):
                    imports["internal"].append(module)
                else:
                    imports["external"].append(module)

    except Exception as e:
        print(f"Warning: Error analyzing {file_path}: {e}", file=sys.stderr)

    return imports


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

        # Find files
        files = []
        try:
            for entry in os.scandir(directory):
                if entry.is_file() and not entry.name.startswith('.'):
                    files.append(entry.name)
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
        patterns = []
        if any(f.endswith('.test.ts') or f.endswith('.spec.ts') for f in files):
            patterns.append("Contains test files")
        if 'index.ts' in files or 'index.js' in files:
            patterns.append("Has index file (module entry point)")
        if any('Controller' in f for f in files):
            patterns.append("Contains controller classes")
        if any('Service' in f for f in files):
            patterns.append("Contains service classes")

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

        # First analyze directory
        analysis_result = await handle_call_tool("analyze_directory", {
            "directory": directory,
            "project_root": project_root
        })

        analysis = json.loads(analysis_result[0].text)
        if "error" in analysis:
            return analysis_result

        # Generate CLAUDE.md content
        dir_name = os.path.basename(directory.rstrip('/\\'))
        content = f"""<!-- AUTO-GENERATED by local-memory plugin on {datetime.now().strftime('%Y-%m-%d')} -->
<!-- To preserve custom content, add sections outside auto-gen blocks -->

# Module: {dir_name}

## Overview

[TODO: Add 2-3 sentence description of what this module does and its role in the system]

## Files

"""

        # Add file descriptions
        for file_name in analysis["files"]:
            content += f"### {file_name}\n"
            content += f"[TODO: 1-2 sentence description of what this file does]\n\n"

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
                    content += f"- `{imp}` - [Why needed]\n"
                content += "\n"

            if all_external:
                content += "**External Dependencies:**\n"
                for imp in sorted(all_external)[:10]:  # Limit to 10
                    content += f"- `{imp}` - [How used]\n"
                content += "\n"

        content += "<!-- END AUTO-GENERATED CONTENT -->\n"

        return [TextContent(type="text", text=content)]

    elif name == "write_context":
        directory = arguments.get("directory", ".")
        content = arguments.get("content", "")
        smart_merge = arguments.get("smart_merge", True)

        # Resolve path
        if not os.path.isabs(directory):
            directory = os.path.abspath(directory)

        claude_md_path = os.path.join(directory, "CLAUDE.md")

        # Smart merge if file exists
        if smart_merge and os.path.exists(claude_md_path):
            try:
                with open(claude_md_path, 'r', encoding='utf-8') as f:
                    existing = f.read()

                # Extract user content (outside auto-gen blocks)
                user_content = ""
                if "<!-- END AUTO-GENERATED CONTENT -->" in existing:
                    parts = existing.split("<!-- END AUTO-GENERATED CONTENT -->")
                    if len(parts) > 1:
                        user_content = parts[1]

                # Combine new auto-gen + preserved user content
                if user_content.strip():
                    content = content + "\n" + user_content

            except Exception as e:
                print(f"Warning: Smart merge failed: {e}", file=sys.stderr)

        # Write file
        try:
            with open(claude_md_path, 'w', encoding='utf-8') as f:
                f.write(content)

            result = {
                "success": True,
                "path": claude_md_path,
                "action": "updated" if os.path.exists(claude_md_path) else "created"
            }
            return [TextContent(type="text", text=json.dumps(result, indent=2))]

        except Exception as e:
            return [TextContent(
                type="text",
                text=json.dumps({"error": f"Failed to write file: {e}"})
            )]

    elif name == "list_context_files":
        project_root = arguments.get("project_root", os.getcwd())

        # Find all CLAUDE.md files
        context_files = []
        try:
            for root, dirs, files in os.walk(project_root):
                # Skip excluded directories
                dirs[:] = [d for d in dirs if not is_excluded(os.path.join(root, d), [])]

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
                server_version="0.1.7",
                capabilities=server.get_capabilities(
                    notification_options=NotificationOptions(),
                    experimental_capabilities={}
                )
            )
        )


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
