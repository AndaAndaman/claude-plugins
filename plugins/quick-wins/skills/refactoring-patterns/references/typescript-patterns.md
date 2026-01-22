# TypeScript/JavaScript Refactoring Patterns

Detailed refactoring patterns for TypeScript and JavaScript codebases.

## Modern Syntax Transformations

### const/let over var

**Pattern**: Replace `var` with `const` (immutable) or `let` (mutable)

```typescript
// Before
var count = 0;
var name = 'John';

// After
let count = 0;
const name = 'John';
```

**Safety**: Always safe if variable isn't reassigned outside block scope

### Arrow Functions

**Pattern**: Convert function expressions to arrow functions

```typescript
// Before
array.map(function(item) {
  return item * 2;
});

// After
array.map(item => item * 2);
```

**Benefits**: Shorter syntax, lexical `this` binding

### Template Literals

**Pattern**: Replace string concatenation with template literals

```typescript
// Before
const message = 'Hello, ' + name + '! You have ' + count + ' messages.';

// After
const message = `Hello, ${name}! You have ${count} messages.`;
```

### Destructuring

**Pattern**: Extract object properties and array elements

```typescript
// Before
const name = user.name;
const email = user.email;
const first = items[0];

// After
const { name, email } = user;
const [first] = items;
```

### Optional Chaining

**Pattern**: Safe property access

```typescript
// Before
const city = user && user.address && user.address.city;

// After
const city = user?.address?.city;
```

### Nullish Coalescing

**Pattern**: Default values for null/undefined

```typescript
// Before
const value = input !== null && input !== undefined ? input : 'default';

// After
const value = input ?? 'default';
```

## Async Patterns

### Async/Await over Promises

**Pattern**: Convert promise chains to async/await

```typescript
// Before
function fetchUser(id) {
  return api.getUser(id)
    .then(user => api.getUserDetails(user.id))
    .then(details => processDetails(details))
    .catch(error => handleError(error));
}

// After
async function fetchUser(id) {
  try {
    const user = await api.getUser(id);
    const details = await api.getUserDetails(user.id);
    return processDetails(details);
  } catch (error) {
    handleError(error);
  }
}
```

### Promise.all for Parallel Execution

**Pattern**: Run independent async operations in parallel

```typescript
// Before (sequential - slow)
const user = await fetchUser(userId);
const posts = await fetchPosts(userId);
const comments = await fetchComments(userId);

// After (parallel - fast)
const [user, posts, comments] = await Promise.all([
  fetchUser(userId),
  fetchPosts(userId),
  fetchComments(userId)
]);
```

## Type Improvements

### Explicit Types over any

**Pattern**: Replace `any` with proper types

```typescript
// Before
function process(data: any): any {
  return data.value;
}

// After
interface InputData {
  value: string;
}

function process(data: InputData): string {
  return data.value;
}
```

### Union Types

**Pattern**: Precise type unions instead of loose types

```typescript
// Before
function setStatus(status: string) { }

// After
type Status = 'pending' | 'active' | 'completed';
function setStatus(status: Status) { }
```

### Type Guards

**Pattern**: Runtime type checking

```typescript
// Before
function processValue(value: string | number) {
  if (typeof value === 'string') {
    return value.toLowerCase();
  }
  return value.toFixed(2);
}

// After (with type guard)
function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function processValue(value: string | number) {
  if (isString(value)) {
    return value.toLowerCase();
  }
  return value.toFixed(2);
}
```

## Array Methods

### Modern Array Methods

**Pattern**: Use declarative array methods

```typescript
// Before
const results = [];
for (let i = 0; i < items.length; i++) {
  if (items[i].active) {
    results.push(items[i].name);
  }
}

// After
const results = items
  .filter(item => item.active)
  .map(item => item.name);
```

### Array.includes over indexOf

**Pattern**: Check array membership

```typescript
// Before
if (array.indexOf(item) !== -1) { }

// After
if (array.includes(item)) { }
```

### Array.find over filter[0]

**Pattern**: Find single element

