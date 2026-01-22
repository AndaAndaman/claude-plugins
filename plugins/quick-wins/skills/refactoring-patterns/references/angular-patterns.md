# Angular Refactoring Patterns

Angular-specific refactoring patterns for modern Angular applications.

## Component Patterns

### OnPush Change Detection

**Pattern**: Use OnPush strategy for better performance

```typescript
// Before
@Component({
  selector: 'app-user',
  template: '...'
})
export class UserComponent { }

// After
@Component({
  selector: 'app-user',
  template: '...',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserComponent { }
```

**Benefits**: Reduces change detection cycles, improves performance

### Async Pipe over Manual Subscriptions

**Pattern**: Use async pipe instead of manual subscribe/unsubscribe

```typescript
// Before
export class UserComponent implements OnInit, OnDestroy {
  user: User;
  private subscription: Subscription;

  ngOnInit() {
    this.subscription = this.userService.getUser()
      .subscribe(user => this.user = user);
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }
}
// Template: {{ user.name }}

// After
export class UserComponent {
  user$ = this.userService.getUser();
}
// Template: {{ (user$ | async)?.name }}
```

**Benefits**: Auto unsubscribe, less boilerplate, reactive

### Standalone Components

**Pattern**: Convert to standalone components (Angular 14+)

```typescript
// Before
@NgModule({
  declarations: [MyComponent],
  imports: [CommonModule, FormsModule],
  exports: [MyComponent]
})
export class MyModule { }

// After
@Component({
  selector: 'app-my',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: '...'
})
export class MyComponent { }
```

## Service Patterns

### HttpClient over Http

**Pattern**: Use modern HttpClient

```typescript
// Before
import { Http } from '@angular/http';

constructor(private http: Http) { }

getData() {
  return this.http.get('/api/data')
    .map(res => res.json());
}

// After
import { HttpClient } from '@angular/common/http';

constructor(private http: HttpClient) { }

getData() {
  return this.http.get<Data[]>('/api/data');
}
```

### Typed HTTP Responses

**Pattern**: Add type parameters to HTTP calls

```typescript
// Before
getData() {
  return this.http.get('/api/users');
}

// After
interface User {
  id: number;
  name: string;
}

getData() {
  return this.http.get<User[]>('/api/users');
}
```

### Injectable providedIn

**Pattern**: Use providedIn for tree-shakeable services

```typescript
// Before
@Injectable()
export class UserService { }

// In module
providers: [UserService]

// After
@Injectable({
  providedIn: 'root'
})
export class UserService { }
```

## Template Patterns

### TrackBy for *ngFor

**Pattern**: Add trackBy for better performance

```typescript
// Before
<div *ngFor="let item of items">
  {{ item.name }}
</div>

// After
<div *ngFor="let item of items; trackBy: trackById">
  {{ item.name }}
</div>

// Component
trackById(index: number, item: Item) {
  return item.id;
}
```

### ng-container over div

**Pattern**: Use ng-container for structural directives

```typescript
// Before
<div *ngIf="condition">
  <div *ngFor="let item of items">
    {{ item }}
  </div>
</div>

// After
<ng-container *ngIf="condition">
  <div *ngFor="let item of items">
    {{ item }}
  </div>
</ng-container>
```

### Safe Navigation

**Pattern**: Use safe navigation operator

```typescript
// Before
<div *ngIf="user">
  {{ user.name }}
</div>

// After
<div>
  {{ user?.name }}
</div>
```

## RxJS Patterns

### Modern RxJS Imports

**Pattern**: Import from rxjs instead of rxjs/operators

```typescript
// Before
import { Observable } from 'rxjs/Observable';
import 'rxjs/add/operator/map';
import 'rxjs/add/operator/filter';

// After
import { Observable } from 'rxjs';
import { map, filter } from 'rxjs/operators';
```

### Pipeable Operators

**Pattern**: Use pipe() with operators

```typescript
// Before
this.data$
  .map(x => x * 2)
  .filter(x => x > 10)
  .subscribe(result => { });

// After
this.data$.pipe(
  map(x => x * 2),
  filter(x => x > 10)
).subscribe(result => { });
```

### takeUntil for Cleanup

