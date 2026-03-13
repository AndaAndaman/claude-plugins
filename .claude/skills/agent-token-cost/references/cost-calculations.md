# Detailed Cost Calculations

Real dollar comparisons for different agent delegation scenarios using Claude API pricing.

## Cost Comparison: /deploy Example (6 Steps)

### Option A: Parent Does Everything

```
Input:  44,610 x $0.000015 = $0.669
Output:  1,960 x $0.000075 = $0.147
-----------------------------------------
Total:                        $0.816
```

### Option B: Delegate to 1 Agent

```
PARENT (2 steps: spawn + receive):
  Input:  12,700 x $0.000015 = $0.191
  Output:    700 x $0.000075 = $0.053

AGENT (6 steps, smaller base ~1,200):
  Input:  13,900 x $0.000015 = $0.209
  Output:  1,960 x $0.000075 = $0.147
-----------------------------------------
Total:                          $0.599  (27% cheaper)
```

Savings come from agent's smaller base context (1,200 vs 6,310 per step).

## When Agents Cost More (1-3 Steps)

For simple tasks, agent overhead exceeds savings:

```
PARENT-ONLY (2 steps):
  Input:  13,200 x $0.000015 = $0.198
  Output:    830 x $0.000075 = $0.062
  Total:                        $0.260

AGENT-DELEGATED (same 2 steps):
  Parent input:  12,700 x $0.000015 = $0.191
  Parent output:    700 x $0.000075 = $0.053
  Agent input:   3,500 x $0.000015  = $0.053
  Agent output:    830 x $0.000075  = $0.062
  Total:                              $0.358  <- 38% MORE EXPENSIVE!
```

Agent adds overhead (spawn + receive steps in parent + agent's own base context) that exceeds the small savings from fewer parent steps.

## Parallel Agents: Fast but Output-Heavy

### 3 Parallel Agents (scout + guard + tester)

```
PARENT (2 steps):
  Input:  13,000 x $0.000015 = $0.195
  Output:    800 x $0.000075 = $0.060

AGENT A (4 steps):
  Input:   7,000 x $0.000015 = $0.105
  Output:  1,500 x $0.000075 = $0.113

AGENT B (3 steps):
  Input:   5,000 x $0.000015 = $0.075
  Output:  1,200 x $0.000075 = $0.090

AGENT C (2 steps):
  Input:   3,500 x $0.000015 = $0.053
  Output:    800 x $0.000075 = $0.060
-----------------------------------------
Total:                          $0.750
  Input cost:  $0.428 (57%)
  Output cost: $0.323 (43%)
```

### If Parent Did All 9 Steps Itself

```
Input:  65,000 x $0.000015 = $0.975
Output:  3,000 x $0.000075 = $0.225  <- LESS output (1 thinker vs 3)
-----------------------------------------
Total:                        $1.200
```

### Side-by-Side Comparison

```
                  Parent-only   3 Agents
Input cost:         $0.975       $0.428   <- agents win (smaller base)
Output cost:        $0.225       $0.323   <- agents LOSE (3 thinkers)
----------------------------------------------------
Total:              $1.200       $0.750   <- agents still win overall
```

Agents save on input but spend more on output. For 9 steps, input savings dominate.
