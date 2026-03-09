#!/usr/bin/env node
try {
  const message = `\u{1f4cb} **ask-before-code Plugin Active**

The clarity-guardian agent helps prevent wasted development by encouraging requirement clarity.

\u{1f3af} **When to proactively trigger the clarity-guardian agent:**
- User requests feature implementation with unclear scope or requirements
- Missing essential context: target module, affected users, or success criteria
- Vague requests like "add feature X" without specifics on behavior or constraints
- User says "implement" or "build" something without clear acceptance criteria

\u2728 **How it helps:**
- Systematically gathers requirements before coding begins
- Asks clarifying questions about scope, users, modules, and success criteria
- Prevents coding in wrong direction due to assumptions
- Reduces wasted effort from misunderstood requirements

\u{1f916} **Your role:** When you detect unclear requirements, proactively suggest using the clarity-guardian agent or /clarify command to gather requirements first.

\u{1f4a1} **Remember:** The plugin is a helper, not a blocker. If the user provides clear context or explicitly wants to proceed, that's fine. The goal is to catch unclear requirements early, not to slow down clear work.
`;

  const output = {
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: message
    }
  };

  console.log(JSON.stringify(output));
} catch (e) {
  console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: "" } }));
}
