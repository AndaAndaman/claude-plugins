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
- User asks to "implement", "add", "build", "create" a feature
- Task involves creating or modifying multiple files
- Feature requires analysis before implementation (location, risks, testing)
- User wants structured development with quality checks

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

**Scope-based routing:**
- **tiny**: Direct fix by lead (no agents needed)
- **small**: 1 implementer (PM/PO already identified files)
- **medium**: Scout → brief → 1 implementer
- **large**: Scout+Guard+Tester → brief → 2-3 implementers → reviewer
- **huge**: Suggest decomposition, stop

**How to recommend:** When a user describes a feature to implement, suggest: "This looks like a good candidate for `/sprint`. Want me to run a scope-assessed sprint for this?"
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
