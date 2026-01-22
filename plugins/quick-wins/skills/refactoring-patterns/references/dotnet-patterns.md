# .NET/C# Refactoring Patterns

.NET and C# refactoring patterns for modern development.

## Modern C# Syntax

### Null-Coalescing Operators

**Pattern**: Simplified null handling

```csharp
// Before
string value = name != null ? name : "default";

// After
string value = name ?? "default";

// Null-conditional with coalescing
string value = obj?.Property ?? "default";
```

### Null-Conditional Operator

**Pattern**: Safe member access

```csharp
// Before
int? length = null;
if (text != null) {
    length = text.Length;
}

// After
int? length = text?.Length;
```

### String Interpolation

**Pattern**: Readable string formatting

```csharp
// Before
string message = string.Format("Hello, {0}! You have {1} messages.", name, count);
string message2 = "Hello, " + name + "! Count: " + count;

// After
string message = $"Hello, {name}! You have {count} messages.";
```

### Expression-Bodied Members

**Pattern**: Concise member definitions

```csharp
// Before
public string FullName
{
    get { return $"{FirstName} {LastName}"; }
}

public string GetName()
{
    return name;
}

// After
public string FullName => $"{FirstName} {LastName}";
public string GetName() => name;
```

### Pattern Matching

**Pattern**: Type checking and casting

```csharp
// Before
if (obj is string)
{
    string text = (string)obj;
    Console.WriteLine(text.Length);
}

// After
if (obj is string text)
{
    Console.WriteLine(text.Length);
}

// Switch pattern matching
string result = obj switch
{
    int i => $"Integer: {i}",
    string s => $"String: {s}",
    _ => "Unknown"
};
```

### Local Functions

**Pattern**: Helper functions within methods

```csharp
// Before - private method used only in one place
private class MyClass
{
    public void Process(List<int> numbers)
    {
        var result = FilterAndTransform(numbers);
    }

    private List<int> FilterAndTransform(List<int> nums)
    {
        return nums.Where(x => x > 0).Select(x => x * 2).ToList();
    }
}

// After - local function
public void Process(List<int> numbers)
{
    var result = FilterAndTransform(numbers);

    List<int> FilterAndTransform(List<int> nums)
    {
        return nums.Where(x => x > 0).Select(x => x * 2).ToList();
    }
}
```

### Init-Only Properties

**Pattern**: Immutable objects

```csharp
// Before
public class User
{
    public string Name { get; set; }
    public string Email { get; set; }
}

// After - init-only setters (C# 9+)
public class User
{
    public string Name { get; init; }
    public string Email { get; init; }
}

// Usage
var user = new User { Name = "John", Email = "john@example.com" };
// user.Name = "Jane"; // Error: init-only
```

### Record Types

**Pattern**: Immutable data types

```csharp
// Before
public class Point
{
    public int X { get; init; }
    public int Y { get; init; }

    public Point(int x, int y)
    {
        X = x;
        Y = y;
    }
}

// After - record (C# 9+)
public record Point(int X, int Y);
```

## LINQ Patterns

### Query Simplification

**Pattern**: Replace loops with LINQ

```csharp
// Before
var results = new List<string>();
foreach (var item in items)
{
    if (item.IsActive)
    {
        results.Add(item.Name);
    }
}

// After
var results = items
    .Where(item => item.IsActive)
    .Select(item => item.Name)
    .ToList();
```

### FirstOrDefault vs First

**Pattern**: Safe element access

```csharp
// Before - throws if not found
var item = items.First(x => x.Id == id);

// After - returns null if not found
var item = items.FirstOrDefault(x => x.Id == id);
```

### Any over Count

**Pattern**: Existence check

```csharp
// Before
if (items.Count() > 0) { }
if (items.Where(x => x.Active).Count() > 0) { }

// After
if (items.Any()) { }
if (items.Any(x => x.Active)) { }
```

### LINQ Method Chaining

**Pattern**: Fluent query composition

```csharp
// Before
var filtered = items.Where(x => x.IsActive);
var sorted = filtered.OrderBy(x => x.Name);
var top10 = sorted.Take(10);
var names = top10.Select(x => x.Name);

// After
var names = items
    .Where(x => x.IsActive)
    .OrderBy(x => x.Name)
    .Take(10)
    .Select(x => x.Name)
    .ToList();
```

## Async/Await Patterns

### Async Methods

**Pattern**: Proper async/await usage

```csharp
// Before - blocking
public User GetUser(int id)
{
    var response = httpClient.GetAsync($"/api/users/{id}").Result;
    return response.Content.ReadAsAsync<User>().Result;
}

// After - non-blocking
public async Task<User> GetUserAsync(int id)
{
    var response = await httpClient.GetAsync($"/api/users/{id}");
    return await response.Content.ReadAsAsync<User>();
}
```

### ConfigureAwait(false)

**Pattern**: Library code optimization

```csharp
// Library code - don't capture context
public async Task<Data> FetchDataAsync()
{
    var response = await httpClient.GetAsync(url).ConfigureAwait(false);
    var content = await response.Content.ReadAsStringAsync().ConfigureAwait(false);
    return Parse(content);
}
```

### Task.WhenAll

**Pattern**: Parallel async operations

```csharp
// Before - sequential
var user = await GetUserAsync(id);
var orders = await GetOrdersAsync(id);
var profile = await GetProfileAsync(id);

// After - parallel
var tasks = new[]
{
    GetUserAsync(id),
    GetOrdersAsync(id),
    GetProfileAsync(id)
};
await Task.WhenAll(tasks);

var user = tasks[0].Result;
var orders = tasks[1].Result;
var profile = tasks[2].Result;
```