**Pattern**: Proper subscription cleanup

```typescript
// Before
ngOnInit() {
  this.obs1.subscribe(/* ... */);
  this.obs2.subscribe(/* ... */);
  this.obs3.subscribe(/* ... */);
}

// After
private destroy$ = new Subject<void>();

ngOnInit() {
  this.obs1.pipe(takeUntil(this.destroy$)).subscribe(/* ... */);
  this.obs2.pipe(takeUntil(this.destroy$)).subscribe(/* ... */);
  this.obs3.pipe(takeUntil(this.destroy$)).subscribe(/* ... */);
}

ngOnDestroy() {
  this.destroy$.next();
  this.destroy$.complete();
}
```

## Type Safety

### Strict Template Type Checking

**Pattern**: Enable strict templates in tsconfig

```json
{
  "angularCompilerOptions": {
    "strictTemplates": true
  }
}
```

### Typed Forms (Angular 14+)

**Pattern**: Use typed reactive forms

```typescript
// Before
form = new FormGroup({
  name: new FormControl(''),
  email: new FormControl('')
});

// After
interface UserForm {
  name: FormControl<string>;
  email: FormControl<string>;
}

form = new FormGroup<UserForm>({
  name: new FormControl('', { nonNullable: true }),
  email: new FormControl('', { nonNullable: true })
});
```

### Component Input/Output Types

**Pattern**: Explicit types for @Input/@Output

```typescript
// Before
@Input() data: any;
@Output() changed = new EventEmitter();

// After
@Input() data: UserData;
@Output() changed = new EventEmitter<string>();
```

## Lifecycle Hooks

### Implement Interfaces

**Pattern**: Implement lifecycle interfaces

```typescript
// Before
export class MyComponent {
  ngOnInit() { }
}

// After
export class MyComponent implements OnInit {
  ngOnInit() { }
}
```

### OnPush with Immutable Updates

**Pattern**: Immutable state updates with OnPush

```typescript
// Before (mutates array)
addItem(item: Item) {
  this.items.push(item); // Won't trigger change detection
}

// After (immutable)
addItem(item: Item) {
  this.items = [...this.items, item]; // Triggers change detection
}
```

## Routing Patterns

### Typed Route Parameters

**Pattern**: Type-safe route parameters

```typescript
// Before
ngOnInit() {
  const id = this.route.snapshot.params['id'];
}

// After
interface RouteParams {
  id: string;
}

ngOnInit() {
  const id = this.route.snapshot.params as RouteParams;
}
```

### Route Resolvers

**Pattern**: Fetch data before route activation

```typescript
// Before (fetch in component)
ngOnInit() {
  this.userService.getUser(this.id).subscribe(user => {
    this.user = user;
  });
}

// After (use resolver)
@Injectable()
export class UserResolver implements Resolve<User> {
  resolve(route: ActivatedRouteSnapshot): Observable<User> {
    return this.userService.getUser(route.params['id']);
  }
}

// Component
ngOnInit() {
  this.user = this.route.snapshot.data['user'];
}
```

## Common Quick Wins

### Remove Unused Imports

```typescript
// Before
import { Component, OnInit, OnDestroy, Input, Output } from '@angular/core';
import { Observable, Subject, BehaviorSubject } from 'rxjs';

// Only using Component, OnInit, Observable

// After
import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
```

### Fix Any Types

```typescript
// Before
processData(data: any) {
  return data.map((item: any) => item.value);
}

// After
interface DataItem {
  value: string;
}

processData(data: DataItem[]) {
  return data.map(item => item.value);
}
```

### Add TrackBy Functions

Identify *ngFor without trackBy:

```typescript
// Template before
<div *ngFor="let item of items">

// Template after
<div *ngFor="let item of items; trackBy: trackById">

// Component
trackById(index: number, item: any) {
  return item.id;
}
```

### Convert to Async Pipe

Find manual subscriptions that can use async pipe:

```typescript
// Before
data: Data;
ngOnInit() {
  this.service.getData().subscribe(data => this.data = data);
}
// Template: {{ data.value }}

// After
data$ = this.service.getData();
// Template: {{ (data$ | async)?.value }}
```

---

Apply these patterns to modernize Angular applications systematically.
