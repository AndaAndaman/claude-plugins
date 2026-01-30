# Bad CLAUDE.md Example

This example shows common mistakes to avoid when generating context files.

---

# Module: src/api/users

## Overview

This directory has files.

**PROBLEM**: Too vague, doesn't explain what the module does or its role.

**BETTER**: "REST API endpoints for user management. Handles authentication, CRUD operations, and profile updates."

---

## Files

### UserController.ts
The UserController class extends BaseController and implements the IUserOperations interface. It has methods like getUser(req, res) which uses the userService.findById() method to fetch users from the database. The createUser method validates input using validateUserCreate() from the validation module, then calls userService.create() with the sanitized data. If an error occurs, it catches the error and sends a 400 or 500 response depending on the error type.

**PROBLEM**: Way too detailed, describes implementation rather than purpose. File summaries should be 1-2 sentences.

**BETTER**: "Express route controller handling user-related HTTP endpoints. Exports UserController class with methods for CRUD operations."

---

### auth.ts
This file contains authentication logic.

**PROBLEM**: Too vague, doesn't explain what authentication logic or key exports.

**BETTER**: "Authentication middleware for protecting user routes. Exports authenticateUser and authorizeRole functions."

---

## Patterns

Some files use async/await.

**PROBLEM**: Doesn't provide useful pattern information. Every modern Node.js project uses async/await.

**BETTER**: "Async/await: All route handlers are async functions with try-catch blocks. Errors are thrown up to error-handling middleware."

---

## Dependencies

Uses Express, Joi, and other stuff.

**PROBLEM**: Too vague, doesn't explain how dependencies are used or why they're needed.

**BETTER**:
```
- `express` - HTTP framework for route handling
- `joi` - Schema validation for request bodies
- `../services/user-service` - Business logic delegated to service layer
```

---

## Summary of Mistakes

1. **Vague overview** - "This directory has files" says nothing useful
2. **Too much implementation detail** - Describing code line-by-line instead of purpose
3. **Too little detail** - "Contains authentication logic" is not helpful
4. **No structure** - Missing the template format with clear sections
5. **No value for future sessions** - A future Claude session wouldn't understand the module better after reading this

## How to Fix

- Use the template structure consistently
- Keep file summaries to 1-2 sentences focusing on "what" not "how"
- Document observable patterns, not obvious language features
- Explain why dependencies are used, not just list them
- Write for future Claude sessions who need to understand the module quickly
