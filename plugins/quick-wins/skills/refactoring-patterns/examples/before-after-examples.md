# Before-After Refactoring Examples

Real-world refactoring examples showing quick wins.

## Example 1: TypeScript Service Cleanup

### Before (Multiple Issues)

```typescript
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, Subject, BehaviorSubject } from 'rxjs';
import { map, filter, catchError } from 'rxjs/operators';

@Injectable()
export class UserService {
    private apiUrl = 'http://api.example.com/users';

    constructor(private http: HttpClient) {
        console.log('UserService initialized');
    }

    getUsers(): Observable<any> {
        return this.http.get(this.apiUrl).pipe(
            map(response => response),
            catchError(error => {
                console.log('Error:', error);
                throw error;
            })
        );
    }

    getUserById(id): Observable<any> {
        var url = this.apiUrl + '/' + id;
        return this.http.get(url);
    }

    createUser(user: any): Observable<any> {
        return this.http.post(this.apiUrl, user);
    }
}
```

### After (Quick Wins Applied)

```typescript
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

interface User {
    id: number;
    name: string;
    email: string;
}

@Injectable({
    providedIn: 'root'
})
export class UserService {
    private readonly apiUrl = 'https://api.example.com/users';

    constructor(private http: HttpClient) {}

    getUsers(): Observable<User[]> {
        return this.http.get<User[]>(this.apiUrl);
    }

    getUserById(id: number): Observable<User> {
        const url = `${this.apiUrl}/${id}`;
        return this.http.get<User>(url);
    }

    createUser(user: Omit<User, 'id'>): Observable<User> {
        return this.http.post<User>(this.apiUrl, user);
    }
}
```

### Changes Made (5 minutes)
1. ✅ Removed unused imports (Subject, BehaviorSubject, HttpHeaders, filter)
2. ✅ Removed console.log statements
3. ✅ Added providedIn: 'root'
4. ✅ Fixed HTTP to HTTPS
5. ✅ Replaced 'any' with User interface
6. ✅ Changed var to const
7. ✅ Used template literal for URL
8. ✅ Added readonly to apiUrl
9. ✅ Removed unnecessary map operator
10. ✅ Added proper type to getUserById parameter

---

## Example 2: Angular Component Refactoring

### Before

```typescript
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { UserService } from './user.service';

@Component({
    selector: 'app-user-list',
    template: `
        <div *ngFor="let user of users">
            <div *ngIf="user.active">
                {{ user.name }}
            </div>
        </div>
    `
})
export class UserListComponent implements OnInit, OnDestroy {
    users: any[] = [];
    private subscription: Subscription;

    constructor(private userService: UserService) {
        console.log('Component created');
    }

    ngOnInit() {
        this.subscription = this.userService.getUsers().subscribe(users => {
            this.users = users;
        });
    }

    ngOnDestroy() {
        if (this.subscription) {
            this.subscription.unsubscribe();
        }
    }
}
```

### After

```typescript
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserService } from './user.service';

interface User {
    id: number;
    name: string;
    active: boolean;
}

@Component({
    selector: 'app-user-list',
    standalone: true,
    imports: [CommonModule],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <ng-container *ngFor="let user of users$ | async; trackBy: trackById">
            <div *ngIf="user.active">
                {{ user.name }}
            </div>
        </ng-container>
    `
})
export class UserListComponent {
    users$ = this.userService.getUsers();

    constructor(private userService: UserService) {}

    trackById(index: number, user: User): number {
        return user.id;
    }
}
```

### Changes Made (4 minutes)
1. ✅ Removed unused imports (OnInit, OnDestroy, Subscription)
2. ✅ Removed console.log
3. ✅ Converted to standalone component
4. ✅ Added OnPush change detection
5. ✅ Used async pipe instead of manual subscription
6. ✅ Removed manual unsubscribe logic
7. ✅ Added User interface
8. ✅ Added trackBy function
9. ✅ Used ng-container instead of div
10. ✅ Simplified component logic significantly

---

## Example 3: C# API Controller

### Before

```csharp
using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

[ApiController]
[Route("api/[controller]")]
public class UsersController : ControllerBase
{
    private UserService _userService;

    public UsersController(UserService userService)
    {
        _userService = userService;
    }

    [HttpGet]
    public ActionResult<IEnumerable<object>> GetUsers()
    {
        var users = _userService.GetUsers().Result;
        var result = new List<object>();
        foreach (var user in users)
        {
            if (user.IsActive == true)
            {
                result.Add(new
                {
                    Id = user.Id,
                    Name = user.FirstName + " " + user.LastName
                });
            }
        }
        return Ok(result);
    }

