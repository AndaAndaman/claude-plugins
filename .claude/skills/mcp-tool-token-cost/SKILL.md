---
name: mcp-tool-token-cost
description: This skill should be used when the user asks to "reduce MCP tool costs", "optimize MCP token usage", "design cost-efficient MCP tools", "analyze MCP tool chain cost", or mentions MCP round-trip token accumulation, tool chain pricing, or fewer MCP calls. Provides cost analysis patterns and design principles for minimizing token spend in MCP tool chains.
---

# MCP Tool Chain Token Cost

## Purpose

Understand how MCP tool chains accumulate tokens and apply design principles to minimize cost. Each MCP round-trip pays the full base context again, making the number of tool calls the primary cost driver.

## When to Use

- Designing new MCP tools or refactoring existing ones
- Analyzing why an MCP-heavy workflow is expensive
- Deciding between many small tools vs fewer combined tools
- Estimating cost of a multi-step MCP tool chain
- Reviewing `allowed-tools` scope for commands

## The Core Problem

Each MCP tool call is a round-trip. Every round-trip pays:

1. **Full base context again** (system prompt, CLAUDE.md, tool defs, history)
2. **All accumulated thinking** from previous steps
3. **All previous tool calls + results** from the current turn
4. **New output** (thinking + tool call) at 5x price

```
Step 1: [base] -> think -> call tool
Step 2: [base + T1 + tool1] -> think -> call tool
Step 3: [base + T1 + T2 + tool1 + tool2] -> think -> call tool
         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
         Grows every step, paid every step
```

The base context repeated on every step is typically 70% of total cost.

## Design Principles

### 1. Do more per tool call

Combine sequential operations into a single tool that handles the full workflow internally.

### 2. Return rich results to avoid follow-up calls

Include final status in the response instead of requiring polling calls.

### 3. Batch operations

Accept arrays/lists instead of requiring one call per item.

### 4. Limit tool definitions in scope

Use `allowed-tools` frontmatter to restrict exposed tools per command. Each tool definition adds 50-300 tokens to base context on every step.

### 5. Combine read + write when safe

Let the tool check preconditions internally rather than requiring a separate check call.

## Cost Impact Summary

```
1 tool doing everything:   ~$0.18  (78% cheaper than 6 tools)
2 combined tools:          ~$0.35  (57% cheaper)
6 separate tools:          ~$0.82  (baseline)
```

Parallel MCP calls in a single step save ~50% input compared to sequential calls.

## Key Takeaways

- Each MCP round-trip pays full base context -- this is the #1 cost driver
- Fewer calls = cheaper -- 1 tool doing 6 things is 78% cheaper than 6 tools
- Tool definitions add to base context -- limit exposed tools per command
- Parallel calls in one step save ~50% vs sequential
- The ideal MCP tool does the whole job internally and returns one result

## Additional Resources

- `references/deploy-cost-breakdown.md` -- Real /deploy example with per-step token counts and cost analysis
- **Token Counting**: https://platform.claude.com/docs/en/build-with-claude/token-counting
- **Pricing**: https://platform.claude.com/docs/en/about-claude/pricing
- **MCP**: https://modelcontextprotocol.io/introduction
