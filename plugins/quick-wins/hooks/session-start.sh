#!/bin/bash
# quick-wins SessionStart hook
# Loads context about running quick-wins scan when work is complete

cat <<'EOF'
🎯 **quick-wins Plugin Active**

The quick-wins plugin helps maintain code quality through easy, high-impact improvements (1-5 minute fixes).

⏰ **When to suggest quick-wins scan:**
- After completing feature implementation or bug fixes
- When you've made significant code changes (Write/Edit tools used)
- Before user commits or considers work "done"
- When user asks "what's next?" or "anything else?"

🔍 **What quick-wins identifies:**
- Type safety improvements (missing types, any usage)
- Modern syntax opportunities (arrow functions, async/await, optional chaining)
- Code organization issues (long functions, duplicated logic)
- Error handling gaps (missing try-catch, unhandled promises)
- Angular-specific improvements (OnPush change detection, lifecycle optimizations)
- .NET improvements (async patterns, LINQ usage, resource management)

📝 **How to use:**
1. When you complete tasks and user's request is fulfilled, suggest: "Would you like me to run a quick-wins scan to identify any easy improvements?"
2. Run `/quick-wins` command on modified files/directories
3. Present findings as actionable suggestions with effort estimates
4. User decides which improvements to apply via `/apply-win`

💡 **Remember:**
- Only suggest when work is naturally complete (not mid-task)
- Be helpful, not pushy - one gentle suggestion is enough
- The Stop hook will also evaluate if a scan is appropriate
- Quick wins are optional improvements, not mandatory fixes

🛠️ **Technology support:**
- TypeScript/JavaScript (modern syntax, async patterns, type safety)
- Angular (components, services, RxJS, change detection)
- .NET/C# (async/await, LINQ, modern C# features)
EOF
