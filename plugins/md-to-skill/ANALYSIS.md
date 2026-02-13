# md-to-skill Plugin Analysis Report

**Date:** 2026-02-13
**Version Analyzed:** v0.6.0
**Analyzed by:** 3-agent team (architect, code-reviewer, feature-scout)

---

## Implementation Progress

**v0.7.0 Sprint (2026-02-13) — COMPLETED**

| ID | Enhancement | Status | Notes |
|----|-------------|--------|-------|
| H1 | Shared utilities (hook_utils.py) | DONE | Created `hooks/hook_utils.py` with 7 shared functions. All 6 hooks refactored. |
| H2 | Python pattern detection engine | DESCOPED | Moved to v0.8.0 roadmap. |
| H3 | Consolidate 3 Skill hooks into 1 | DONE | Created `hooks/skill_posttooluse.py` dispatcher. Old files kept for rollback. |
| H4 | Add Read to observer | DONE | Read added to PostToolUse + PreToolUse matchers. 20% sampling rate. |
| M1 | Observation count cache | DONE | Cache with file_size/mtime validation in Stop hook. |
| M2 | Session cache TTL | DONE | Hybrid: session_id change + 4-hour TTL. |
| M3 | /instinct-reject command | DONE | New command + rejection registry + PreToolUse filter. |
| M4 | match_patterns field | DONE | Glob/prefix matching with trigger fallback for backward compat. |
| M5 | Per-tool sampling | DONE | Correction/error exemptions. Read=0.2, Write/Edit/Bash=1.0. |

**Remaining from Quick Wins (not yet addressed):**
- QW-2: Inconsistent fallback defaults — partially fixed (md-watch_stop.py aligned to 500)
- QW-4: Debug logging in all hooks — not yet done
- QW-7: Concurrent write race condition — acknowledged, low risk
- QW-12: Bridge hooks check observer.enabled — DONE (in consolidated dispatcher)

**Next milestone: v0.8.0 "Smarter Evolution"** — H2 pattern engine, multi-file workflow chains, cross-domain clustering, skill auto-update.

---

## Table of Contents