    [HttpGet("{id}")]
    public ActionResult<object> GetUser(int id)
    {
        var user = _userService.GetUser(id).Result;
        if (user == null)
        {
            return NotFound();
        }
        return Ok(user);
    }

    [HttpPost]
    public ActionResult<object> CreateUser(User user)
    {
        if (user.FirstName == null || user.LastName == null)
        {
            return BadRequest("Name is required");
        }
        var created = _userService.CreateUser(user).Result;
        return CreatedAtAction(nameof(GetUser), new { id = created.Id }, created);
    }
}
```

### After

```csharp
using Microsoft.AspNetCore.Mvc;

[ApiController]
[Route("api/[controller]")]
public class UsersController : ControllerBase
{
    private readonly IUserService _userService;

    public UsersController(IUserService userService)
    {
        _userService = userService;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<UserDto>>> GetUsers()
    {
        var users = await _userService.GetUsersAsync();
        var result = users
            .Where(user => user.IsActive)
            .Select(user => new UserDto
            {
                Id = user.Id,
                Name = $"{user.FirstName} {user.LastName}"
            });
        return Ok(result);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<User>> GetUser(int id)
    {
        var user = await _userService.GetUserAsync(id);
        return user == null ? NotFound() : Ok(user);
    }

    [HttpPost]
    public async Task<ActionResult<User>> CreateUser(CreateUserRequest request)
    {
        if (string.IsNullOrEmpty(request.FirstName) || string.IsNullOrEmpty(request.LastName))
            return BadRequest("Name is required");

        var created = await _userService.CreateUserAsync(request);
        return CreatedAtAction(nameof(GetUser), new { id = created.Id }, created);
    }
}

public record UserDto(int Id, string Name);
public record CreateUserRequest(string FirstName, string LastName);
```

### Changes Made (5 minutes)
1. ✅ Removed unused imports
2. ✅ Made _userService readonly
3. ✅ Changed to interface (IUserService)
4. ✅ Converted blocking .Result to async/await
5. ✅ Replaced foreach with LINQ
6. ✅ Used string interpolation
7. ✅ Replaced object with proper DTOs
8. ✅ Improved null handling with ternary operator
9. ✅ Better null checks with string.IsNullOrEmpty
10. ✅ Created specific request/response types

---

## Example 4: TypeScript Error Handling

### Before

```typescript
function processUserData(userId: string) {
    const user = fetchUser(userId);
    const profile = fetchProfile(userId);
    const settings = fetchSettings(userId);

    return {
        user: user,
        profile: profile,
        settings: settings
    };
}

async function saveData(data: any) {
    const response = await api.post('/save', data);
    return response.data;
}
```

### After

```typescript
interface UserData {
    user: User;
    profile: Profile;
    settings: Settings;
}

async function processUserData(userId: string): Promise<UserData> {
    try {
        const [user, profile, settings] = await Promise.all([
            fetchUser(userId),
            fetchProfile(userId),
            fetchSettings(userId)
        ]);

        return { user, profile, settings };
    } catch (error) {
        console.error(`Failed to process user data for ${userId}:`, error);
        throw new Error(`Unable to load user data: ${error.message}`);
    }
}

async function saveData(data: SaveRequest): Promise<SaveResponse> {
    try {
        const response = await api.post<SaveResponse>('/save', data);
        return response.data;
    } catch (error) {
        console.error('Save operation failed:', error);
        throw new Error(`Failed to save data: ${error.message}`);
    }
}
```

### Changes Made (3 minutes)
1. ✅ Added proper error handling (try-catch)
2. ✅ Made functions async
3. ✅ Used Promise.all for parallel execution
4. ✅ Added proper types instead of 'any'
5. ✅ Used object property shorthand
6. ✅ Added meaningful error messages
7. ✅ Added proper return types

---

## Summary of Common Quick Wins

### Always Quick Wins (1-2 min each)
- Remove unused imports
- Delete console.log/debugger
- Fix 'any' types with proper interfaces
- Convert var to const/let
- Use string interpolation
- Add missing error handling

### Usually Quick Wins (3-5 min each)
- Convert to async/await
- Add OnPush change detection
- Use async pipe
- Apply LINQ transformations
- Extract repeated code
- Add trackBy functions

### Context-Dependent (5-10 min)
- Major refactoring
- Performance optimizations
- Architecture changes
