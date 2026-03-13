---
name: agent-token-cost
description: This skill should be used when the user asks to "estimate agent cost", "decide whether to use an agent or parent", "optimize token spending", "compare agent vs parent cost", "reduce API billing", or mentions agent delegation economics, break-even rules, or token cost analysis. Provides cost models and decision rules for when spawning Claude Code agents saves money vs costs more.
---

# Agent Token Cost Analysis

## Purpose

Provide cost-aware guidance for deciding when to delegate work to Claude Code agents vs keeping work in the parent context. Covers token economics, break-even thresholds, and a decision matrix for approach selection.

## When to Use

- Designing commands or workflows that spawn agents
- Deciding between parent-only execution vs agent delegation
- Evaluating whether parallel agents are worth the cost
- Estimating token spend for multi-step operations
- Optimizing existing agent-based workflows for cost

## Reference Docs

- **Token Counting**: https://platform.claude.com/docs/en/build-with-claude/token-counting
- **Extended Thinking**: https://platform.claude.com/docs/en/build-with-claude/extended-thinking
- **Pricing**: https://platform.claude.com/docs/en/about-claude/pricing

## How Agents Work (Token Perspective)

Spawning an agent creates a **separate context window** with its own API call stream.

```
PARENT CONTEXT                     AGENT CONTEXT
- Base: ~4,000-6,000 tokens        - Base: ~1,000-1,500 tokens
- System prompt + CLAUDE.md         - Agent system prompt only
- All tool definitions              - Only allowed tools
- Full conversation history         - No history
```

**Key difference:** Agent base context is 4-5x smaller than parent.

## Critical Insight: Each Agent = Separate Thinker

Each agent generates its **own** thinking tokens (output tokens, 5x price of input):

```
1 parent doing 9 steps:   1 thinker  -> ~3,000 output tokens
3 agents doing 3 steps:   3 thinkers -> ~4,500 output tokens (50% more output)
```

Agents save on input (smaller base) but spend more on output (multiple thinkers).

## Break-Even Rule

```
Agent saves money when:
  (parent_base - agent_base) x steps x $input  >  agent_overhead x $output

Rule of thumb:
  4+ tool steps  -> delegate to agent (saves money)
  1-3 tool steps -> keep in parent (cheaper)
  6+ tool steps  -> always delegate (significant savings)
```

## Decision Matrix

```
Approach             | Input $ | Output $ | Total $  | Latency
---------------------|---------|----------|----------|--------
Parent (1-3 steps)   | LOW     | LOW      | LOWEST   | Fast
Agent (1-3 steps)    | LOW     | MEDIUM   | HIGHER!  | Slower
Parent (6+ steps)    | HIGH    | LOW      | HIGH     | Slow
Agent (6+ steps)     | MEDIUM  | MEDIUM   | LOWER    | Slow
3 parallel agents    | LOW     | HIGH     | MEDIUM   | Fastest
1 MCP tool (no LLM)  | LOWEST | LOWEST   | CHEAPEST | Fastest
```

## Key Takeaways

- **Each agent = separate thinker** -- more agents = more output tokens (5x price)
- **Agent base context is 4-5x smaller** than parent -- saves input on long chains
- **Break-even at ~4 tool steps** -- below that, parent is cheaper
- **Parallel agents trade output cost for speed** -- faster but more total output
- **The cheapest option is always 1 MCP tool** that does the job with no LLM reasoning

## Additional Resources

- `references/cost-calculations.md` -- Detailed dollar-amount comparisons for deploy example, short tasks, and parallel agent scenarios
