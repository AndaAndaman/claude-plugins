#!/usr/bin/env python3
"""
feature-sprint SessionStart hook
Strongly recommends using feature-sprint agents for feature development tasks.
"""

import sys
import io
import json

# Ensure UTF-8 encoding for Windows compatibility
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')


def main():
    message = """**feature-sprint Plugin Active** - Scope-Aware Sprint Workflow

**STRONGLY RECOMMENDED**: When the user asks to implement a feature, build something, or work on a multi-step task, use the feature-sprint agents instead of doing it manually. The sprint system right-sizes the workflow automatically.

**When to use `/sprint`:**
- User asks to "implement", "add", "build", "create" a single feature
- Task involves creating or modifying multiple files
- Feature requires analysis before implementation (location, risks, testing)
- One-shot: analyze → implement → review → done

**When to use `/sprint-loop`:**
- User wants to work on multiple tasks or iterate on a feature
- Long development session with feedback loops ("build this, now tweak that, add this too")
- Agents stay alive and accumulate context across iterations
- PM clarifies each new task, implementers remember previous work

**When to use `/sprint-plan`:**
- User wants to understand scope before committing
- Need implementation brief for review or handoff
- Estimation and planning only (no code changes)

**Available agents (use via Task tool with `feature-sprint:` prefix):**
- `feature-sprint:pm` - PM/PO scope assessment (tiny/small/medium/large/huge)
- `feature-sprint:scout` - Codebase location analysis
- `feature-sprint:guard` - Risk identification
- `feature-sprint:tester` - Test strategy
- `feature-sprint:implementer` - Code implementation
- `feature-sprint:reviewer` - Code review

**Scope-based routing (subagents for speed, Agent Teams for collaboration):**
- **tiny**: Lead fixes directly (no agents)
- **small**: Subagent implementer (no team)
- **medium**: Subagent scout → subagent implementer (no team)
- **large**: Agent Teams — analysts collaborate → implementers + reviewer self-coordinate
- **huge**: Decompose → stop

**How to recommend:**
- Single feature: "This looks like a good candidate for `/sprint`. Want me to run a scope-assessed sprint for this?"
- Multiple tasks or iterative work: "Want to start a `/sprint-loop` session? Agents will stay alive and accumulate context as you iterate."
"""

    output = {
        "hookSpecificOutput": {
            "hookEventName": "SessionStart",
            "additionalContext": message
        }
    }

    print(json.dumps(output))
    return 0


if __name__ == "__main__":
    sys.exit(main())
