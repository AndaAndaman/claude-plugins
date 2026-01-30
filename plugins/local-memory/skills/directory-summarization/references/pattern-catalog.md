# Pattern Catalog for Directory Analysis

Comprehensive reference for detecting and documenting code patterns when generating CLAUDE.md context files.

## Naming Conventions

### Case Styles

**camelCase**
- First word lowercase, subsequent words capitalized
- Common for: variables, functions, methods
- Example: `getUserById`, `isValidEmail`, `userCount`

**PascalCase**
- All words capitalized
- Common for: classes, interfaces, types, components
- Example: `UserController`, `IAuthService`, `UserProfile`

**snake_case**
- All lowercase with underscores
- Common for: Python functions, database columns
- Example: `get_user_by_id`, `user_count`, `is_valid`

**kebab-case**
- All lowercase with hyphens
- Common for: file names, CSS classes, URLs
- Example: `user-controller.ts`, `api-client.js`

**SCREAMING_SNAKE_CASE**
- All uppercase with underscores
- Common for: constants, environment variables
- Example: `MAX_RETRY_COUNT`, `API_BASE_URL`

### Prefixes and Suffixes

**Common prefixes:**
- `_` - Private fields/methods (e.g., `_privateField`)
- `$` - Observables in RxJS (e.g., `user$`)
- `is`, `has`, `can` - Boolean values (e.g., `isActive`, `hasPermission`)
- `get`, `set` - Accessor methods (e.g., `getUser`, `setPassword`)
- `I` - Interfaces in TypeScript/C# (e.g., `IUserService`)

**Common suffixes:**
- `Controller` - HTTP request handlers
- `Service` - Business logic layer
- `Repository`/`Dao` - Data access layer
- `Dto` - Data transfer objects
- `Factory` - Object creation
- `Builder` - Object construction
- `Manager` - Coordinating classes
- `Helper`/`Util` - Utility functions

### File Naming Patterns

**Component-based:**
- `UserProfile.tsx` - React component
- `user-profile.component.ts` - Angular component
- `UserProfileView.swift` - iOS view

**Layer-based:**
- `user.controller.ts` - Controller layer
- `user.service.ts` - Service layer
- `user.repository.ts` - Data layer

**Test files:**
- `user.test.ts` - Jest/Mocha tests
- `user.spec.ts` - Jasmine/RSpec tests
- `user_test.go` - Go tests
- `test_user.py` - Python tests

## Architectural Patterns

### Layered Architecture

**Three-tier:**
```
Controller → Service → Repository
(HTTP) → (Business Logic) → (Data Access)
```

**Characteristics:**
- Clear separation of concerns
- Each layer only communicates with adjacent layer
- Common in web applications

