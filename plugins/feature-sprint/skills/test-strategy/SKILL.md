---
name: test-strategy
description: |
  Skill for defining minimum viable test strategy - how to verify a feature works.
  Focus on practical verification, not exhaustive test coverage.

  Triggers: "how to test", "verify feature", "test strategy", "minimum tests", "verification"
---

# Test Strategy Skill

## Purpose

Define the **minimum verification** needed to confirm MVP works. Balance between "ship fast" and "don't ship broken".

## Methodology

### Step 1: Identify Success Criteria
What must be true for the feature to "work"?
- Primary user flow completes successfully
- No breaking side effects
- Basic error handling works

### Step 2: Choose Verification Type

| Feature Type | Primary Verification | Secondary |
|--------------|---------------------|-----------|
| UI Component | Manual + Visual | Unit test |
| Form/Input | Manual validation | Unit test |
| API Integration | Manual + Network tab | Integration test |
| Business Logic | Unit test | Manual |
| Auth/Security | Manual + Unit test | E2E test |

### Step 3: Define Manual Checklist
Quick verification steps (max 5):
```markdown
- [ ] Step 1: Do X
- [ ] Step 2: Verify Y happens
- [ ] Step 3: Check Z state
```

### Step 4: Suggest One Automated Test
Pick the highest-value test:
- Covers happy path
- Catches regression
- Easy to write

### Step 5: Output Test Brief

```markdown
## Test Brief

### Manual Verification (Do This First)
- [ ] Click logout button
- [ ] Verify redirect to /login page
- [ ] Open DevTools → Application → localStorage
- [ ] Verify auth tokens are cleared
- [ ] Try accessing /dashboard directly → should redirect to /login

### Automated Test (One High-Value Test)
```typescript
// logout.spec.ts
describe('Logout', () => {
  it('should clear auth and redirect to login', () => {
    // Arrange: User is logged in
    localStorage.setItem('token', 'fake-token');

    // Act: Click logout
    cy.get('[data-testid="logout-btn"]').click();

    // Assert: Token cleared, redirected
    expect(localStorage.getItem('token')).toBeNull();
    cy.url().should('include', '/login');
  });
});
```

### Not Needed for MVP
- Logout from multiple tabs (v2)
- Logout API call verification (token-based auth)
- Session timeout handling (separate feature)
```

## Verification Pyramid for MVP

```
        /\
       /  \      E2E: Only if critical path
      /----\
     /      \    Integration: Only if API involved
    /--------\
   /          \  Unit: Business logic only
  /------------\
 / Manual First \  Always start with manual verification
/________________\
```

## Anti-Patterns

- **Don't**: Require 100% test coverage for MVP
- **Don't**: Write tests before knowing if feature works
- **Don't**: Block shipping on test infrastructure issues
- **Do**: Manual first, automate what matters
- **Do**: One good test > many weak tests
