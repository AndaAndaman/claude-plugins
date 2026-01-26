# Skill Description Templates

Templates for generating effective skill descriptions with strong trigger phrases.

## Description Structure

All skill descriptions must follow this structure:

```
This skill should be used when the user asks to "[phrase 1]", "[phrase 2]", "[phrase 3]", or mentions [concept]. [Brief explanation].
```

**Components:**
1. **Opening:** "This skill should be used when..." (third person)
2. **Trigger phrases:** 3-7 specific phrases in quotes
3. **Key concepts:** Domain terminology (optional)
4. **Explanation:** What skill provides (1-2 sentences)

## Templates by Category

### Creation/Building Tasks

**Template:**
```
This skill should be used when the user asks to "create [X]", "build [X]", "generate [X]", "setup [X]", or mentions [domain concept]. Provides [what it does].
```

**Examples:**

**Skill: Hook Development**
```
This skill should be used when the user asks to "create a hook", "add a PreToolUse hook", "setup event handlers", "build validation hooks", or mentions hook events (PreToolUse, PostToolUse, Stop). Provides comprehensive guidance for creating and implementing Claude Code plugin hooks.
```

**Skill: API Integration**
```
This skill should be used when the user asks to "create API integration", "build REST client", "setup authentication", "generate API wrapper", or mentions API endpoints. Provides patterns and best practices for integrating external APIs.
```

**Skill: Component Builder**
```
This skill should be used when the user asks to "create component", "build UI element", "generate React component", "setup component structure", or mentions component lifecycle. Provides component development patterns and templates.
```

### Conversion/Transformation Tasks

**Template:**
```
This skill should be used when the user asks to "convert [X] to [Y]", "transform [X]", "migrate [X]", "parse [X]", or mentions [conversion context]. Provides [transformation capabilities].
```

**Examples:**

**Skill: Markdown to Skill Conversion**
```
This skill should be used when the user asks to "convert markdown to skill", "transform markdown into SKILL.md", "parse markdown structure", "extract sections from markdown", or mentions skill creation from documents. Provides automated conversion from unstructured markdown to organized Claude skills.
```

**Skill: Data Format Converter**
```
This skill should be used when the user asks to "convert JSON to YAML", "transform XML to JSON", "parse CSV data", "migrate data formats", or mentions data transformation. Provides format conversion utilities and validation.
```

**Skill: Code Migrator**
```
This skill should be used when the user asks to "migrate to new framework", "convert old syntax", "transform legacy code", "upgrade dependencies", or mentions migration paths. Provides automated code migration and refactoring.
```

### Analysis/Inspection Tasks

**Template:**
```
This skill should be used when the user asks to "analyze [X]", "inspect [X]", "validate [X]", "check [X] quality", or mentions [analysis domain]. Provides [analysis capabilities].
```

**Examples:**

**Skill: Code Quality Analyzer**
```
This skill should be used when the user asks to "analyze code quality", "inspect code issues", "validate code standards", "check for anti-patterns", or mentions code review. Provides automated quality analysis with fix suggestions.
```

**Skill: Security Scanner**
```
This skill should be used when the user asks to "analyze security", "inspect vulnerabilities", "validate security practices", "check for CVEs", or mentions security audit. Provides comprehensive security analysis and recommendations.
```

**Skill: Performance Profiler**
```
This skill should be used when the user asks to "analyze performance", "inspect bottlenecks", "profile execution", "check optimization", or mentions performance metrics. Provides performance analysis and optimization guidance.
```

### Configuration/Setup Tasks

**Template:**
```
This skill should be used when the user asks to "configure [X]", "setup [X]", "initialize [X]", "customize [X]", or mentions [configuration context]. Provides [configuration guidance].
```

**Examples:**

**Skill: Plugin Configuration**
```
This skill should be used when the user asks to "configure plugin settings", "setup plugin", "initialize plugin config", "customize plugin behavior", or mentions .local.md files. Provides configuration patterns and settings management for Claude Code plugins.
```

**Skill: Environment Setup**
```
This skill should be used when the user asks to "configure development environment", "setup project", "initialize workspace", "customize tooling", or mentions environment variables. Provides environment configuration and initialization guidance.
```

**Skill: CI/CD Configuration**
```
This skill should be used when the user asks to "configure CI pipeline", "setup deployment", "initialize workflows", "customize build process", or mentions CI/CD platforms. Provides CI/CD configuration patterns and best practices.
```

