---
name: extract-knowledge
description: Extract business knowledge from conversation and feed into the instinct learning pipeline
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - AskUserQuestion
arguments:
  - name: topic
    description: Optional topic filter to focus extraction on specific domain
    required: false
argument-hint: [topic-filter]
---

# Extract Knowledge Command

Analyze the current conversation for business knowledge, domain rules, architecture decisions, and debugging insights — then write them as observations into the instinct learning pipeline.

## Why This Exists

The md-to-skill observation hooks capture **tool use metadata** (which files you edit, what commands you run) but miss the **actual knowledge** discussed in conversation:
- Business rules ("WHT deduction applies when vendor is non-resident")
- Architecture decisions ("Use facade pattern for cross-module calls")
- Domain knowledge ("Thai tax ID must be 13 digits")
- Debugging insights ("OOM on report export caused by unbounded query")

This command closes that gap by extracting knowledge from conversation and feeding it into the same instinct pipeline that tool observations use.

## Execution Workflow

### Step 1: Analyze Conversation Context

Review the full conversation history available in your context. Focus on identifying:

**Knowledge categories to extract:**

| Category | Examples | Priority |
|----------|----------|----------|
| **Business rules** | Validation rules, calculation logic, workflow constraints | HIGH |
| **Domain terminology** | Domain-specific terms with definitions or usage context | HIGH |
| **Architecture decisions** | Pattern choices, module boundaries, data flow decisions | MEDIUM |
| **Debugging insights** | Root causes found, non-obvious failure modes, workarounds | MEDIUM |
| **Integration knowledge** | API contracts, data formats, service dependencies | MEDIUM |
| **Process knowledge** | Deployment steps, testing strategies, review criteria | LOW |

If `[topic]` argument is provided, focus extraction on that topic only.

**What to SKIP:**
- Generic programming knowledge (how to write a for loop)
- Tool usage instructions (how to use git commands)
- Session-specific context (temporary file paths, current branch name)
- Anything already captured by tool-use observation hooks

### Step 2: Extract Knowledge Nuggets

For each piece of knowledge found, extract:

1. **domain** — The business/technical domain (e.g., "thai-tax", "invoice-validation", "authentication", "nx-workspace")
2. **summary** — One-line description of the knowledge (max 100 chars)
3. **detail** — 2-5 sentences explaining the rule/decision/insight with enough context to be useful standalone
4. **category** — One of: `business-rule`, `domain-term`, `architecture-decision`, `debugging-insight`, `integration-knowledge`, `process-knowledge`
5. **confidence_hint** — How confident this is real knowledge vs conversation noise: `high` (explicitly discussed and confirmed), `medium` (discussed but not verified), `low` (mentioned in passing)

### Step 3: Present Candidates to User

Show extracted knowledge as a numbered list:

```
Extracted knowledge from this conversation:

1. [business-rule] thai-tax: "WHT deduction rate depends on vendor residency status"
   Detail: Non-resident vendors require 15% WHT deduction on service fees...
   Confidence: high

2. [architecture-decision] clean-architecture: "Facade layer handles cross-module orchestration"
   Detail: When business logic requires data from multiple bounded contexts...
   Confidence: medium

3. [domain-term] invoice: "Tax ID format: 13 digits for companies, 10 for individuals"
   Detail: Thai tax identification numbers follow different formats...
   Confidence: high

Write all 3 to learning pipeline? [Y/n/select numbers]
```

Use AskUserQuestion to let user confirm:
- "Yes, write all" (default)
- "Select specific items" (let user pick by number)
- "Skip" (don't write any)

### Step 4: Write to Observations Pipeline

For each confirmed knowledge nugget, write an observation entry to `.claude/md-to-skill-observations.jsonl`:

```json
{
  "timestamp": "<ISO timestamp>",
  "tool": "ConversationKnowledge",
  "input_summary": {
    "domain": "<domain>",
    "category": "<category>",
    "summary": "<one-line summary>"
  },
  "output_summary": {
    "success": true,
    "detail": "<2-5 sentence detail>"
  },
  "session_id": "<current session>",
  "patterns": {
    "knowledge_extraction": {
      "category": "<category>",
      "confidence_hint": "<high|medium|low>",
      "source": "conversation"
    }
  }
}
```

**Important implementation details:**
- Use `tool: "ConversationKnowledge"` to distinguish from tool-use observations
- The `input_summary.domain` field enables domain-based clustering in `/observe`
- The `output_summary.detail` carries the actual knowledge (this is the one exception to the "never capture content" rule — user explicitly chose to capture this)
- The `confidence_hint` helps `/observe` set initial instinct confidence:
  - `high` → start at 0.5 instead of default 0.3
  - `medium` → start at 0.4
  - `low` → start at 0.3

Write observations by reading the current observations file path:
```
observations_path = <cwd>/.claude/md-to-skill-observations.jsonl
```

Ensure the `.claude/` directory exists before writing. Append each observation as a single JSON line.

**JSON formatting:** Use `json.dumps(observation, ensure_ascii=False)` style — with spaces after colons and commas (e.g., `{"key": "value"}` not `{"key":"value"}`). This matches the format used by the Python hook scripts. Write via Bash with a Python one-liner or use the Write tool to append.

### Step 5: Summary

After writing, show:

```
Written N knowledge observations to learning pipeline.

Next steps:
- Run /observe to process into instincts
- Run /instinct-status to see all learned patterns
- Knowledge instincts will evolve into skills via /evolve when enough accumulate
```

## Examples

### With topic filter

```
> /extract-knowledge thai tax

Analyzing conversation for "thai tax" knowledge...

Extracted 2 knowledge items:

1. [business-rule] thai-tax: "WHT rates: 3% services, 5% rent, 10% royalties for residents"
   Confidence: high

2. [business-rule] thai-tax: "Zero-rated VAT applies to exported services with proof of delivery"
   Confidence: high

Write all 2 to learning pipeline? [Y/n/select]
```

### Without filter

```
> /extract-knowledge

Analyzing full conversation for extractable knowledge...

Extracted 4 knowledge items:

1. [architecture-decision] plugin-hooks: "Stop hooks must return exit 0 for allow, JSON for block"
   Confidence: high

2. [debugging-insight] hook-pipeline: "Prompt-based hooks unreliable, prefer command-based Python scripts"
   Confidence: high

3. [domain-term] instinct: "Learned pattern with confidence score that evolves into skill"
   Confidence: medium

4. [process-knowledge] version-sync: "Plugin versions must match in both plugin.json and marketplace.json"
   Confidence: high

Write all 4 to learning pipeline? [Y/n/select]
```

## How It Integrates

```
Current pipeline (tool use):
  PostToolUse hooks → observations.jsonl → /observe → instincts → /evolve → skills

New addition (conversation knowledge):
  /extract-knowledge → observations.jsonl → /observe → instincts → /evolve → skills
                                    ↑
                          Same pipeline, new input source
```

The `/observe` command already processes all entries in observations.jsonl regardless of tool type. Knowledge observations with `tool: "ConversationKnowledge"` will be clustered by domain just like tool-use observations, forming instincts that can eventually evolve into skills.
