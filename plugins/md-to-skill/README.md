# md-to-skill

Converts markdown files into organized Claude skills with intelligent candidate detection. Stop hook scores new markdown files across 6 signals to suggest high-confidence skill candidates.

## Overview

md-to-skill has two core capabilities:

1. **Skill candidate detection** — A Stop hook scores new markdown files across 6 weighted signals to identify high-confidence skill candidates
2. **Markdown-to-skill conversion** — Converts markdown files into structured Claude skills with progressive disclosure, code extraction, and quality validation

### Skill Candidate Detection

When a session ends, the Stop hook scans for markdown files written during the session and scores each one:

| Signal | Weight | What it measures |
|--------|--------|-----------------|
| Instructional language | 0.25 | How-to, patterns, best practices, workflow markers |
| Heading structure | 0.20 | Heading depth variety (h1/h2/h3) |
| Content depth | 0.15 | Word count scaled 200-2000 |
| Code blocks | 0.15 | Fenced code block presence |
| Sections | 0.15 | Number of h2/h3 sections |
| Lists | 0.10 | Bullet/numbered list presence |

Files scoring >= 40% confidence are suggested with their score and top signals.

### Markdown-to-Skill Conversion

Convert markdown files into organized Claude skills:

```bash
/convert-to-skill path/to/file.md    # Convert single file
/learn-skill                          # Scan directory for candidates
```

Features: automatic structure analysis, code block extraction to `examples/`, topic splitting into `references/`, auto-generated frontmatter with trigger phrases, quality validation, and smart merging with existing skills.

## Installation

### From Marketplace
```bash
/plugin marketplace add AndaAndaman/claude-plugins
/plugin install md-to-skill
```

### Local Development
```bash
git clone https://github.com/AndaAndaman/claude-plugins.git
cd claude-plugins
claude --plugin-dir ./plugins/md-to-skill
```

## Commands

| Command | Description |
|---------|-------------|
| `/convert-to-skill <file>` | Convert markdown file into organized Claude skill |
| `/learn-skill [directory]` | Scan directory and batch convert markdown files |
| `/skill-shopping [task]` | Recommend relevant installed skills for current task |

## Components

### Hook
- **Stop** — `md-watch_stop.js` — Scores new markdown files as skill candidates using multi-signal confidence scoring

### Agent
- **skill-builder** — Converts markdown to organized skills (7-phase conversion pipeline)

### Skills
- **markdown-parsing** — Techniques for parsing markdown structure
- **skill-structure-patterns** — Best practices for Claude skill creation

## Version History

### 0.8.7 - Streamlined
- Removed observation hooks and instinct pipeline (observe, structural, skill, instinct-suggest hooks)
- Removed 12 instinct commands, learning-observer agent, continuous-learning skill
- Enhanced md-watch Stop hook with multi-signal confidence scoring (6 weighted signals)
- Focused plugin on markdown-to-skill conversion

### 0.8.0 - Node.js Hook Migration
- Converted all hooks from Python to Node.js
- Eliminated Python runtime dependency

### 0.6.0 - Gap Enhancement Release
- Instinct suggestion, conflict detection, skill usage feedback loop
- Cross-plugin bridge hooks, portability commands

### 0.5.0 - Learning-First Reorganization
- Continuous learning identity with observation-instinct-evolution pipeline
- Centralized config system, auto-approve mechanism

### 0.1.0 - Initial Release
- `/convert-to-skill`, skill-builder agent, quality validation

## Acknowledgments

The v0.5.0 learning-first reorganization was inspired by [continuous-learning-v2](https://github.com/affaan-m/everything-claude-code/tree/main/skills/continuous-learning-v2) from the [everything-claude-code](https://github.com/affaan-m/everything-claude-code) project by affaan-m.

## License

MIT