### Documentation/Reference Tasks

**Template:**
```
This skill should be used when the user asks about "[domain]", "[technical term]", "[concept]", or needs reference for [subject]. Provides [documentation type].
```

**Examples:**

**Skill: API Reference**
```
This skill should be used when the user asks about "API endpoints", "authentication methods", "request formats", "response schemas", or needs API documentation. Provides comprehensive API reference with examples.
```

**Skill: Framework Guide**
```
This skill should be used when the user asks about "framework features", "best practices", "common patterns", "migration guide", or needs framework reference. Provides comprehensive framework documentation and usage patterns.
```

**Skill: Protocol Specification**
```
This skill should be used when the user asks about "protocol format", "message structure", "handshake process", "error handling", or needs protocol reference. Provides detailed protocol specification with examples.
```

### Workflow/Process Tasks

**Template:**
```
This skill should be used when the user asks to "follow [X] workflow", "execute [X] process", "run [X] procedure", or mentions [workflow context]. Provides [workflow guidance].
```

**Examples:**

**Skill: Testing Workflow**
```
This skill should be used when the user asks to "follow testing workflow", "execute test process", "run test suite", "implement test strategy", or mentions test automation. Provides comprehensive testing workflow from unit to integration tests.
```

**Skill: Deployment Process**
```
This skill should be used when the user asks to "follow deployment workflow", "execute release process", "run deployment", "deploy to production", or mentions deployment stages. Provides step-by-step deployment procedures with rollback strategies.
```

**Skill: Code Review Process**
```
This skill should be used when the user asks to "follow review workflow", "execute code review", "review pull request", "check code changes", or mentions review checklist. Provides code review procedures and quality standards.
```

## Trigger Phrase Generation Process

### Step 1: Identify Core Actions

List verbs related to skill's purpose:
- Create, build, generate, setup
- Convert, transform, migrate, parse
- Analyze, inspect, validate, check
- Configure, customize, initialize
- Follow, execute, run, implement

### Step 2: Identify Domain Terms

List nouns and concepts:
- Tool names (hook, agent, skill, MCP)
- File types (.md, .json, .yaml, SKILL.md)
- Technical terms (authentication, validation, parsing)
- Frameworks (React, Angular, FastAPI)
- Processes (workflow, pipeline, process)

### Step 3: Combine into Phrases

Verb + Domain Term = Trigger Phrase

**Examples:**
- create + hook → "create a hook"
- parse + markdown → "parse markdown"
- validate + configuration → "validate configuration"
- convert + format → "convert to format"

### Step 4: Add Variations

Include synonyms and alternative phrasings:
- "create a hook" + "add a hook" + "build a hook"
- "parse markdown" + "analyze markdown structure"
- "validate config" + "check configuration"

### Step 5: Select Best Phrases

Choose 3-7 phrases that are:
1. **Specific** - Not vague or generic
2. **Actionable** - Include clear verbs
3. **Natural** - What users actually say
4. **Diverse** - Cover different aspects

### Step 6: Add Concepts

Include key terminology users might mention:
- "or mentions hook events"
- "or references API endpoints"
- "or discusses data transformation"

## Quality Checklist

Evaluate description quality:

**Structure:**
- [ ] Starts with "This skill should be used when..."
- [ ] Contains 3-7 trigger phrases in quotes
- [ ] Includes key concepts after phrases
- [ ] Ends with 1-2 sentence explanation

**Trigger Phrases:**
- [ ] Specific and actionable (not vague)
- [ ] What users would actually say
- [ ] Include verbs (action-oriented)
- [ ] Cover different aspects of skill
- [ ] Diverse (not all variations of same phrase)

**Concepts:**
- [ ] Domain-specific terminology
- [ ] Technical terms users know
- [ ] Framework/tool names if relevant
- [ ] Process names if relevant

**Explanation:**
- [ ] Clear what skill provides
- [ ] Concise (1-2 sentences)
- [ ] Value proposition evident
- [ ] Not redundant with phrases

## Common Mistakes

### Mistake 1: Vague Phrases

❌ **Bad:**
```
This skill should be used when working with hooks, using hooks, or doing hook stuff.
```

