# Instinct Lifecycle Reference

## State Transitions

```
                    observe/reinforce
                    (+0.1 confidence)
                         |
  [Created] ──→ [Growing] ──→ [Auto-Approved] ──→ [Evolved]
   (0.3)       (0.3-0.69)      (0.7-0.95)          (skill)
     |              |               |
     |         no observations  no observations
     |              |               |
     └──→ [Decaying] ──→ [Stale] ──→ [Pruned]
          (confidence     (<0.2 or    (deleted)
           dropping)      >60 days)
```

## Confidence Scoring

### Initial Creation

New instincts start at the `initialConfidence` value (default: 0.3). This represents "pattern detected but not yet confirmed."

Sources and their starting confidence:
- `/observe` interactive mode: 0.3 (user-confirmed pattern)
- `/observe --auto` mode: 0.3 (auto-detected, same starting point)
- Deep analysis (learning-observer): 0.3-0.6 (based on observation count)

### Reinforcement

Each time `/observe` detects the same pattern again:

```
new_confidence = min(maxConfidence, current_confidence + confidenceIncrement)
```

Default values:
- `confidenceIncrement`: 0.1
- `maxConfidence`: 0.95

The instinct file is updated with:
- Incremented `confidence` value
- Updated `last_seen` timestamp
- Incremented `observations` count
- New evidence line appended

### Confidence Decay

Instincts that are not reinforced gradually lose confidence, reflecting that unused patterns may no longer be relevant.

**Decay formula:**

```
weeks_elapsed = (now - last_seen).days / 7
if weeks_elapsed > gracePeriodDays / 7:
    effective_weeks = weeks_elapsed - (gracePeriodDays / 7)
    decayed = max(minimumConfidence, confidence - (effective_weeks * decayPerWeek))
```

**Default parameters:**
- `gracePeriodDays`: 14 (no decay for first 2 weeks)
- `decayPerWeek`: 0.05
- `minimumConfidence`: 0.1

**Example decay timeline** (starting at 0.7, no reinforcement):

| Week | Confidence | Status |
|------|-----------|--------|
| 0 | 0.70 | Auto-approved |
| 1 | 0.70 | Grace period |
| 2 | 0.70 | Grace period |
| 3 | 0.65 | Growing |
| 4 | 0.60 | Growing |
| 6 | 0.50 | Growing |
| 8 | 0.40 | Growing |
| 10 | 0.30 | Tentative |
| 14 | 0.10 | Minimum (floor) |

Decay is calculated on-read, not on-write. The stored confidence value is the last reinforced value. Display tools (`/instinct-status`) compute the decayed value for presentation.

## Auto-Approve Mechanism

### Threshold

When an instinct's effective confidence (after decay calculation) reaches `autoApproveThreshold` (default: 0.7), it enters the auto-approved state.

### What Auto-Approve Means

- The pattern is considered a confirmed behavioral preference
- `/observe` reinforces the instinct without asking the user
- The instinct is weighted more heavily during `/evolve` clustering
- It appears in the "Strong" tier of `/instinct-status`

### What Auto-Approve Does NOT Mean

- The instinct does not execute actions autonomously
- It does not modify files or run commands
- It does not override user decisions
- It can still decay back below the threshold if not reinforced

### Losing Auto-Approve Status

If an auto-approved instinct decays below the threshold (due to no reinforcement), it reverts to "Growing" status. It can regain auto-approve status through future reinforcement.

## Evolution Requirements

Instincts evolve into full skills when clustered with related instincts via `/evolve`.

### Cluster Formation

A cluster is eligible for evolution when:
1. **Minimum size:** 3 or more instincts share the same domain tag
2. **Average confidence:** The cluster's mean confidence >= `minAverageConfidence` (default: 0.5)
3. **No existing skill:** The domain has not already produced an evolved skill

### Evolution Process

1. `/evolve` identifies eligible clusters
2. Related instinct triggers and actions are combined into a coherent markdown document
3. The combined document is fed through the skill-builder agent
4. The agent generates a proper skill (SKILL.md + references/ + examples/)
5. User reviews and approves the generated skill

