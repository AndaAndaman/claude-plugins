---
name: risk-guard
description: |
  Skill for quickly identifying potential risks, edge cases, and gotchas that could break a feature implementation.
  Use when you need to spot issues before they become bugs.

  Triggers: "what could break", "identify risks", "edge cases", "gotchas", "guard against"
---

# Risk Guard Skill

## Purpose

Quickly identify **what could go wrong** with a feature implementation. Focus on actionable risks that affect MVP success, not theoretical concerns.

## Methodology

### Step 1: Categorize the Feature
Determine risk profile based on feature type:

| Type | Common Risks |
|------|--------------|
| Auth/Security | Token handling, session state, permissions |
| Data/Forms | Validation, state sync, error handling |
| UI Components | Responsive, accessibility, state management |
| API Integration | Error handling, loading states, caching |
| Navigation | Route guards, deep links, back button |

### Step 2: Quick Risk Scan
Check for these common gotchas (pick relevant ones):

**State Management**
- [ ] Does state persist correctly? (localStorage, session)
- [ ] Race conditions with async operations?
- [ ] State cleanup on unmount/navigate away?

**Security**
- [ ] Auth check required?
- [ ] Input sanitization needed?
- [ ] Sensitive data exposure?

**UX**
- [ ] Loading state handled?
- [ ] Error state handled?
- [ ] Empty state handled?

**Integration**
- [ ] API error responses handled?
- [ ] Offline/network failure?
- [ ] Backwards compatibility?

### Step 3: Prioritize (Max 3 Risks)
Rate by: **Likelihood × Impact**
- Report only HIGH priority risks
- Each risk must have a **mitigation**

### Step 4: Output Risk Brief

```markdown
## Risk Brief

### Critical Risks

1. **Auth Token Expiry** ⚠️ HIGH
   - Risk: Logout fails silently if token already expired
   - Mitigation: Check token validity first, handle 401 gracefully

2. **State Not Cleared** ⚠️ MEDIUM
   - Risk: User data persists after logout in memory
   - Mitigation: Clear all auth-related state in logout handler

3. **Redirect Loop** ⚠️ MEDIUM
   - Risk: Logout redirects to protected page that redirects to login
   - Mitigation: Redirect to public page (e.g., /login, /home)

### Safe to Ignore (for MVP)
- Logout confirmation modal (can add later)
- Logout from all devices (v2 feature)
```

## Anti-Patterns

- **Don't**: List every possible edge case (max 3 critical)
- **Don't**: Suggest architectural changes
- **Don't**: Block MVP with "nice-to-have" concerns
- **Do**: Focus on risks that would make MVP fail
- **Do**: Provide actionable mitigations
