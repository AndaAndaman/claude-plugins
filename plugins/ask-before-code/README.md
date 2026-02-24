# Ask Before Code

> "Ask 3 questions now, save 3 hours later"

A Claude Code plugin that enforces requirement clarity before writing code, preventing wasted work and rework.

## Overview

**Ask Before Code** helps developers avoid the costly mistake of coding with incomplete or vague requirements. It proactively detects unclear requests and asks targeted clarification questions to ensure requirements are sufficiently clear before coding begins.

## Philosophy

The best time to clarify requirements is **before** you write the code, not after. This plugin embeds that wisdom directly into your workflow:

- ✅ **Proactive** - Catches vague requests automatically
- ✅ **Preventive** - Encourages clarity before code-writing begins
- ✅ **Practical** - Uses smart AI judgment, not rigid rules
- ✅ **Productive** - Saves hours of rework

## Features

### 🤖 Clarity Guardian Agent

Automatically detects vague requests and triggers clarification:

```
User: "Add a feature for reports"
Guardian: "I can help! Let me understand what you need:
          - What type of reports?
          - What data should they show?
          - Who will use them?"
```

**Triggers on:**
- Vague feature requests ("add", "create", "build")
- Unclear bug reports ("broken", "doesn't work", "error")
- Missing context (domain, users, requirements)

### 💬 /clarify Command

On-demand requirement clarification with optional topic:

```bash
/clarify                    # Analyze recent conversation
/clarify invoice feature    # Clarify specific topic
/clarify bug report         # Gather bug details
```

**Features:**
- Interactive Q&A using multiple choice options
- Generates actionable plan when complete
- Can be invoked manually anytime

### 📚 Request Clarification Skill

Core methodology for gathering complete requirements:

- Efficient questioning (2-3 questions max)
- Smart pattern recognition
- Proven frameworks for features, bugs, improvements

## Installation

### Option 1: Local Development

```bash
# Copy to your project
cp -r ask-before-code /path/to/your/project/.claude/

# Or use as plugin directory
claude --plugin-dir ./ask-before-code
```

### Option 2: Global Installation

```bash
# Copy to Claude plugins directory
cp -r ask-before-code ~/.claude-plugins/

# Enable in Claude Code
# The plugin will auto-load on next session
```

## Usage

### Automatic Mode (Recommended)

Just work normally! The plugin activates automatically:

1. **You get a vague task**: "Fix the invoice thing"
2. **Clarity Guardian detects vagueness**: Triggers clarification
3. **Interactive Q&A**: Answer targeted questions
4. **Requirements confirmed**: Clear acceptance criteria established
5. **Write code confidently**: With complete requirements

### Manual Mode

Use `/clarify` command when you need explicit requirement gathering:

```bash
# General clarification
/clarify

# Topic-specific
/clarify payment integration
/clarify performance issue
/clarify new dashboard feature
```

## How It Works

### 1. Detection Phase

**Clarity Guardian** monitors conversations for:
- Vague language patterns
- Missing key information
- Incomplete context
- Domain ambiguity

### 2. Clarification Phase

**Request Clarification Skill** guides gathering:
- What problem are we solving?
- Who are the users?
- What's the desired outcome?
- What are the success criteria?

Uses `AskUserQuestion` for efficient multiple-choice Q&A.

### 3. Coding Phase

Once requirements are clear:
- Write code with confidence
- No surprises or rework
- Clear success criteria
- Happy developers! 🎉

## Configuration

No configuration needed! The plugin works out of the box with sensible defaults.

**Behavior:**
- Triggers automatically on vague requests
- Uses AI judgment for clarity assessment
- Allows user override when needed
- Adapts to conversation context

## Examples

### Example 1: Vague Feature Request

```
User: "I need a report feature"

Guardian: "I can help! Quick questions:

          1. What type of report?
             A) Financial (profit/loss, balance sheet)
             B) Operational (sales, inventory)
             C) Analytics (user metrics, performance)

          2. Who will use it?
             A) Business owners
             B) Accountants
             C) Analysts

          3. Export format?
             A) PDF
             B) Excel
             C) Both"

User: [answers: B, A, B]

Guardian: "Got it! ✅

          Building: Operational sales report
          Users: Accountants
          Export: Excel

          Ready to proceed? I'll create the sales report
          component with Excel export."
```

### Example 2: Unclear Bug Report

```
User: "Login is broken"

Guardian: "Let me help debug this:

          1. What's broken exactly?
             A) Can't submit login form
             B) Login succeeds but redirects wrong
             C) Getting error message
             D) Page won't load

          2. When did it start?
             A) Just now (recent change)
             B) Been broken for a while
             C) Intermittent

          3. Environment?
             A) Production (urgent!)
             B) Staging
             C) Local development"

User: [answers: C, A, A]

Guardian: "Critical bug confirmed! ✅

          Issue: Login error message in production
          Started: Recently (likely from recent deploy)
          Severity: HIGH (blocks users)

          I'll investigate the login service immediately."
```

## Benefits

### For Developers

- 🎯 **Clarity** - Always know what you're building
- ⚡ **Speed** - Less rework, faster delivery
- 😊 **Confidence** - Write code with clear requirements
- 🧠 **Focus** - No guessing, no assumptions

### For Teams

- 📋 **Alignment** - Everyone understands requirements
- 🔄 **Consistency** - Standard clarification process
- 💰 **Efficiency** - Reduce wasted engineering time
- 📈 **Quality** - Fewer bugs from misunderstandings

### ROI

- **2 minutes** clarification
- **3 hours** rework saved
- **90x** return on time investment

## Components

- **Skill**: `request-clarification` - Core clarification methodology
- **Agent**: `clarity-guardian` - Proactive vagueness detection
- **Command**: `/clarify` - On-demand requirement gathering
- **Hook**: SessionStart - Loads clarity-guardian context at session start

## Contributing

This plugin is part of the FlowAccount development toolkit. Contributions welcome!

## License

MIT

---

**Remember**: The best code is code written with clear requirements. Ask before you code! 🚀
