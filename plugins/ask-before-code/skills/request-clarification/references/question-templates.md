# Question Templates

Ready-made question sets for common clarification scenarios. Use with AskUserQuestion tool for efficient multiple-choice gathering.

## Feature Request Template

**When**: User says "add", "create", "build", "I need" without specifics.

**Questions (pick 2-3 most relevant):**

1. Which area of the system is this for?
   - A) Authentication / User management
   - B) Data entry / Forms
   - C) Reports / Analytics
   - D) API / Integrations
   - E) Admin / Settings

2. Who will use this feature?
   - A) End users (customers)
   - B) Internal staff / operators
   - C) Administrators
   - D) External systems (API consumers)

3. What's the expected outcome?
   - A) New screen / page
   - B) New data processing / workflow
   - C) Enhancement to existing feature
   - D) Automation of manual process

4. How will we know it's done? (success criteria)
   - A) User can complete [specific action]
   - B) System processes [specific data] correctly
   - C) Performance meets [specific threshold]
   - D) Let me describe custom criteria

5. What's the priority?
   - A) CRITICAL - Blocking other work
   - B) HIGH - Needed this sprint
   - C) MEDIUM - Planned but flexible
   - D) LOW - Nice to have

## Bug Report Template

**When**: User says "broken", "doesn't work", "error", "crash" without details.

**Questions (pick 2-3 most relevant):**

1. What's broken exactly?
   - A) Page/feature won't load
   - B) Action fails with error message
   - C) Wrong data or behavior
   - D) Performance issue (slow/timeout)
   - E) Visual/layout problem

2. What environment?
   - A) Production (urgent!)
   - B) Staging / QA
   - C) Local development
   - D) Not sure

3. Can you reproduce it?
   - A) Yes, every time with these steps: [ask for steps]
   - B) Yes, but intermittently
   - C) Only saw it once
   - D) Others reported it too

4. When did it start?
   - A) After a recent deploy/change
   - B) Been like this for a while
   - C) First time noticing
   - D) After [specific event]

5. What's the impact?
   - A) All users blocked
   - B) Some users affected
   - C) Workaround exists
   - D) Minor inconvenience

## Improvement / Refactor Template

**When**: User says "optimize", "improve", "refactor", "clean up" without specifics.

**Questions (pick 2-3 most relevant):**

1. What's the current pain point?
   - A) Code is hard to understand/maintain
   - B) Performance is poor
   - C) Tests are failing/missing
   - D) Technical debt blocking new features

2. What area needs improvement?
   - A) Specific file(s) - [ask which]
   - B) Entire module/feature
   - C) Cross-cutting concern (logging, error handling, etc.)
   - D) Architecture/patterns

3. What outcome do you expect?
   - A) Faster execution
   - B) Easier to modify/extend
   - C) Better test coverage
   - D) Reduced complexity

## API / Integration Template

**When**: User asks about APIs, integrations, or external services.

**Questions (pick 2-3 most relevant):**

1. What type of integration?
   - A) REST API endpoint (new)
   - B) Consume external API
   - C) Webhook / event-driven
   - D) File import/export

2. Authentication requirements?
   - A) Public (no auth)
   - B) API key
   - C) OAuth / token-based
   - D) Same as existing auth

3. Data format?
   - A) JSON
   - B) XML
   - C) CSV / flat file
   - D) Match existing pattern

## Multi-Part Request Template

**When**: User combines multiple unrelated requests in one message.

**Questions:**

1. Which is most urgent?
   - A) [First request] (briefly described)
   - B) [Second request] (briefly described)
   - C) [Third request] (briefly described)
   - D) All equally important - need to break down

2. Are these related or independent?
   - A) Related - same feature/module
   - B) Independent - separate work items
   - C) Partially related - shared dependencies

## Tips for Using Templates

- **Never ask all questions** - Pick the 2-3 most relevant for the gap
- **Customize options** - Replace generic options with context-specific ones when you can infer from the conversation
- **Skip what's known** - If the user already mentioned the module, don't ask about it
- **Combine questions** - If two questions are closely related, merge them into one
