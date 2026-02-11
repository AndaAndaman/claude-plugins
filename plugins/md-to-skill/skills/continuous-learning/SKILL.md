---
name: continuous-learning
description: This skill should be used when the user asks to "understand the learning system", "how do instincts work", "explain pattern detection", "configure learning settings", "what is auto-approve", or mentions continuous improvement and learning pipeline. Provides methodology for the observation-instinct-evolution pipeline.
---

# Continuous Learning Pipeline

## Overview

The continuous learning system observes how you work, extracts patterns as lightweight "instincts", and evolves mature instincts into full skills. The entire pipeline operates on metadata only — never capturing file content.

```
Observe → Instincts → Evolve → Skills
  |          |           |        |
  |    lightweight    cluster    full
  |    behaviors     related   knowledge
  |    (0.3-0.95)   instincts   base
  |
  tool use
  metadata
```

## Pipeline Stages

### Stage 1: Observation

A PostToolUse hook silently records metadata about every tool invocation:
- Tool name and timestamp
- Input summary (file paths, content lengths — never actual content)
- Output summary (success/failure, exit codes)
- Session identifier

Observations accumulate in `.claude/md-to-skill-observations.jsonl` as newline-delimited JSON.

### Stage 2: Pattern Detection

Run `/observe` or use the learning-observer agent for deep analysis. The system detects:
- **Tool preferences** — consistent tool choices for similar tasks
- **File patterns** — naming conventions, co-creation habits
- **Edit patterns** — correction behaviors, iterative refinement
- **Command patterns** — repeated bash commands
- **Error-fix sequences** — failures followed by specific resolutions
- **Workflow sequences** — multi-step chains repeated across sessions

See `references/pattern-types.md` for detailed documentation of each pattern type.

### Stage 3: Instinct Creation

Detected patterns become instincts — lightweight behavioral suggestions stored as markdown files in `.claude/md-to-skill-instincts/`. Each instinct has:
- A **trigger** phrase describing when it applies
- An **action** describing what to do
- A **confidence** score (0.0 - 0.95) reflecting observation strength
- A **domain** tag for categorization

Instincts start at confidence 0.3 and grow through repeated observation. See `references/instinct-lifecycle.md` for the full lifecycle.

### Stage 4: Evolution

When 3+ instincts in the same domain reach an average confidence of 0.5+, they form a cluster eligible for evolution. Run `/evolve` to combine them into a full Claude skill with proper structure (SKILL.md, references/, examples/).

## Commands

| Command | Purpose |
|---------|---------|
| `/observe [--auto]` | Analyze observations, create/update instincts |
| `/instinct-status` | View all instincts grouped by confidence level |
| `/evolve` | Cluster mature instincts into full skills |
| `/instinct-prune` | Remove stale or low-confidence instincts |
| `/skill-health` | Check usage metrics of installed skills |

## Configuration

### Config File

Default settings live in the plugin's `config/defaults.json`. Override per-project by adding settings to `.claude/md-to-skill.local.md`.

Key settings:

```json
{
  "observer": {
    "enabled": true,
    "capturePatterns": {
      "userCorrections": true,
      "errorResolutions": true,
      "repeatedWorkflows": true,
      "toolPreferences": true,
      "fileNamingConventions": true
    }
  },
  "instincts": {
    "initialConfidence": 0.3,
    "confidenceIncrement": 0.1,
    "autoApproveThreshold": 0.7,
    "maxInstincts": 100
  }
}
```

### Per-Project Overrides

Create `.claude/md-to-skill.local.md` in any project to customize:

```markdown
# md-to-skill Local Config

## Observer
- Disable import pattern tracking: `importPatterns: false`
- Exclude additional paths: `excludePathPatterns: ["vendor", "third_party"]`

## Instincts
- Raise auto-approve threshold: `autoApproveThreshold: 0.8`
- Lower initial confidence: `initialConfidence: 0.2`
```

## Auto-Approve Mechanism

When an instinct's confidence reaches the `autoApproveThreshold` (default 0.7), it becomes auto-approved:
- The instinct is treated as a confirmed behavior
- It appears in `/instinct-status` under the "Strong" category
- It becomes eligible to influence suggestions without user confirmation
- It carries more weight during `/evolve` clustering

Auto-approve does not mean the instinct acts autonomously. It means the system has high confidence the pattern is genuine and stops asking for confirmation when reinforcing it.

## Personal vs Inherited Instincts

**Personal instincts** are created from your own observations:
- Source: `"session-observation"` or `"deep-analysis"`
- Stored in `.claude/md-to-skill-instincts/`
- Fully under your control

**Inherited instincts** come from team-shared patterns:
- Source: `"team-shared"`
- Start at the confidence they were shared at
- Decay independently from the original
- Can be pruned without affecting the team version

To share an instinct with the team, copy it to a shared location and update the source field.

## Privacy Design

The learning system is built with privacy as a core constraint:

1. **Never capture content** — only metadata (file paths, content lengths, tool names)
2. **Command previews truncated** — bash commands limited to 200 characters
3. **Secret files excluded** — `.env`, credentials, key files are never recorded
4. **Configurable exclusions** — add paths or tools to exclude lists
5. **Local storage only** — observations and instincts stay in `.claude/` (gitignored)
6. **User control** — disable observation entirely via `observer.enabled: false`

## Common Workflows

### Getting Started

1. Work normally for a few sessions (observations accumulate automatically)
2. Run `/observe` to see detected patterns
3. Approve instincts that match your actual preferences
4. Check `/instinct-status` periodically to track growth

### Building Up Instincts

1. Run `/observe` after focused work sessions
2. Review and approve relevant patterns
3. Watch confidence grow as patterns repeat
4. Prune false positives with `/instinct-prune`

### Evolving to Skills

1. Run `/instinct-status` to see if any domain has 3+ mature instincts
2. Run `/evolve` to cluster and generate skill candidates
3. Review generated skills and install them
4. Evolved instincts are marked with `evolved_into` metadata

### Maintenance

1. Run `/instinct-prune` monthly to clean stale instincts
2. Run `/skill-health` to check if evolved skills are being used
3. Adjust config thresholds if instincts grow too fast or too slow
