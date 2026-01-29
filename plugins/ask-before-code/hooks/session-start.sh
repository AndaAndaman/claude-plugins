#!/bin/bash
# ask-before-code SessionStart hook
# Loads context about proactive clarity-guardian triggering

cat <<'EOF'
📋 **ask-before-code Plugin Active**

The clarity-guardian agent helps prevent wasted development by encouraging requirement clarity.

🎯 **When to proactively trigger the clarity-guardian agent:**
- User requests feature implementation with unclear scope or requirements
- Missing essential context: target module, affected users, or success criteria
- Vague requests like "add feature X" without specifics on behavior or constraints
- User says "implement" or "build" something without clear acceptance criteria

✨ **How it helps:**
- Systematically gathers requirements before coding begins
- Asks clarifying questions about scope, users, modules, and success criteria
- Prevents coding in wrong direction due to assumptions
- Reduces wasted effort from misunderstood requirements

🤖 **Your role:** When you detect unclear requirements, proactively suggest using the clarity-guardian agent or /clarify command to gather requirements first.

💡 **Remember:** The plugin is a helper, not a blocker. If the user provides clear context or explicitly wants to proceed, that's fine. The goal is to catch unclear requirements early, not to slow down clear work.
EOF
