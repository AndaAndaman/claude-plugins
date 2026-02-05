---
name: implementation-brief
description: |
  Skill for synthesizing analysis from Scout, Guard, and Tester into a single actionable implementation brief.
  Use when you have multiple perspective outputs and need to create a unified implementation plan.

  Triggers: "create implementation brief", "synthesize analysis", "merge perspectives", "implementation plan"
---

# Implementation Brief Skill

## Purpose

Synthesize outputs from **Scout** (location), **Guard** (risks), and **Tester** (verification) into a single, actionable implementation brief that enables one-pass MVP development.

## Brief Structure

```markdown
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 IMPLEMENTATION BRIEF: [Feature Name]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 📍 Location (from Scout)
**Target**: `path/to/file.ts`
**Type**: [Create New | Modify Existing]
**Pattern**: Follow `path/to/similar.ts`

Related Files:
• `file1.ts` - [why]
• `file2.ts` - [why]

## ⚠️ Risks (from Guard)
1. **[Risk Name]** - [Mitigation]
2. **[Risk Name]** - [Mitigation]

## ✅ Verification (from Tester)
Manual:
- [ ] Step 1
- [ ] Step 2
- [ ] Step 3

Automated: [Test file suggestion]

## 🔧 Implementation Checklist
1. [ ] First change
2. [ ] Second change
3. [ ] Third change
4. [ ] Run verification

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Synthesis Rules

### From Scout → Location Section
- Pick **one primary target** file
- Include max **3 related files**
- Name the pattern/reference file

### From Guard → Risks Section
- Include only **HIGH/MEDIUM** priority risks
- Each risk MUST have mitigation
- Max **3 risks** (more = prioritization problem)

### From Tester → Verification Section
- **5 or fewer** manual steps
- **One** automated test suggestion
- Clear pass/fail criteria

### Generate → Implementation Checklist
Based on all inputs, create ordered checklist:
1. Create/modify files (from Scout)
2. Handle risks during implementation (from Guard)
3. Run verification (from Tester)

## Quality Checklist for Brief

Before presenting brief, verify:
- [ ] Location is specific (exact file path, not "somewhere in src/")
- [ ] Pattern reference exists and is relevant
- [ ] Risks have actionable mitigations
- [ ] Verification steps are concrete and testable
- [ ] Implementation checklist is ordered correctly
- [ ] Brief fits on one screen (no scrolling to see full picture)

## Example Complete Brief

```markdown
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 IMPLEMENTATION BRIEF: Add Logout Button
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 📍 Location
**Target**: `src/components/Header/UserMenu.tsx`
**Type**: Modify Existing
**Pattern**: Follow `LoginButton` in same directory

Related Files:
• `src/services/auth.service.ts` - Has logout() method
• `src/app/routes.ts` - Login route path

## ⚠️ Risks
1. **Token not cleared** - Call localStorage.removeItem('token')
2. **Redirect loop** - Navigate to /login (public route)

## ✅ Verification
Manual:
- [ ] Click logout in user menu
- [ ] Redirected to /login
- [ ] localStorage token cleared (DevTools check)
- [ ] Cannot access /dashboard after logout

Automated: `src/components/Header/UserMenu.spec.tsx`

## 🔧 Implementation Checklist
1. [ ] Add logout button to UserMenu.tsx
2. [ ] Call authService.logout() onClick
3. [ ] Clear localStorage token
4. [ ] Navigate to /login
5. [ ] Run manual verification

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