## Collection Patterns

### Collection Initializers

**Pattern**: Simplified collection creation

```csharp
// Before
var list = new List<string>();
list.Add("item1");
list.Add("item2");

// After
var list = new List<string> { "item1", "item2" };

// Dictionary
var dict = new Dictionary<string, int>
{
    ["key1"] = 1,
    ["key2"] = 2
};
```

### Collection Expressions (C# 12)

**Pattern**: Unified collection syntax

```csharp
// After C# 12
int[] numbers = [1, 2, 3, 4, 5];
List<string> names = ["Alice", "Bob", "Charlie"];
```

### Immutable Collections

**Pattern**: Thread-safe collections

```csharp
// Before - mutable
public List<string> Items { get; set; }

// After - immutable
public ImmutableList<string> Items { get; }
```

## Error Handling

### Exception Filters

**Pattern**: Conditional exception handling

```csharp
// Before
try
{
    await ProcessAsync();
}
catch (HttpRequestException ex)
{
    if (ex.StatusCode == HttpStatusCode.NotFound)
    {
        // Handle not found
    }
    else
    {
        throw;
    }
}

// After
try
{
    await ProcessAsync();
}
catch (HttpRequestException ex) when (ex.StatusCode == HttpStatusCode.NotFound)
{
    // Handle not found
}
```

### Using Declarations

**Pattern**: Simplified resource cleanup

```csharp
// Before
using (var reader = new StreamReader(path))
{
    var content = reader.ReadToEnd();
    Process(content);
}

// After - using declaration (C# 8+)
using var reader = new StreamReader(path);
var content = reader.ReadToEnd();
Process(content);
// reader disposed at end of scope
```

## Type Safety

### Nullable Reference Types

**Pattern**: Explicit nullability

```csharp
#nullable enable

// Before
public string GetName(User user)
{
    return user.Name; // Possible null reference
}

// After
public string GetName(User? user)
{
    return user?.Name ?? "Unknown";
}
```

### var vs Explicit Types

**Pattern**: Type inference

```csharp
// Use var when type is obvious
var users = new List<User>();
var name = GetUserName();

// Use explicit type when not obvious
IEnumerable<User> users = GetUsers();
int count = ProcessItems();
```

## Dependency Injection

### Constructor Injection

**Pattern**: Inject dependencies via constructor

```csharp
// Before
public class UserService
{
    private IUserRepository _repository;

    public UserService()
    {
        _repository = new UserRepository(); // Tight coupling
    }
}

// After
public class UserService
{
    private readonly IUserRepository _repository;

    public UserService(IUserRepository repository)
    {
        _repository = repository;
    }
}
```

## Common Quick Wins

### Replace var with Explicit Type (or vice versa)

```csharp
// When var is unclear
var result = ProcessData(); // What type?

// Use explicit type
ProcessResult result = ProcessData();

// When type is obvious
List<User> users = new List<User>();

// Use var
var users = new List<User>();
```

### Add Null Checks

```csharp
// Before
public void Process(string input)
{
    var length = input.Length; // NullReferenceException possible
}

// After
public void Process(string input)
{
    if (input == null) throw new ArgumentNullException(nameof(input));
    var length = input.Length;
}

// Or with C# 8+ nullable reference types
public void Process(string input) // input is non-nullable
{
    var length = input.Length; // Compiler ensures non-null
}
```

### Convert to String Interpolation

```csharp
// Find all string.Format and string concatenation
string.Format("User: {0}, Age: {1}", name, age)
"User: " + name + ", Age: " + age

// Replace with interpolation
$"User: {name}, Age: {age}"
```

### Use Expression Bodies

```csharp
// Before
public string GetFullName()
{
    return $"{FirstName} {LastName}";
}

// After
public string GetFullName() => $"{FirstName} {LastName}";
```

### LINQ Over Loops

```csharp
// Before
var active = new List<User>();
foreach (var user in users)
{
    if (user.IsActive)
    {
        active.Add(user);
    }
}

// After
var active = users.Where(u => u.IsActive).ToList();
```

---

## FlowAccount-Specific .NET Conventions

### Clean Architecture Layers (CRITICAL)

**FlowAccount uses strict 5-layer architecture:**
```
Controller → Facade → Logic → Service → DataHandler
```

**DO NOT suggest changes that violate:**
- ❌ Controllers calling DataHandler directly
- ❌ Facades calling DataHandler directly
- ❌ Logic calling DataHandler directly
- ✅ Only Services may call DataHandler
- ✅ Layers only call lower layers (no upward/peer calls)

### FlowAccount Naming Conventions

**Private/Protected Fields:**
- ✅ MUST start with underscore: `_myField`, `_service`
- ❌ DO NOT flag underscore prefix as issue
- This is FlowAccount standard, not a problem

**Descriptive Names:**
- ✅ Use full, descriptive names
- ❌ No abbreviations or short names
- Example: `customerService` not `custSvc`

### FlowAccount-Specific Patterns to Respect

**Interfaces:**
- All classes MUST implement interfaces (except enums/structs)
- Don't suggest removing interface implementations

**Dependency Injection:**
- Strictly use constructor injection
- NO static services
- Don't suggest static helper classes

**Async Patterns:**
- All I/O-bound operations MUST be async
- Don't suggest removing async/await

---

Apply these patterns to modernize .NET/C# code systematically while respecting FlowAccount conventions.
