# md-to-skill

Continuous learning engine for Claude Code. Automatically observes coding patterns, builds instincts from repeated behaviors, and evolves validated instincts into reusable skills.

## Overview

md-to-skill learns from how you work. It passively observes your tool use patterns, identifies recurring behaviors, and crystallizes them into "instincts" — lightweight learned preferences with confidence scores. As instincts strengthen through repeated validation, they can auto-approve at high confidence or evolve into full Claude skills.

### The Learning Pipeline

```
Session Activity → Observer Hook → Observations (.jsonl)
                                        ↓
                                   /observe command
                                        ↓
                               Instinct files (.md)
                                   ↓           ↓
                          Auto-approve      /evolve
                          (>= 0.7)          command
                                               ↓
                                    Full Claude Skills (SKILL.md)
```

## Core Features

### Automatic Pattern Detection

The observer hook passively captures tool use metadata during every session. It detects:

- **Tool preferences** — which tools you consistently choose for tasks
- **User corrections** — when you edit shortly after writing (preference signals)
- **Error resolutions** — how you fix recurring errors
- **Workflow sequences** — repeated multi-step patterns
- **File naming conventions** — consistent naming styles
- **Command patterns** — repeated bash commands and prefixes

All observations stay local. Content is never captured — only lightweight metadata like file paths, tool names, and success/failure status.

### Instinct Lifecycle

Instincts are small learned behaviors with confidence scores (0.3 to 0.95):

1. **Created** at initial confidence (default 0.3) when a pattern is first detected
2. **Strengthened** by +0.1 each time the pattern repeats without correction
3. **Decayed** by -0.05/week after 14 days of inactivity (validated patterns decay at half rate)
4. **Auto-approved** when confidence reaches 0.7 — treated as established behaviors
5. **Evolved** into full skills when 3+ related instincts cluster with avg confidence >= 0.5
6. **Pruned** when confidence drops below 0.2 or inactive for 60+ days

### Personal vs Inherited Instincts

- **Personal** (`source: "session-observation"`) — observed from your sessions, fully editable
- **Inherited** (`source: "inherited"`) — team/project baselines, read-only
- **Imported** (`source: "imported"`) — brought from other projects, editable

### Auto-Approve Mechanism

When an instinct reaches the auto-approve threshold (default 0.7), it's marked as `auto_approved: true`. Auto-approved instincts represent validated patterns and:
- Are highlighted in `/instinct-status` reports
- Decay at half the normal rate
- Are protected from pruning
- Are prioritized in evolution clustering

### Configuration

All thresholds are centralized in `config/defaults.json` and can be overridden per-project via `.claude/md-to-skill.local.md`:

```yaml
---
autoApproveThreshold: 0.7
confidenceDecayPerWeek: 0.05
maxInstincts: 100
observeEnabled: true
watchEnabled: true
debug: false
---
```

### Privacy Design

- Content is **never** captured — only tool names, file paths, and success/failure
- Bash command previews truncated to 200 characters
- Secret files (`.env`, `*.key`, `*.pem`) are excluded from observation
- All data stays local in `.claude/` directory
- Only distilled instinct patterns (not raw observations) are exportable

## Secondary Features

### Markdown-to-Skill Conversion

Convert LLM-generated markdown files into organized Claude skills:

```bash
/convert-to-skill path/to/file.md    # Convert single file
/learn-skill                          # Scan directory for candidates
```

Features: automatic structure analysis, code block extraction to `examples/`, topic splitting into `references/`, auto-generated frontmatter, quality validation, and smart merging with existing skills.

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

### Learning Commands (Primary)

| Command | Description |
|---------|-------------|
| `/observe [--auto] [--patterns] [--since <date>] [--replay]` | Analyze observations and extract instinct patterns |
| `/instinct-status` | View all instincts with confidence scores, domains, and staleness |
| `/evolve` | Cluster related instincts into full Claude skills |
| `/instinct-prune` | Remove stale or low-confidence instincts |
| `/instinct-merge` | Merge similar or duplicate instincts |
| `/observe-health` | Check observation system health status |
| `/skill-health` | Monitor skill effectiveness and usage analytics |

### Portability Commands

| Command | Description |
|---------|-------------|
| `/instinct-export [--domain <d>] [--min-confidence <n>]` | Export instincts to portable JSON |
| `/instinct-import <file>` | Import instincts from export file |
| `/instinct-export-context` | Export auto-approved instincts as project context |

### Conversion Commands (Secondary)

| Command | Description |
|---------|-------------|
| `/convert-to-skill <file>` | Convert markdown file into organized Claude skill |
| `/learn-skill [directory]` | Scan directory and batch convert markdown files |

## Components

### Agents
- **skill-builder** — Converts markdown to organized skills (conversion pipeline)
- **learning-observer** — Deep pattern analysis beyond hook-level detection

