---
name: token-counting-thinking
description: This skill should be used when the user asks to "estimate token costs", "optimize thinking costs", "reduce API billing", "understand extended thinking pricing", or mentions token counting, thinking tokens, or output token costs. Provides billing rules, multi-turn behavior, tool chain accumulation, and cost optimization strategies for Claude extended thinking mode.
---

# Token Counting with Extended Thinking

Understand how Claude counts and bills tokens when using extended thinking (reasoning mode), including multi-turn conversations, tool chains, and cost optimization strategies.

## Reference Docs

- **Token Counting**: https://platform.claude.com/docs/en/build-with-claude/token-counting
- **Extended Thinking**: https://platform.claude.com/docs/en/build-with-claude/extended-thinking
- **Pricing**: https://platform.claude.com/docs/en/about-claude/pricing

## Pricing

```
Claude Opus 4.6:
  Input:  $15 per 1M tokens  ->  $0.000015 per token
  Output: $75 per 1M tokens  ->  $0.000075 per token
                                  5x more expensive!
```

Output tokens (thinking + text) are 5x the cost of input tokens. This changes every optimization decision.

## Core Billing Rules

1. **Full thinking tokens are billed** -- not the summarized thinking visible in the response.
2. Thinking tokens are billed as **output tokens** on the response that generates them.
3. The billed output count will **not match** the visible token count (summary < actual).

## Multi-Turn Conversations

| Scenario | Thinking counted as input? |
|---|---|
| Previous turn's thinking blocks | **No** -- ignored, free |
| Current turn's thinking (tool loop) | **Yes** -- must pass back, billed as input |
| Cached thinking (prompt caching) | **Yes** -- billed at cache read rate |

### Example: 3-turn conversation

```
Turn 1: 80 input + 3,400 output (3,000 thinking + 400 text)
Turn 2: 505 input + 2,300 output  <- thinking from turn 1 = FREE
Turn 3: 825 input + 1,750 output  <- thinking from turn 1+2 = FREE
```

If thinking carried forward, input would be 6.7x more expensive.

## Tool Chains (MCP / Regular Tools)

Within a single turn's tool loop, thinking blocks **accumulate**:

```
Step 1: input = base_context
Step 2: input = base_context + T1
Step 3: input = base_context + T1 + T2
Step N: input = base_context + T1 + T2 + ... + T(N-1)
```

Next turn: all previous thinking resets to 0 (free).

## The Base Context Problem

Base context is sent on every API call -- whether it is a tool chain or separate turns. This includes:
- System prompt
- CLAUDE.md
- Tool/MCP definitions
- Skill content
- Conversation history

```
Total cost = (base_context x round_trips x $input) + (thinking x $output)
              ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^       ^^^^^^^^^^^^^^^^^^^^^
              Scales with steps                        5x more expensive per token
```

### Real example: /deploy ui staging (6 tool steps)

```
Base context (~6,310 tokens) x 6 steps = 37,860 tokens (85% of total input)
Accumulated thinking across steps      =  5,200 tokens (12%)
Tool calls + results                   =  1,550 tokens (3%)
Total input: ~44,610 tokens

Dollar breakdown:
  Input:  44,610 x $0.000015 = $0.669
  Output:  1,960 x $0.000075 = $0.147
  Total:                        $0.816
```

## Optimization Strategies

### 1. Reduce output tokens first (5x leverage)

Every output token saved = 5x the savings of an input token. Lower `budget_tokens` or use non-thinking models for simple tasks.

### 2. Reduce round-trips (second biggest win)

```
6 steps x 6,310 base = 37,860 input tokens
2 steps x 6,310 base = 12,620 input tokens  <- 66% input savings
```

Design MCP tools to do more per call.

### 3. Combine parallel tool calls

If Claude can call `git_command(status)` + `git_command(push)` in one step, that eliminates one round-trip (~7,000 tokens saved).

### 4. Reduce base context size

A shorter CLAUDE.md saves tokens on every step. 1,000 tokens saved x 6 steps = 6,000 tokens saved.

### 5. Keep tool chains short

More MCP calls in a chain = more input tokens from accumulated thinking.

## Key Takeaways

- **Output is 5x input price** -- thinking is the expensive part.
- **Fewer round-trips = cheaper** -- base context tax is paid every call.
- **Tool chain vs step-by-step: both pay base context** -- no free lunch.
- **Thinking accumulates within a turn** but resets between turns.
- **Best MCP design: one tool that does the whole job** internally, returns one result.