1. [Quick Wins & Code Quality](#1-quick-wins--code-quality)
2. [Architecture Strengths](#2-architecture-strengths)
3. [Architecture Weaknesses](#3-architecture-weaknesses)
4. [Enhancement Opportunities](#4-enhancement-opportunities)
5. [New Feature Proposals](#5-new-feature-proposals)
6. [Proposed Roadmap](#6-proposed-roadmap)
7. [Implementation Notes](#7-implementation-notes)

---

## 1. Quick Wins & Code Quality

15 findings total. 0 High, 5 Medium, 10 Low severity.

### Top Priority Quick Wins

#### QW-1: Extract Shared Utilities (Medium)
**Files affected:**
- `hooks/observe_posttooluse.py:83-92` — `is_secret_file()`
- `hooks/skill-usage_posttooluse.py:32-41` — `is_secret_file()` (duplicate)
- `hooks/observe_posttooluse.py:38-40` — `get_observations_path()`
- `hooks/quickwins-bridge_posttooluse.py:29-31` — `get_observations_path()` (duplicate)
- `hooks/clarification-bridge_posttooluse.py:33-35` — `get_observations_path()` (duplicate)
- `hooks/skill-usage_posttooluse.py:108-134` — `parse_frontmatter()`
- `hooks/instinct-suggest_pretooluse.py:33-70` — `parse_frontmatter()` (duplicate)
- `hooks/md-watch_stop.py:352-356` — inline regex frontmatter parsing (duplicate)

**Fix:** Create `hooks/shared.py` with:
- `is_secret_file(file_path, secret_patterns) -> bool`
- `get_observations_path(cwd) -> str`
- `get_session_cache_path(cwd) -> str`
- `parse_frontmatter(content) -> dict`
- `update_frontmatter_field(content, key, value) -> str`

Reduces ~80 lines of duplication. Single place to fix bugs.

#### QW-2: Fix Inconsistent Default Values (Medium)
**Files affected:**
- `config/defaults.json:44` — `observeSuggestionThreshold: 500`
- `config/config_loader.py` `_fallback_defaults()` — `observeSuggestionThreshold: 50`
- `hooks/md-watch_stop.py:388` — hardcoded fallback `200`
- `hooks/md-watch_stop.py:424` — hardcoded fallback `50`

**Fix:** Align ALL fallback values with `defaults.json`. Search for every hardcoded threshold in hooks and replace with config-loaded values. Ensure `_fallback_defaults()` mirrors `defaults.json` exactly.

#### QW-3: Optimize Stop Hook Performance (Medium)
**File:** `hooks/md-watch_stop.py`

**Issue A — Full file read on every stop (lines 300-334):**
`count_observations_since_last_analysis()` reads the entire `observations.jsonl` line by line, parsing each JSON entry to compare timestamps. With 10MB file = thousands of entries.

**Fix:** Store `total_line_count` in `md-to-skill-observe-state.json` after `/observe` runs. Stop hook can do a fast line count (or file size heuristic) and compare against stored value. No JSON parsing needed.

**Issue B — `count_auto_approved_instincts` called up to 3x (lines 428, 491, 511):**
Each call opens and reads every `.md` file in the instincts directory.

**Fix:** Call once at the top of `main()`, store result in local variable, reuse.

#### QW-4: Add Debug Logging to All Hooks (Low)
**Files:** `observe_posttooluse.py`, `skill-usage_posttooluse.py`, `instinct-suggest_pretooluse.py`, bridge hooks

**Issue:** Only `md-watch_stop.py` has debug logging. Other hooks have `except Exception: pass` making debugging extremely difficult.

**Fix:** Add the same `debug_log()` pattern from `md-watch_stop.py` to all hooks. Controlled by config `debug` flag.

#### QW-5: Remove Useless Global Cache (Low)
**File:** `hooks/instinct-suggest_pretooluse.py:29`

**Issue:** `_instincts_cache = None` global is set once per process invocation. Since each hook is a separate Python process, the cache is always None at start, set once, then process exits.

**Fix:** Remove the global cache variable and `global` declaration. Call load function directly.

### Other Findings (Lower Priority)

| # | Issue | File | Severity |
|---|-------|------|----------|
| QW-6 | Config loaded on every hook invocation (no caching) | All 6 hooks | Low |
| QW-7 | Race condition: concurrent writes to observations.jsonl | observe + bridge hooks | Low |
| QW-8 | `rotate_if_needed` TOCTOU race | observe_posttooluse.py:95-108 | Low |
| QW-9 | `detect_case_style` no guard for empty string | observe_posttooluse.py:111 | Low |
| QW-10 | Missing output on non-block exit paths in Stop hook | md-watch_stop.py | Low |
| QW-11 | `update_frontmatter_field` potential `.format()` issue with curly braces | skill-usage_posttooluse.py:156 | Low |
| QW-12 | Bridge hooks don't check if observer is globally enabled | quickwins-bridge, clarification-bridge | Low |
| QW-13 | Session cache has no TTL — stale entries cause false corrections | observe_posttooluse.py | Low |
| QW-14 | Bare `except Exception` swallowing all errors silently | All hooks | Low |
| QW-15 | 3 PostToolUse:Skill hooks spawn 3 Python processes | hooks.json | Low |

---

## 2. Architecture Strengths

1. **Well-Designed Learning Pipeline** — Clean separation: hooks -> observations.jsonl -> /observe -> instincts -> /evolve -> skills. Each stage has clear inputs/outputs.

2. **Robust Config System** — Centralized defaults + per-project overrides via YAML frontmatter. Deep merge with nested path mapping. Graceful fallback if config corrupted.

3. **Privacy-First Design** — Never captures content. Secret file exclusion, command preview truncation (200 chars), excluded path patterns enforced at hook level.

4. **Defensive Hook Design** — All 6 hooks: never block on errors, always exit 0, wrap everything in try/except. Production-grade resilience.

5. **Idempotent Processing** — `/observe` state tracking prevents duplicate instinct creation. `--replay` flag for full reprocessing when needed.

6. **Rich Command Surface** — 13 commands covering full lifecycle: observe, instinct-status, evolve, prune, merge, export, import, export-context, observe-health, skill-health, convert-to-skill, learn-skill.

7. **Cross-Plugin Bridges** — Lightweight, well-isolated bridge hooks with feature flags. Non-invasive integration pattern.

---

## 3. Architecture Weaknesses

### AW-1: LLM-Dependent Pattern Detection (HIGH)
`/observe` relies entirely on Claude to analyze JSONL observations and create instincts. No deterministic Python engine.

**Impact:**
- Pattern detection quality varies by model
- No consistency guarantee between runs
- CPU-efficient pattern matching done in natural language instead of code
- `--replay` diff relies on LLM remembering previous state

**Recommendation:** Create `hooks/utils/pattern_engine.py` with deterministic pattern detection. Use LLM only for naming/description of detected patterns.

### AW-2: Three Separate PostToolUse:Skill Hooks (MEDIUM)
`hooks.json` registers 3 PostToolUse hooks matching `Skill`:
- `skill-usage_posttooluse.py`
- `quickwins-bridge_posttooluse.py`
- `clarification-bridge_posttooluse.py`

Each launches a separate Python process. On Windows, each process spawn costs ~100-200ms.

**Recommendation:** Consolidate into single `skill_posttooluse.py` with dispatcher pattern.

### AW-3: Missing Read Tool Observation (MEDIUM)
Observer hook only captures Write|Edit|Bash. Cannot detect:
- "read-edit-test" workflow sequences (only sees "edit-test")
- File exploration patterns
- Read vs Bash(cat) tool preference

**Recommendation:** Add Read to PostToolUse matcher. Extend `extract_input_summary()`.

### AW-4: No Negative Feedback Mechanism (MEDIUM)
Confidence only increases (observation) or passively decays (time). No way to explicitly reject a bad instinct. Correction detection in observer captures Write->Edit patterns but doesn't connect back to specific instinct suggestions.

**Recommendation:** Add `/instinct-reject <id>` command. Set `rejected: true`, `confidence: 0.0`. PreToolUse hook skips rejected instincts.

### AW-5: Instinct Suggestion Matching Is Fragile (MEDIUM)
`instinct-suggest_pretooluse.py` uses regex-based keyword extraction from trigger text. Hardcoded patterns, hardcoded `type_mappings` dict, simple `keyword in trigger` matching.

A trigger like "when refactoring service files" won't match an Edit to `user.service.ts` because "refactoring" isn't in the keyword list.

**Recommendation:** Add `match_patterns` field to instinct frontmatter with explicit file extensions, path globs, command prefixes. PreToolUse checks `match_patterns` first, falls back to text analysis.

### AW-6: Session Cache Has No TTL (LOW)
`md-to-skill-session-cache.json` entries trimmed by count (20 max) but not by time. Stale cache from yesterday causes false "correction" detections.

**Recommendation:** Add `session_start` timestamp. Skip entries older than current session or configurable TTL (2 hours).

### AW-7: Config Loader Doesn't Support String Overrides (LOW)
`_parse_local_md_frontmatter()` only handles booleans, floats, integers, and one list pattern. String-valued overrides silently dropped.

**Recommendation:** Extend parser to handle quoted string values.

---

## 4. Enhancement Opportunities

### HIGH Priority

| ID | Enhancement | Impact | Effort |
|----|-------------|--------|--------|
| H1 | Create shared frontmatter utility module (`hooks/shared.py`) | Maintainability | Low |
| H2 | Python-based pattern detection engine for `/observe` | Consistency, Speed | Medium |
| H3 | Consolidate 3 PostToolUse:Skill hooks into 1 dispatcher | Performance | Low-Med |
| H4 | Add Read tool to observer hook | Data completeness | Low |

### MEDIUM Priority

| ID | Enhancement | Impact | Effort |
|----|-------------|--------|--------|
| M1 | Observation count cache in observe-state.json | Performance | Low |
| M2 | Session cache TTL | Accuracy | Low |
| M3 | Instinct rejection mechanism (`/instinct-reject`) | User control | Low |
| M4 | Explicit `match_patterns` field for instinct suggestions | Suggestion quality | Medium |
| M5 | Observation sampling for large files | Scalability | Low |

### LOW Priority

| ID | Enhancement | Impact | Effort |
|----|-------------|--------|--------|
| L1 | Config string override support | Flexibility | Low |
| L2 | Instinct dependency tracking (`implies`, `conflicts_with`) | Evolution quality | Medium |
| L3 | Hook performance metrics | Observability | Low |
| L4 | Automatic `/observe` on SessionStart when threshold hit | Automation | Medium |

---

## 5. New Feature Proposals

### Category 1: Smarter Pattern Detection

#### F1.1 Read Pattern Observer (Score: 9/10)
**What:** Add Read to PostToolUse hook matcher. Capture file_path for Read tool uses.
**Why:** Read patterns are the missing half of the workflow picture. Without them, sequence analysis is blind to the "research" phase.
**Impact:** High | **Effort:** Small

#### F1.2 Glob Pattern Observer (Score: 7/10)
**What:** Add Glob to PostToolUse hook. Capture glob pattern string and path.
**Why:** Reveals navigation habits (e.g., always searching `**/*.test.ts` before running tests).
**Impact:** Medium | **Effort:** Small

#### F1.3 Multi-File Workflow Chains (Score: 8/10)
**What:** Extend session cache with sliding window buffer of 2-5 operations. Detect repeated chains across sessions. Store chain hashes in observations.
**Why:** Workflow instincts are currently the weakest type because observer only hashes individual operations, not chains.
**Impact:** High | **Effort:** Medium

#### F1.4 Import Pattern Tracking (Score: 5/10)
**What:** When Write/Edit modifies import statements, capture module path pattern (truncated, no content).
**Why:** Reveals import conventions. But conflicts with privacy-first design.
**Impact:** Medium | **Effort:** Medium | **Note:** Privacy concern lowers priority.

#### F1.5 Time-of-Day Pattern Detection (Score: 3/10)
**What:** Optional time-of-day bucketing in observations.
**Why:** Interesting metadata but rarely actionable.
**Impact:** Low | **Effort:** Small

### Category 2: Instinct Intelligence

#### F2.1 Instinct Auto-Apply Mode (Score: 7/10)
**What:** Add `auto_apply: true` frontmatter field. For specific instinct types (naming conventions, file co-creation), automatically validate/warn instead of just suggesting.
**Why:** Transforms instincts from passive to active assistants.
**Impact:** High | **Effort:** Large

#### F2.2 Instinct Tags/Categories (Score: 7/10)
**What:** Add `tags: [typescript, angular, testing]` array field beyond just `domain`. Enable `--tag` filter in commands.
**Why:** Better organization for multi-stack users.
**Impact:** Medium | **Effort:** Small

#### F2.3 Instinct Dependencies (Score: 5/10)
**What:** `implies: [other-id]` and `conflicts_with: [other-id]` relationships. Reinforcing A also reinforces implied B.
**Why:** Makes instinct graph more connected. Adds complexity.
**Impact:** Medium | **Effort:** Medium

#### F2.4 Confidence Velocity Indicator (Score: 6/10)
**What:** Track how fast confidence is changing. Show "accelerating", "stable", "decelerating" in `/instinct-status`.
**Why:** Better visibility into instinct health without waiting for decay.
**Impact:** Medium | **Effort:** Small

### Category 3: Evolution Improvements

#### F3.1 Cross-Domain Clustering (Score: 8/10)
**What:** Second pass in `/evolve` that detects keyword overlap across domain boundaries. Higher overlap threshold (50%) to avoid noise.
**Why:** Some instincts span domains (e.g., "testing" + "naming" = "testing practices" skill).
**Impact:** High | **Effort:** Medium

#### F3.2 Skill Auto-Update on Instinct Change (Score: 8/10)
**What:** Track `evolved_from_instincts: [ids]` in evolved skills. Add `/skill-refresh` command that regenerates skill from updated instincts.
**Why:** Currently evolved skills are static snapshots. Instincts keep growing but skill doesn't benefit.
**Impact:** High | **Effort:** Medium

#### F3.3 Skill Versioning/Changelog (Score: 5/10)
**What:** `version: 1`, `changelog: []` in SKILL.md frontmatter. Increment on regeneration.
**Why:** Understand skill evolution over time. Depends on F3.2.
**Impact:** Medium | **Effort:** Small (given F3.2)

#### F3.4 Weighted Evolution Clustering (Score: 6/10)
**What:** Weight instincts by suggestion acceptance rate in addition to confidence and session diversity.
**Why:** Better signal quality for evolution decisions.
**Impact:** Medium | **Effort:** Small

### Category 4: UX Improvements

#### F4.1 `/instinct-dashboard` Command (Score: 9/10)
**What:** Single command showing: total instincts by category, top 3 strongest, clusters approaching evolution readiness, pipeline health, next recommended action.
**Why:** Currently requires 3 separate commands (`/instinct-status`, `/observe-health`, `/skill-health`).
**Impact:** High | **Effort:** Small

#### F4.2 Guided Onboarding `/learning-setup` (Score: 7/10)
**What:** Walk-through command: explain pipeline, configure thresholds, run first `/observe`, explain next steps. Auto-detect first-run state.
**Why:** Reduces learning curve for the learning system itself.
**Impact:** Medium | **Effort:** Small

#### F4.3 `/observe --interactive` Mode (Score: 6/10)
**What:** For each pattern: accept, reject, edit trigger, change domain, adjust initial confidence. More granular than current accept/skip binary.
**Why:** More user control without --auto all-or-nothing.
**Impact:** Medium | **Effort:** Small

#### F4.4 Instinct Strength Visualization (Score: 4/10)
**What:** ASCII bar charts in `/instinct-status`. Example: `code-style: ████████░░ 0.8`.
**Why:** Cosmetic but makes reports more scannable.
**Impact:** Low | **Effort:** Small

### Category 5: Cross-Project Learning

#### F5.1 Team Instinct Repository (Score: 7/10)
**What:** `.claude-team/instincts/` convention for shared team instincts. `/instinct-share` command promotes personal to team-level (`source: "team-shared"`). Auto-load as inherited.
**Why:** Currently sharing requires manual export/import.
**Impact:** High | **Effort:** Medium

#### F5.2 Instinct Sync Across Projects (Score: 5/10)
**What:** `/instinct-sync` command comparing instincts between projects. Propagate strong ones (confidence >= 0.6) with diff preview and conflict handling.
**Why:** Useful for developers on multiple related repos.
**Impact:** Medium | **Effort:** Medium

#### F5.3 Instinct Marketplace (Score: 4/10)
**What:** Publish instinct sets to plugin marketplace. Browse community packs ("Angular Best Practices", "Python Testing Patterns").
**Why:** Community learning ecosystem. Very high effort.
**Impact:** High (long-term) | **Effort:** Large

### Category 6: Integration Opportunities

#### F6.1 CLAUDE.md Context Injection (Score: 9/10)
**What:** Auto-inject `learned-patterns.md` into CLAUDE.md via local-memory bridge. Currently `learned-patterns.md` exists but is never consumed automatically.
**Why:** Closes loop between learning and context. Auto-approved instincts influence every session through CLAUDE.md.
**Impact:** High | **Effort:** Small

#### F6.2 Git Commit-Time Learning (Score: 6/10)
**What:** Detect `git commit` in Bash command preview. Extract file list from `git diff --cached --name-only`. Write as workflow observation.
**Why:** Git workflow patterns are rich signals not currently captured.
**Impact:** Medium | **Effort:** Small

#### F6.3 Quick-Wins Feedback Loop (Score: 6/10)
**What:** When quick-wins improvement is accepted, reinforce the matching instinct. Extend bridge hook to write reinforcement observation.
**Why:** Strengthens cross-plugin learning. Currently one-directional.
**Impact:** Medium | **Effort:** Small

#### F6.4 SessionStart Instinct Summary (Score: 7/10)
**What:** SessionStart hook showing brief summary: "3 active instincts: prefer-grep (0.8), kebab-case-naming (0.75), test-after-edit (0.72)".
**Why:** Keeps users aware without requiring `/instinct-status`.
**Impact:** Medium | **Effort:** Small

---

## 6. Proposed Roadmap

### v0.7.0 — "Better Observation"
Focus: Fill data gaps and connect learning to context.

| Item | Type | Effort |
|------|------|--------|
| QW-1: Extract shared utilities (`hooks/shared.py`) | Quick Win | Low |
| QW-2: Fix inconsistent default values | Quick Win | Low |
| QW-3: Optimize Stop hook performance | Quick Win | Low |
| H4 / F1.1: Add Read pattern observer | Enhancement | Low |
| F1.2: Add Glob pattern observer | Feature | Low |
| F6.1: CLAUDE.md context injection | Feature | Low |
| QW-5: Remove useless global cache | Quick Win | Low |
| QW-12: Bridge hooks check observer.enabled | Quick Win | Low |

### v0.8.0 — "Smarter Evolution"
Focus: Better pattern detection and skill lifecycle.

| Item | Type | Effort |
|------|------|--------|
| H2: Python-based pattern detection engine | Enhancement | Medium |
| H3: Consolidate PostToolUse:Skill hooks | Enhancement | Low-Med |
| F1.3: Multi-file workflow chains | Feature | Medium |
| F3.1: Cross-domain clustering | Feature | Medium |
| F3.2: Skill auto-update on instinct change | Feature | Medium |
| M4: Explicit `match_patterns` for instincts | Enhancement | Medium |

### v0.9.0 — "Better UX"
Focus: User experience and discoverability.

| Item | Type | Effort |
|------|------|--------|
| F4.1: `/instinct-dashboard` command | Feature | Small |
| F4.2: Guided onboarding `/learning-setup` | Feature | Small |
| F6.4: SessionStart instinct summary | Feature | Small |
| F2.2: Instinct tags/categories | Feature | Small |
| M3: `/instinct-reject` command | Enhancement | Low |
| F4.3: `/observe --interactive` mode | Feature | Small |
| QW-4: Add debug logging to all hooks | Quick Win | Low |

### v1.0.0 — "Team Learning"
Focus: Cross-project and team collaboration.

| Item | Type | Effort |
|------|------|--------|
| F5.1: Team instinct repository | Feature | Medium |
| F2.1: Instinct auto-apply mode | Feature | Large |
| F3.3: Skill versioning/changelog | Feature | Small |
| F5.2: Instinct sync across projects | Feature | Medium |

---

## 7. Implementation Notes

### Cross-Cutting Themes (All 3 Agents Agree)

1. **Shared utilities are the #1 quick win** — Frontmatter parsing duplicated 3x, path helpers duplicated 3x. Create `hooks/shared.py` first.

2. **Read observation is the top gap** — Both architect and feature-scout ranked it #1. Low effort, high impact. Changes: `hooks.json` matcher + `extract_input_summary()` extension.

3. **Stop hook performance needs work** — Full-file JSONL scan + repeated instinct directory scans on every stop event. Cache counts.

4. **Instinct lifecycle needs negative feedback** — Currently only passive decay. Add explicit rejection mechanism.

5. **CLAUDE.md injection closes the loop** — `learned-patterns.md` already exists but isn't consumed. Connecting it to local-memory's CLAUDE.md generation makes learning automatic.

### File Change Map for v0.7.0

```
NEW:    hooks/shared.py                    — Shared utilities
EDIT:   hooks/observe_posttooluse.py       — Import shared, add Read handling
EDIT:   hooks/skill-usage_posttooluse.py   — Import shared
EDIT:   hooks/instinct-suggest_pretooluse.py — Import shared
EDIT:   hooks/quickwins-bridge_posttooluse.py — Import shared, check observer.enabled
EDIT:   hooks/clarification-bridge_posttooluse.py — Import shared, check observer.enabled
EDIT:   hooks/md-watch_stop.py             — Cache counts, optimize observation counting
EDIT:   hooks/hooks.json                   — Add Read|Glob to PostToolUse matcher
EDIT:   config/defaults.json               — Version bump to 0.7.0
EDIT:   config/config_loader.py            — Align _fallback_defaults() with defaults.json
EDIT:   .claude-plugin/plugin.json         — Version bump
```

### Key Design Decisions to Make Before Implementation

1. **Read observer granularity** — Capture every Read, or only Reads that precede edits within a time window? Every Read could be very noisy.

2. **Pattern engine scope** — Should `pattern_engine.py` replace LLM analysis entirely in `/observe`, or augment it? Recommended: engine handles mechanical analysis (frequency counting, hash matching), LLM handles naming and description.

3. **CLAUDE.md injection mechanism** — Should md-to-skill write directly to CLAUDE.md, or export data for local-memory to consume? Recommended: local-memory consumes `learned-patterns.md` during context generation (respects local-memory's smart merge).

4. **Instinct rejection UX** — New command `/instinct-reject`, or add `--reject` flag to `/instinct-status`? Both approaches valid.