```typescript
// Before
const user = users.filter(u => u.id === id)[0];

// After
const user = users.find(u => u.id === id);
```

## Object Patterns

### Object Property Shorthand

**Pattern**: Concise object literals

```typescript
// Before
const obj = {
  name: name,
  age: age,
  greet: function() { }
};

// After
const obj = {
  name,
  age,
  greet() { }
};
```

### Spread Operator

**Pattern**: Object composition and array concatenation

```typescript
// Before
const merged = Object.assign({}, defaults, options);
const combined = arr1.concat(arr2);

// After
const merged = { ...defaults, ...options };
const combined = [...arr1, ...arr2];
```

### Object.entries/keys/values

**Pattern**: Iterate over objects

```typescript
// Before
for (const key in obj) {
  if (obj.hasOwnProperty(key)) {
    console.log(key, obj[key]);
  }
}

// After
for (const [key, value] of Object.entries(obj)) {
  console.log(key, value);
}
```

## Function Patterns

### Default Parameters

**Pattern**: Function parameter defaults

```typescript
// Before
function greet(name) {
  name = name || 'Guest';
  return `Hello, ${name}`;
}

// After
function greet(name = 'Guest') {
  return `Hello, ${name}`;
}
```

### Rest Parameters

**Pattern**: Variable arguments

```typescript
// Before
function sum() {
  const args = Array.prototype.slice.call(arguments);
  return args.reduce((a, b) => a + b, 0);
}

// After
function sum(...numbers: number[]) {
  return numbers.reduce((a, b) => a + b, 0);
}
```

## Common Quick Wins

### Remove Unused Imports

Identify imports never used in the file:

```typescript
// Before
import { UsedClass, UnusedClass, AnotherUnused } from './module';
const instance = new UsedClass();

// After
import { UsedClass } from './module';
const instance = new UsedClass();
```

### Remove Debug Code

```typescript
// Before
console.log('Debug:', data);
debugger;
// alert('test');

// After
// (removed)
```

### Extract Magic Numbers

```typescript
// Before
if (user.age >= 18 && user.age < 65) { }

// After
const MIN_AGE = 18;
const MAX_AGE = 65;
if (user.age >= MIN_AGE && user.age < MAX_AGE) { }
```

### Early Returns

```typescript
// Before
function process(data) {
  if (data) {
    if (data.valid) {
      // complex logic
    }
  }
}

// After
function process(data) {
  if (!data) return;
  if (!data.valid) return;

  // complex logic (less nested)
}
```

---

## FlowAccount-Specific TypeScript/Angular Conventions

### Naming Conventions (CRITICAL)

**Private/Protected Fields:**
- ✅ MUST start with underscore: `_myField`, `_service`
- ❌ DO NOT flag underscore prefix as issue
- This is FlowAccount standard, not a problem

**Descriptive Names:**
- ✅ Use full, descriptive names
- ❌ No abbreviations or short names
- Example: `customerService` not `custSvc`

### Domain-Driven Design (DDD) Boundaries

**FlowAccount uses strict Nx project boundaries:**
- Apps only import: features, shared, core
- UI apps only import libs tagged `type:ui`
- API apps only import libs tagged `type:api`
- Features belong to one domain only
- Shared/core libs must not import other libs

**DO NOT suggest changes that:**
- ❌ Create cross-domain dependencies
- ❌ Import UI code in API projects
- ❌ Import API code in UI projects
- ❌ Create circular dependencies

### FlowAccount-Specific Patterns to Respect

**Component Prefix:**
- Components use `flowaccount` prefix
- Don't suggest removing this prefix

**Change Detection:**
- OnPush change detection preferred
- Suggest OnPush when not used

**RxJS:**
- Prefer async pipe over manual subscriptions
- Suggest async pipe as improvement

**Testing:**
- Jest for unit tests
- Cypress/Playwright for E2E
- Don't suggest other testing frameworks

---

Use these patterns to modernize TypeScript/JavaScript code systematically while respecting FlowAccount conventions.
