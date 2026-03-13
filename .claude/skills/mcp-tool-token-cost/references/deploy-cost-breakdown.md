# Real Example: /deploy ui staging (6 MCP Tool Calls)

## Per-Step Cost Breakdown

```
Step 1: git_command(status)
  Input: 6,310  Output: 530    Cost: $0.095 + $0.040 = $0.134

Step 2: git_command(push)
  Input: 6,890  Output: 330    Cost: $0.103 + $0.025 = $0.128

Step 3: git_command(merge_to)
  Input: 7,270  Output: 340    Cost: $0.109 + $0.026 = $0.135

Step 4: jenkins_build(ui)
  Input: 7,730  Output: 230    Cost: $0.116 + $0.017 = $0.133

Step 5: jenkins_status(ui)
  Input: 8,040  Output: 230    Cost: $0.121 + $0.017 = $0.138

Step 6: final response
  Input: 8,370  Output: 300    Cost: $0.126 + $0.023 = $0.148

-----------------------------------------------------------------
Total: 44,610 input + 1,960 output = $0.669 + $0.147 = $0.816
```

Notice how input tokens grow from 6,310 to 8,370 across steps as thinking and tool results accumulate.

## Where the Money Goes

```
Base context repeated 6x:   $0.568  (70%)
Accumulated thinking:       $0.059  ( 7%)
Tool data:                  $0.042  ( 5%)
Output (thinking + text):   $0.147  (18%)
```

The dominant cost (70%) is the base context being resent on every round-trip.

## Redesign Comparison

### Bad: 6 separate MCP tools

```
git_command(status)  ->  git_command(push)  ->  git_command(merge_to)
->  jenkins_build(ui)  ->  jenkins_status(ui)  ->  text response

6 round-trips x 6,310 base = 37,860 tokens just for context
Total: $0.816
```

### Better: 2 combined MCP tools

```
git_deploy(push + merge_to target="a-staging")  ->  jenkins_deploy(target="ui" monitor=true)

2 round-trips x 6,310 base = 12,620 tokens
Total: ~$0.350 (57% cheaper)
```

### Best: 1 MCP tool that does everything

```
deploy(target="ui" environment="staging")
  -> internally: status -> push -> merge -> build -> monitor -> return result

1 round-trip x 6,310 base = 6,310 tokens
Total: ~$0.180 (78% cheaper)
```

### Cost Comparison Table

```
+--------------------+----------+----------+
| Design             | Cost     | Savings  |
+--------------------+----------+----------+
| 6 MCP tools        | $0.816   | baseline |
| 2 combined tools   | $0.350   | 57%      |
| 1 all-in-one tool  | $0.180   | 78%      |
+--------------------+----------+----------+
```

## MCP Tool Definition Cost

Tool definitions are part of the base context and sent on every API call:

```
Simple tool (1 action):      ~50 tokens
Complex tool (many params):  ~200 tokens
Tool with enum + docs:       ~300 tokens

10 tools defined:  ~2,000 tokens x every step
20 tools defined:  ~4,000 tokens x every step
```

Use `allowed-tools` frontmatter in commands to limit exposed tools.

## Parallel MCP Calls

Claude can call multiple MCP tools in a single step if they are independent:

```
Single step with 2 parallel calls:
  Input:  6,310 (paid once)
  Output: thinking + tool_call_1 + tool_call_2

vs

2 sequential steps:
  Step 1 input: 6,310
  Step 2 input: 6,310 + T1 + result1 = ~7,000
  Total input:  ~13,310 (paid twice)
```

Parallel calls in one step save ~50% input compared to sequential calls.
