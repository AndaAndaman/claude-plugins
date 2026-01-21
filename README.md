# FlowAccount Dev Tools - Claude Code Plugins

A plugin marketplace for Claude Code containing development tools and productivity plugins for FlowAccount developers.

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

## Installation

### For Users

1. Add this marketplace to Claude Code:
   ```bash
   /plugin marketplace add AndaAndaman/claude-plugins
   ```

2. Install the plugin:
   ```bash
   /plugin install ask-before-code@flowaccount-dev-tools
   ```

3. Use the plugin:
   ```bash
   /clarify              # Run requirement clarification
   /clarify invoice feature  # Clarify specific topic
   ```

## Documentation

- [Claude Code Plugins Documentation](https://code.claude.com/docs/en/plugins.md)
- [Plugin Marketplaces](https://code.claude.com/docs/en/plugin-marketplaces.md)
- [Skills Reference](https://code.claude.com/docs/en/skills.md)

## License

MIT License - See [LICENSE](LICENSE) file for details.
