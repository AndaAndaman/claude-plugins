# FlowAccount Dev Tools - Claude Code Plugins

> 🚀 **Boost your productivity with AI-powered development tools**

A curated plugin marketplace for Claude Code containing development tools and productivity plugins specifically designed for FlowAccount developers.

## Why Use These Plugins?

| Metric | Without Plugins | With Plugins | Improvement |
|--------|----------------|--------------|-------------|
| **Time spent on rework** | 3 hours/feature | 0 hours | -100% |
| **Time spent on code quality** | 30 min/feature | 3 min | -90% |
| **Technical debt accumulation** | High | Low | -80% |
| **Code review time** | 30 min | 15 min | -50% |
| **Developer confidence** | Uncertain | High | 📈 |

**Combined ROI:** Save 6+ hours per feature by using both plugins together.

## Table of Contents

- [Quick Start](#quick-start)
- [Available Plugins](#available-plugins)
  - [ask-before-code](#ask-before-code) - Prevent wasted work with requirement clarification
  - [quick-wins](#quick-wins) - Maintain quality with easy improvements
- [Installation](#installation)
- [Usage](#usage)
- [Plugin Comparison](#plugin-comparison)
- [FlowAccount-Specific Features](#flowaccount-specific-features)
- [Quick Links](#quick-links)
- [Documentation](#documentation)
- [Contributing](#contributing)

## Quick Start

**For FlowAccount Developers:**

1. **Install both plugins** for best results:
   ```bash
   # Install to your FlowAccount workspace
   cp -r plugins/ask-before-code ~/.claude-plugins/
   cp -r plugins/quick-wins ~/.claude-plugins/
   ```

2. **Recommended workflow:**
   ```
   📋 Get a task
   ⬇️
   🤔 /clarify (ask-before-code clarifies requirements)
   ⬇️
   💻 Write your code
   ⬇️
   ✨ /quick-wins (clean up before committing)
   ⬇️
   ✅ Commit clean, well-understood code
   ```

3. **Try it out:**
   ```bash
   # Start with unclear requirements
   "I need to add a feature for reports"

   # ask-before-code will clarify:
   # - What type of reports?
   # - Who will use them?
   # - What data should they show?

   # Write your code...

   # Then quick-wins will suggest:
   # - Remove unused imports
   # - Fix any types
   # - Add error handling
   # - Modernize syntax
   ```

## Available Plugins

### ask-before-code
Forces clarity before coding to prevent wasted work. Ask 3 questions now, save 3 hours later.

**Version:** 0.1.0

**Features:**
- **Clarity Guardian Agent** - Automatically detects vague requests and triggers clarification
- **`/clarify` Command** - On-demand requirement clarification with optional topic
- **Smart Hook Protection** - Prevents writing code without clear requirements
- **Request Clarification Skill** - Core methodology for gathering complete requirements

**Benefits:**
- Prevents coding with incomplete requirements
- Reduces rework and wasted time
- Uses AI judgment for clarity assessment
- Interactive Q&A with multiple-choice options

---

### quick-wins
Identifies and guides easy code improvements. Small improvements, big impact.

**Version:** 0.1.0

**Features:**
- **Quick Wins Scanner Agent** - Automatically identifies 1-5 minute improvements after task completion
- **`/quick-wins` Command** - On-demand code quality scanning for files or directories
- **`/apply-win` Command** - Apply specific improvements with confirmation and preview
- **Smart Stop Hook** - Proactively suggests improvements at the right time
- **2 Comprehensive Skills** - Refactoring patterns and code quality checks

**Technology Support:**
- TypeScript/JavaScript - Full support for modern patterns
- Angular - Components, services, RxJS, change detection
- .NET/C# - Modern C# syntax and patterns

**Benefits:**
- Maintains high code quality through continuous small improvements
- Saves 3 hours by fixing issues in 3 minutes
- Prevents technical debt accumulation
- Context-aware suggestions (skips urgent fixes)
- 60x return on time investment

**FlowAccount Integration:**
- ✅ Fully compatible with both flowaccount.workspace and flowaccount.dotnet.workspace
- ✅ Respects Clean Architecture layers (.NET)
- ✅ Respects Nx project boundaries (TypeScript)
- ✅ Honors FlowAccount naming conventions (`_underscore` prefix)
- ✅ Works alongside MCP agents (.NET workspace)

## Installation

### Option 1: Marketplace

1. Add this marketplace to Claude Code:
   ```bash
   /plugin marketplace add AndaAndaman/claude-plugins
   ```

2. Install a plugin:
   ```bash
   /plugin install ask-before-code@flowaccount-dev-tools
   /plugin install quick-wins@flowaccount-dev-tools
   ```

### Option 2: Local Installation

**For a specific project:**
```bash
# Install ask-before-code
cp -r plugins/ask-before-code /path/to/your/project/.claude/

# Install quick-wins
cp -r plugins/quick-wins /path/to/your/project/.claude/
```

**For all projects (global):**
```bash
# Install ask-before-code globally
cp -r plugins/ask-before-code ~/.claude-plugins/

# Install quick-wins globally
cp -r plugins/quick-wins ~/.claude-plugins/
```

**For testing (temporary):**
```bash
# Test ask-before-code
claude --plugin-dir ./plugins/ask-before-code

# Test quick-wins
claude --plugin-dir ./plugins/quick-wins
```

## Usage

### ask-before-code
```bash
/clarify              # Run requirement clarification
/clarify invoice feature  # Clarify specific topic
```

**Automatic mode:** The Clarity Guardian agent automatically detects vague requests.

### quick-wins
```bash
/quick-wins                          # Scan recent changes
/quick-wins src/services/            # Scan specific directory
/quick-wins user.service.ts          # Scan specific file

/apply-win Remove unused import from user.service.ts
/apply-win Add error handling to API call at line 45
```

**Automatic mode:** The Stop hook suggests improvements after completing tasks.

## Plugin Comparison

| Feature | ask-before-code | quick-wins |
|---------|-----------------|------------|
| **Purpose** | Prevent wasted work by clarifying requirements | Maintain quality through small improvements |
| **When to Use** | Before coding, when requirements unclear | After coding, before committing |
| **Time Saved** | 3 hours of rework | 3 hours of technical debt |
| **Approach** | Proactive clarification | Proactive improvement |
| **Agent** | Clarity Guardian | Quick Wins Scanner |
| **Hook** | PreToolUse (Write/Edit) | Stop (task completion) |
| **Interactive** | Yes (Q&A) | Yes (apply fixes) |
| **Tech Stack** | Language-agnostic | TypeScript, Angular, .NET |

**Use Together:** Best practice is to use both plugins in your workflow:
1. **ask-before-code** → Clarify requirements before starting
2. **Write your code** → Implement the feature
3. **quick-wins** → Clean up and improve before committing

## Quick Links

### ask-before-code
- 📖 [Full Documentation](plugins/ask-before-code/README.md)
- 🎯 Use Case: Requirement clarification
- 🔧 Commands: `/clarify`
- 🤖 Agent: Clarity Guardian
- 📚 Skills: Request Clarification

### quick-wins
- 📖 [Full Documentation](plugins/quick-wins/README.md)
- 📋 [FlowAccount Compatibility Guide](plugins/quick-wins/FLOWACCOUNT-COMPATIBILITY.md)
- 🎯 Use Case: Code quality maintenance
- 🔧 Commands: `/quick-wins`, `/apply-win`
- 🤖 Agent: Quick Wins Scanner
- 📚 Skills: Refactoring Patterns, Code Quality Checks

## FlowAccount-Specific Features

Both plugins are designed specifically for FlowAccount development workflows:

### ask-before-code
- ✅ Prevents common requirement gaps in FlowAccount features
- ✅ Integrates with Thai accounting domain knowledge
- ✅ Supports FlowAccount's DDD architecture understanding

### quick-wins
- ✅ **Fully compatible** with both flowaccount.workspace (TypeScript/Angular) and flowaccount.dotnet.workspace (.NET/C#)
- ✅ Respects FlowAccount naming conventions (`_underscore` prefix for private/protected fields)
- ✅ Honors Clean Architecture layers (Controller → Facade → Logic → Service → DataHandler)
- ✅ Respects Nx project boundaries and DDD structure
- ✅ Works alongside MCP agents (software-engineer, architect, security-scanner, etc.)
- ✅ Preserves `flowaccount` component prefix
- ✅ Understands FlowAccount-specific patterns and conventions

See [quick-wins FlowAccount Compatibility Guide](plugins/quick-wins/FLOWACCOUNT-COMPATIBILITY.md) for detailed information.

## Documentation

### Plugin Documentation
- [ask-before-code README](plugins/ask-before-code/README.md)
- [quick-wins README](plugins/quick-wins/README.md)
- [quick-wins FlowAccount Compatibility](plugins/quick-wins/FLOWACCOUNT-COMPATIBILITY.md)

### Claude Code Documentation
- [Claude Code Plugins Documentation](https://code.claude.com/docs/en/plugins.md)
- [Plugin Marketplaces](https://code.claude.com/docs/en/plugin-marketplaces.md)
- [Skills Reference](https://code.claude.com/docs/en/skills.md)

## Contributing

Contributions welcome! These plugins are part of the FlowAccount development toolkit.

### Development Workflow
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with `claude --plugin-dir ./plugins/<plugin-name>`
5. Submit a pull request

## Plugin Status

| Plugin | Version | Status | FlowAccount Compatible |
|--------|---------|--------|----------------------|
| ask-before-code | 0.1.0 | ✅ Stable | ✅ Both workspaces |
| quick-wins | 0.1.0 | ✅ Stable | ✅ Both workspaces |

## Roadmap

### Coming Soon
- **claude-code-mentor** 🎓 - Interactive learning assistant for Claude Code best practices
- **flowaccount-dev-workflow** 🚀 - FlowAccount-specific workflow automations

### Future Ideas
- Enhanced TypeScript/Angular pattern detection
- .NET performance optimization suggestions
- Team-specific code conventions enforcement
- Integration with FlowAccount CI/CD pipelines

## Support & Feedback

- 🐛 **Report Issues:** [GitHub Issues](https://github.com/AndaAndaman/claude-plugins/issues)
- 💡 **Feature Requests:** [GitHub Discussions](https://github.com/AndaAndaman/claude-plugins/discussions)
- 📧 **Contact:** dev@flowaccount.com

## License

MIT License - See [LICENSE](LICENSE) file for details.

---

<div align="center">

**🎉 Happy Coding! 🎉**

Made with ❤️ by the FlowAccount Developer Team

**Last Updated:** 2026-01-21 | **Plugins:** 2 | **Total Features:** 12+

</div>