**Detection:**
- Files named `*.controller.*`, `*.service.*`, `*.repository.*`
- Controller imports services
- Services import repositories
- No cross-layer imports (controller doesn't import repository)

### Model-View-Controller (MVC)

**Structure:**
```
Model (data) ← Controller (logic) → View (presentation)
```

**Characteristics:**
- Models represent data structures
- Views handle presentation
- Controllers coordinate between model and view

**Detection:**
- Directories: `models/`, `views/`, `controllers/`
- Or files: `*.model.*`, `*.view.*`, `*.controller.*`
- Controllers import both models and views

### Clean Architecture / Hexagonal

**Layers:**
```
Domain (entities) ← Use Cases ← Interface Adapters ← Frameworks
```

**Characteristics:**
- Domain at center, no external dependencies
- Use cases contain business rules
- Outer layers depend on inner layers, never reverse

**Detection:**
- Directories: `domain/`, `use-cases/`, `adapters/`, `infrastructure/`
- Domain entities have no imports from outer layers
- Dependency inversion pattern (interfaces in domain, implementations in infrastructure)

### Microservices Patterns

**Characteristics:**
- Service per directory or repository
- Each service has its own data store
- Services communicate via APIs or message queues

**Detection:**
- Standalone services with own entry point
- API client code for inter-service communication
- Service discovery imports (Consul, Eureka)

### Domain-Driven Design (DDD)

**Concepts:**
- Bounded contexts - logical boundaries
- Aggregates - consistency boundaries
- Entities - objects with identity
- Value objects - immutable objects

**Detection:**
- Directories organized by domain concept
- `*Aggregate`, `*Entity`, `*ValueObject` naming
- Repository pattern for aggregates
- Domain events

## Framework-Specific Patterns

### React

**Functional Components:**
```jsx
function UserProfile() {
  const [user, setUser] = useState(null)
  useEffect(() => { /* ... */ }, [])
  return <div>...</div>
}
```

**Detection:**
- Import `useState`, `useEffect` from 'react'
- Function returns JSX
- File ends in `.jsx` or `.tsx`

**Hooks:**
- `useState` - Local state
- `useEffect` - Side effects
- `useContext` - Context API
- `useReducer` - Complex state
- `useMemo`, `useCallback` - Performance

**Custom Hooks:**
- Functions starting with `use` (e.g., `useAuth`, `useFetch`)

### Angular

**Services:**
```typescript
@Injectable({ providedIn: 'root' })
export class UserService { }
```

**Detection:**
- `@Injectable` decorator
- `providedIn: 'root'` for singletons
- Files named `*.service.ts`

**Components:**
```typescript
@Component({
  selector: 'app-user',
  templateUrl: './user.component.html'
})
export class UserComponent { }
```

**Detection:**
- `@Component` decorator
- Files: `*.component.ts`, `*.component.html`, `*.component.css`

**Modules:**
- `@NgModule` decorator
- Files: `*.module.ts`

### Express.js

**Middleware:**
```javascript
function authMiddleware(req, res, next) {
  // ...
  next()
}
```

**Detection:**
- Functions with `(req, res, next)` signature
- Calls to `next()`

**Route Handlers:**
```javascript
app.get('/users/:id', async (req, res) => {
  // ...
  res.json(data)
})
```

**Detection:**
- Functions with `(req, res)` signature
- Calls to `res.json()`, `res.send()`, `res.status()`

### .NET/C#

**Controllers:**
```csharp
[ApiController]
[Route("api/[controller]")]
public class UserController : ControllerBase { }
```

**Detection:**
- `[ApiController]` attribute
- Inherits from `ControllerBase` or `Controller`

**Services:**
```csharp
public class UserService : IUserService { }
```

**Detection:**
- Interface implementation (e.g., `IUserService`)
- Registered in DI container

**Async patterns:**
- Methods returning `Task<T>` or `async Task`
- Use of `await` keyword

## Design Patterns

### Creational Patterns

**Factory:**
```typescript
class UserFactory {
  createUser(type: string): User {
    if (type === 'admin') return new AdminUser()
    return new RegularUser()
  }
}
```

**Detection:**
- Class or function named `*Factory`
- Methods like `create*`, `build*`, `make*`
- Returns different types based on input

**Builder:**
```typescript
class UserBuilder {
  withName(name: string) { this.name = name; return this; }
  withEmail(email: string) { this.email = email; return this; }
  build() { return new User(this.name, this.email); }
}
```

**Detection:**
- Class named `*Builder`
- Methods return `this` for chaining
- Final `build()` method

**Singleton:**
```typescript
class Database {
  private static instance: Database
  static getInstance() {
    if (!this.instance) this.instance = new Database()
    return this.instance
  }
}
```

**Detection:**
- Private constructor
- Static `instance` field
- Static `getInstance()` method
- Or Angular `providedIn: 'root'`

### Structural Patterns

**Adapter:**
```typescript
class LegacyUserAdapter implements User {
  constructor(private legacy: LegacyUser) {}
  getName() { return this.legacy.full_name; }
}
```

**Detection:**
- Class named `*Adapter`
- Wraps another object
- Implements common interface

**Decorator:**
```typescript
class LoggingUserService implements UserService {
  constructor(private userService: UserService) {}
  getUser(id: string) {
    console.log(`Getting user ${id}`)
    return this.userService.getUser(id)
  }
}
```

**Detection:**
- Implements same interface as wrapped object
- Adds behavior before/after delegating
- Or uses decorator syntax (`@log`)

### Behavioral Patterns

**Strategy:**
```typescript
interface AuthStrategy {
  authenticate(credentials: any): Promise<User>
}

class JwtAuthStrategy implements AuthStrategy { }
class OAuth2Strategy implements AuthStrategy { }
```

**Detection:**
- Interface defining algorithm
- Multiple implementations
- Context switches between strategies

**Observer:**
```typescript
class EventEmitter {
  listeners = []
  on(event, callback) { this.listeners.push(callback) }
  emit(event, data) { this.listeners.forEach(cb => cb(data)) }
}
```

**Detection:**
- Methods like `on`, `subscribe`, `addListener`
- Methods like `emit`, `notify`, `publish`
- Or RxJS observables

## Error Handling Patterns

### Try-Catch Wrapper

```typescript
async function getUser(id: string) {
  try {
    return await userRepository.findById(id)
  } catch (error) {
    logger.error(error)
    throw new UserNotFoundError(id)
  }
}
```

**Detection:**
- Consistent try-catch in all async functions
- Custom error types thrown
- Logging before rethrowing

### Error Middleware (Express)

```typescript
app.use((err, req, res, next) => {
  logger.error(err)
  res.status(err.statusCode || 500).json({ error: err.message })
})
```

**Detection:**
- Middleware with `(err, req, res, next)` signature
- Registered with `app.use()` at end of middleware chain

### Result Type (Rust-style)

```typescript
type Result<T, E> = { ok: true, value: T } | { ok: false, error: E }

function divide(a: number, b: number): Result<number, string> {
  if (b === 0) return { ok: false, error: "Division by zero" }
  return { ok: true, value: a / b }
}
```

**Detection:**
- Return type is union of success and error
- Calling code checks `ok` field before using value

## Testing Patterns

### Unit Tests

**Characteristics:**
- Test individual functions/classes in isolation
- Use mocks/stubs for dependencies
- Fast execution

**Detection:**
- Files: `*.test.*`, `*.spec.*`
- Imports: `jest`, `mocha`, `vitest`, `pytest`, `xunit`
- Mocking: `jest.mock()`, `sinon.stub()`, `unittest.mock`

### Integration Tests

**Characteristics:**
- Test multiple components together
- May use real database (test DB)
- Slower than unit tests

**Detection:**
- Files: `*.integration.test.*`, `*.e2e.spec.*`
- Test database setup/teardown
- API calls to real services

### Test Structure (AAA Pattern)

```typescript
test('should create user', () => {
  // Arrange
  const userData = { name: 'John', email: 'john@example.com' }

  // Act
  const user = createUser(userData)

  // Assert
  expect(user.name).toBe('John')
})
```

**Detection:**
- Comments: `// Arrange`, `// Act`, `// Assert`
- Or `// Given`, `// When`, `// Then` (BDD style)

## How to Use This Catalog

When analyzing a directory:

1. **Scan file names** for naming patterns
2. **Read imports** to detect framework
3. **Look for decorators/annotations** to identify framework patterns
4. **Check directory structure** for architectural patterns
5. **Examine class/function signatures** for design patterns
6. **Review error handling** for consistency
7. **Note test files** and testing approach

Document only patterns you actually observe - don't assume patterns that aren't present.