### Hooks
- **PreToolUse:Write|Edit|Bash** — Instinct suggestion (proactive tips from auto-approved instincts)
- **PostToolUse:Write|Edit|Bash** — Observation collector (captures tool use metadata)
- **PostToolUse:Skill** — Skill usage tracker with feedback loop (reinforces source instincts)
- **PostToolUse:Skill** — Quick-wins bridge (writes observations from quick-wins scans)
- **PostToolUse:Skill** — Ask-before-code bridge (writes observations from clarifications)
- **Stop** — Markdown watcher and observation accumulation alerts

### Skills
- **continuous-learning** — Methodology for the observation-instinct-evolution pipeline
- **markdown-parsing** — Techniques for parsing markdown structure
- **skill-structure-patterns** — Best practices for Claude skill creation

### Configuration
- **config/defaults.json** — Centralized default thresholds
- **config/config_loader.py** — Settings loader with user override merging

## Data Files

All data is stored in the project's `.claude/` directory:

| File | Purpose |
|------|---------|
| `md-to-skill-observations.jsonl` | Tool use observations (rotated at 10MB) |
| `md-to-skill-instincts/*.md` | Individual instinct files with YAML frontmatter |
| `md-to-skill-usage.json` | Skill invocation tracking |
| `md-to-skill-session-cache.json` | Lightweight session state for correction detection |
| `md-to-skill-observe-state.json` | Idempotent processing state for /observe |
| `md-to-skill-reinforcement-dedup.json` | Dedup tracking for feedback loop |
| `instincts-export.json` | Portable instinct export file |
| `learned-patterns.md` | Auto-approved instincts as project context |
| `md-to-skill.local.md` | Per-project settings overrides |

## Troubleshooting

**Observations not collecting:**
- Check `observeEnabled: true` in `.claude/md-to-skill.local.md`
- Verify hooks are loaded: the PostToolUse hook should trigger on Write/Edit/Bash

**Instincts not growing:**
- Run `/observe` after several sessions to analyze accumulated observations
- Check `/instinct-status` for confidence scores and staleness indicators
- Ensure `--auto` flag is not accidentally set for every run

**Auto-approve not working:**
- Check `autoApproveThreshold` in config (default: 0.7)
- Run `/observe` to trigger the auto-approve check
- Verify instinct confidence is above the threshold

**Evolution failing:**
- Need at least 3 instincts in the same domain
- Average confidence must be >= 0.5
- Inherited instincts don't participate in evolution

## Version History

### 0.6.0 - Gap Enhancement Release
- Instinct suggestion PreToolUse hook: proactive tips from auto-approved instincts during tool use
- Conflict detection in `/observe`: detects contradictory instincts before creation
- `/observe-health` command: system health check for observation pipeline
- Idempotent observation processing: `/observe` only processes new observations since last run
- `--replay` flag: reprocess all observations with diff output
- Skill usage feedback loop: evolved skills reinforce source instinct confidence (+0.02)
- `/instinct-merge` command: detect and merge duplicate instincts
- Cross-session consistency tracking: instincts track which sessions contributed observations
- Quick-wins bridge hook: quick-wins scans feed into learning pipeline
- Ask-before-code bridge hook: clarification events feed into learning pipeline
- `/instinct-export-context` command: export auto-approved instincts as project context
- `/instinct-export` and `/instinct-import` commands: portable instinct sharing across projects
- Integration config section in `defaults.json` for cross-plugin feature flags

### 0.5.0 - Learning-First Reorganization
- Learning-first identity: observation → instincts → skill evolution
- Centralized config system (`config/defaults.json`)
- Richer pattern detection: user corrections, error resolutions, workflow sequences, naming conventions
- Auto-approve mechanism for high-confidence instincts (>= 0.7)
- Personal vs inherited instinct separation
- New continuous-learning skill with methodology documentation
- New learning-observer agent for deep pattern analysis
- Config-driven thresholds replace all hardcoded values
- Privacy-first design: secret file exclusion, content never captured

### 0.4.0 - Continuous Learning Layer
- Observation collector hook (PostToolUse)
- `/observe` command for instinct extraction
- `/evolve` command for instinct clustering
- `/instinct-status` and `/instinct-prune` commands
- `/skill-health` with instinct pipeline integration
- Skill usage tracking hook

### 0.3.0 - Batch Processing
- `/learn-skill` command with bulk mode
- Smart defaults for batch conversion
- Deferred cleanup for batch files

### 0.2.0 - Smart Merging
- Intelligent merge with existing skills
- Conflict detection and resolution

### 0.1.0 - Initial Release
- `/convert-to-skill` command
- skill-builder agent
- markdown-parsing and skill-structure-patterns skills
- Quality validation and auto-fix

## Acknowledgments

The v0.5.0 learning-first reorganization was inspired by [continuous-learning-v2](https://github.com/affaan-m/everything-claude-code/tree/main/skills/continuous-learning-v2) from the [everything-claude-code](https://github.com/affaan-m/everything-claude-code) project by affaan-m.

## License

MIT