### Post-Evolution

After an instinct evolves into a skill:
- The instinct file gains an `evolved_to: "{skill-name}"` frontmatter field
- The instinct remains in place (not deleted) as a record
- The instinct stops receiving reinforcement updates
- It appears in `/instinct-status` under the "Evolved" category

## Pruning

### Automatic Prune Candidates

`/instinct-prune` identifies candidates using these thresholds:

**Auto-remove (recommend deletion):**
- Confidence below `autoRemoveConfidence` (default: 0.2) OR
- Last seen more than `autoRemoveStalenessDays` ago (default: 60 days)

**Review (present for user decision):**
- Confidence below `reviewConfidence` (default: 0.3) OR
- Last seen more than `reviewStalenessDays` ago (default: 30 days)

### Prune Behavior

1. Collect all instinct files
2. Calculate effective confidence (with decay) for each
3. Categorize into auto-remove, review, and keep
4. Present auto-remove candidates with option to save
5. Present review candidates with option to prune or keep
6. Delete confirmed prune targets
7. Report summary

### Manual Pruning

Delete any instinct file directly from `.claude/md-to-skill-instincts/` to permanently remove it.

## Instinct File Format

Each instinct is a markdown file with YAML frontmatter:

```markdown
---
id: prefer-grep-over-bash
trigger: "when searching file contents"
confidence: 0.6
domain: "tool-preference"
source: "session-observation"
created: "2026-02-01T10:00:00Z"
last_seen: "2026-02-10T14:30:00Z"
observations: 8
evolved_to: ""
---

# Prefer Grep Over Bash

## Action
Use the Grep tool instead of Bash with grep/rg commands when searching
file contents. Grep provides better output formatting and respects
permission settings.

## Evidence
- Used Grep 12 times for content search, Bash grep only twice (2026-02-01)
- Switched from Bash rg to Grep mid-session after permission prompt (2026-02-03)
- Consistent Grep usage across 5 sessions (2026-02-05)
- No Bash grep usage in last 3 sessions (2026-02-10)
```

### Required Frontmatter Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Kebab-case unique identifier |
| `trigger` | string | When-condition for activation |
| `confidence` | float | Current confidence score (0.0-0.95) |
| `domain` | string | Category tag |
| `source` | string | How the instinct was created |
| `created` | string | ISO 8601 creation timestamp |
| `last_seen` | string | ISO 8601 last reinforcement timestamp |
| `observations` | integer | Total observation count |

### Optional Frontmatter Fields

| Field | Type | Description |
|-------|------|-------------|
| `evolved` | boolean | Whether this instinct has been evolved into a skill |
| `evolved_to` | string | Skill name if evolved |
| `evolved_date` | string | ISO 8601 timestamp of evolution |
| `auto_approved` | boolean | Whether confidence reached auto-approve threshold |
| `auto_approved_date` | string | ISO 8601 timestamp of auto-approval |
| `sessions` | array | Session IDs that contributed observations (capped at 20) |
| `suggestions_shown` | integer | Times this instinct was shown as a PreToolUse suggestion |
| `usage_reinforced` | boolean | Whether skill usage feedback loop has boosted confidence |
| `usage_reinforcement_count` | integer | Number of feedback loop boosts received |
| `imported_from` | string | Source project name (for imported instincts) |
| `imported_at` | string | ISO 8601 timestamp of import |

### Body Sections

- **Action** (required) — What to do when the trigger matches
- **Evidence** (required) — Chronological list of supporting observations

### Domain Tags

Standard domain tags:
- `code-style` — Formatting, syntax, naming conventions
- `testing` — Test creation, test-first approaches
- `workflow` — Process patterns, command sequences
- `tool-preference` — Preferred tools for tasks
- `error-handling` — Error recovery patterns
- `architecture` — Structural preferences
- `documentation` — Comment and doc generation patterns