**Problems:**
- "working with hooks" - too vague
- "using hooks" - no specific action
- "doing hook stuff" - unprofessional, unclear

✅ **Good:**
```
This skill should be used when the user asks to "create a hook", "add a PreToolUse hook", "validate hook configuration", or mentions hook events.
```

**Why better:**
- Specific actions (create, add, validate)
- Clear what "hook" means (PreToolUse hook)
- Concrete scenarios

### Mistake 2: Not Enough Variety

❌ **Bad:**
```
This skill should be used when the user asks to "create hook", "build hook", "make hook", "generate hook".
```

**Problems:**
- All variations of same action
- Doesn't cover analysis, validation, or configuration
- Missing key concepts

✅ **Good:**
```
This skill should be used when the user asks to "create a hook", "validate hook schema", "test hook behavior", or mentions hook events (PreToolUse, PostToolUse).
```

**Why better:**
- Covers creation, validation, testing
- Includes key concepts (hook events)
- Diverse trigger scenarios

### Mistake 3: Wrong Person

❌ **Bad:**
```
Use this skill when you want to create hooks.
You should load this when working with hooks.
Load when user needs hook help.
```

**Problems:**
- Second person ("you")
- Not third person format
- Inconsistent structure

✅ **Good:**
```
This skill should be used when the user asks to "create a hook", "work with hook events", or needs hook guidance.
```

**Why better:**
- Third person ("This skill should be used when")
- Consistent structure
- Clear triggers

### Mistake 4: No Key Concepts

❌ **Bad:**
```
This skill should be used when the user asks to "create a hook", "add a hook", "validate a hook".
```

**Problems:**
- Missing domain concepts
- No terminology to match on
- Less discoverable

✅ **Good:**
```
This skill should be used when the user asks to "create a hook", "add a hook", "validate a hook", or mentions hook events (PreToolUse, PostToolUse, Stop).
```

**Why better:**
- Includes key concepts (hook events)
- Lists specific event names
- More discoverable

### Mistake 5: Too Long Explanation

❌ **Bad:**
```
This skill should be used when the user asks to "create a hook". Provides comprehensive guidance for creating hooks including detailed step-by-step instructions, validation procedures, testing strategies, troubleshooting tips, best practices, common patterns, advanced techniques, and real-world examples for all hook types.
```

**Problems:**
- Explanation is way too long
- Lists every detail
- Should be concise

✅ **Good:**
```
This skill should be used when the user asks to "create a hook", "validate hook schema", "test hook behavior". Provides comprehensive hook development guidance including patterns, validation, and testing.
```

**Why better:**
- Concise explanation (1-2 sentences)
- Highlights key aspects
- Lets SKILL.md provide details

## Examples by Plugin Type

### Integration Plugin

**Skill: MCP Server Integration**
```
This skill should be used when the user asks to "integrate MCP server", "setup MCP connection", "configure MCP tools", "add external service", or mentions Model Context Protocol. Provides guidance for integrating external services via MCP including stdio, SSE, and HTTP server types.
```

### Workflow Plugin

**Skill: Deployment Automation**
```
This skill should be used when the user asks to "automate deployment", "setup CI/CD", "configure release pipeline", "deploy to production", or mentions deployment workflow. Provides automated deployment procedures with validation and rollback capabilities.
```

### Analysis Plugin

**Skill: Code Quality Scanner**
```
This skill should be used when the user asks to "scan code quality", "check code issues", "analyze codebase", "identify tech debt", or mentions static analysis. Provides automated quality scanning with prioritized fix recommendations.
```

### Toolkit Plugin

**Skill: File Format Converter**
```
This skill should be used when the user asks to "convert file format", "transform data", "parse file structure", "export to format", or mentions format conversion. Provides utilities for converting between common file formats with validation.
```

## Template Summary

Use these templates as starting points:

**Creation:** `"create [X]", "build [X]", "generate [X]"`
**Conversion:** `"convert [X] to [Y]", "transform [X]", "parse [X]"`
**Analysis:** `"analyze [X]", "inspect [X]", "validate [X]"`
**Configuration:** `"configure [X]", "setup [X]", "initialize [X]"`
**Documentation:** `about "[X]", "[term]", needs reference for [X]`
**Workflow:** `"follow [X] workflow", "execute [X] process"`

Customize with domain-specific verbs, nouns, and concepts for your skill.
