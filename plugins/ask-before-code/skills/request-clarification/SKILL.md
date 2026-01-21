---
name: request-clarification
description: Systematically gather clear requirements before coding to prevent wasted work. Use when user requests are vague, incomplete, or missing essential context like module, users, or success criteria.
---

# Request Clarification Skill

## Purpose

Efficiently gather complete requirements through targeted questioning before any code is written. Transform vague requests into clear, actionable specifications.

## When to Use

Invoke this skill when:
- User request lacks essential context (module, users, outcome)
- Multiple interpretations are possible
- Requirements completeness is < 80%
- Feature requests missing business justification
- Bug reports missing reproduction steps or severity

## Clarification Framework

### For Feature Requests

Ask 2-3 targeted questions to gather:
1. **Module/Domain**: Which part of the system?
2. **Target Users**: Who will use this?
3. **Business Outcome**: What problem does this solve?
4. **Success Criteria**: How will we know it's done?

### For Bug Reports

Ask 2-3 targeted questions to gather:
1. **What's Broken**: Expected vs actual behavior
2. **Reproduction**: Steps to reproduce consistently
3. **Severity**: Impact and urgency (CRITICAL/HIGH/MEDIUM/LOW)
4. **Environment**: Where does this occur? (production/staging/dev)

### For Improvements

Ask 2-3 targeted questions to gather:
1. **Current Pain Point**: What's not working well?
2. **Desired Outcome**: What should improve?
3. **Business Justification**: Why does this matter?

## Process

1. **Analyze Request**: Determine what's missing from the request
2. **Ask Efficiently**: Use AskUserQuestion with 2-3 multiple-choice questions
3. **Confirm Understanding**: Summarize what you learned
4. **Generate Plan**: Output clear, actionable specifications

## Communication Style

- **Friendly**: "I can help! Quick questions..."
- **Efficient**: Maximum 3 questions per round
- **Clear**: Multiple-choice options when possible
- **Positive**: Focus on getting it right, not on what's missing

## Success Criteria

Requirements are clear when:
- Module/area is specified
- Target users identified
- Expected behavior defined
- Success criteria are measurable
- Confidence level is 80%+

## Example

**Vague Request**: "Add a report feature"

**Clarification Questions** (using AskUserQuestion):
1. What type of report?
   - A) Financial reports (P&L, balance sheet)
   - B) Operational reports (sales, inventory)
   - C) Analytics reports (user metrics, performance)

2. Who will use it?
   - A) Business owners
   - B) Accountants
   - C) Analysts

3. Export format?
   - A) PDF
   - B) Excel
   - C) Both

**Result**: Clear specification ready for implementation
