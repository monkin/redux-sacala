# Redux Sacala

A library for creating composable Redux blocks with state, actions, and effects.

## Terms Definition

- **ReduxBlock**: A composable unit of Redux logic that encapsulates state, action creators, and effect handlers. It provides a structured way to define how state changes and how side effects are handled.
- **Action**: A pure function that describes how the state changes in response to an event. In `redux-sacala`, actions are defined using `.action()` and they also serve as action creators.
- **Effect**: A non-pure handler that can perform side effects such as asynchronous API calls, logging, or dispatching other actions. Effects are defined using `.effects()` and have access to a context object providing necessary dependencies.
- **Selector**: A pure function that takes the state and returns a derived value. Selectors are defined using `.selectors()` and can be accessed via `.select`. For memoization, it is recommended to use `createSelector` from `@reduxjs/toolkit`. In compositions, selectors from child blocks are automatically "lifted" and available under the block's name.

## Examples

### Simple Block with Actions

```typescript
import { ReduxBlock } from "redux-sacala";

const counterBlock = ReduxBlock.builder("counter", 0)
    .action("inc", (state: number) => state + 1)
    .action("add", (state: number, value: number) => state + value)
    .build();

// Usage:
// counterBlock.actions.inc() -> { type: "counter/inc" }
// counterBlock.actions.add(5) -> { type: "counter/add", payload: [5] }
```

### Block with Effects

```typescript
interface User { id: string; name: string; }

interface UserContext {
    fetchUser: (id: string) => Promise<User>;
    dispatch: (action: any) => void;
}

const userBlock = ReduxBlock.builder("user", { data: null as User | null, loading: false })
    .action("setLoading", (state, loading: boolean) => ({ ...state, loading }))
    .action("setData", (state, data: User) => ({ ...state, data, loading: false }))
    .effects((ctx: UserContext) => ({
        loadUser: async (id: string) => {
            ctx.dispatch(userBlock.actions.setLoading(true));
            const data = await ctx.fetchUser(id);
            ctx.dispatch(userBlock.actions.setData(data));
        }
    }))
    .build();
```

### Blocks Composition

```typescript
const rootBlock = ReduxBlock.composition("root")
    .block("counter", counterBlock)
    .block("user", userBlock)
    .build();

// rootBlock.actions.counter.inc()
// rootBlock.actions.user.loadUser("123")
```

### Blocks Composition with an Extra Effect

```typescript
const rootBlock = ReduxBlock.composition("root")
    .block("counter", counterBlock)
    .effects((ctx: { logger: (msg: string) => void, dispatch: (a: any) => void }) => ({
        logAndIncrement: () => {
            ctx.logger("Incrementing counter");
            ctx.dispatch(rootBlock.actions.counter.inc());
        }
    }))
    .build();

// Usage:
// rootBlock.actions.counter.inc()
// rootBlock.actions.counter.add(5)
// rootBlock.actions.logAndIncrement()
```

### Selectors

Selectors allow you to extract and derive data from the state. They are defined using `.selectors()` and are available on the `.select` property of the built block.

```typescript
const counterBlock = ReduxBlock.builder("counter", { count: 0 })
    .action("inc", (state) => ({ count: state.count + 1 }))
    .selectors({
        count: (state) => state.count,
        doubleCount: (state) => state.count * 2,
    })
    .build();

// Usage:
// counterBlock.select.count({ count: 5 }) -> 5
// counterBlock.select.doubleCount({ count: 5 }) -> 10
```

For complex or expensive derivations, it is recommended to use `createSelector` from `@reduxjs/toolkit` (or `reselect`) to enable memoization:

```typescript
import { createSelector } from '@reduxjs/toolkit';

const counterBlock = ReduxBlock.builder("counter", { count: 0 })
    .selectors({
        count: (state) => state.count,
        // Memoized selector using createSelector
        tripleCount: createSelector(
            [(state: { count: number }) => state.count],
            (count) => count * 3
        ),
    })
    .build();
```

When blocks are composed, their selectors are automatically "lifted" to work with the composition's state.

```typescript
const rootBlock = ReduxBlock.composition("root")
    .block("counter", counterBlock)
    .selectors({
        isPositive: (state) => state.counter.count > 0,
    })
    .build();

// Lifted selector from counterBlock:
// rootBlock.select.counter.count({ counter: { count: 5 } }) -> 5

// Composition selector:
// rootBlock.select.isPositive({ counter: { count: 5 } }) -> true
```

### Context Mapping

You can change the context shape of a block using `ReduxBlock.mapContext`. This is useful when you want to adapt a block to a different environment or use a more convenient context structure.

```typescript
interface OldContext {
    log: {
        error: (msg: string) => void;
        info: (msg: string) => void;
    };
}

const block = ReduxBlock.builder("test", { message: "" })
    .effects((ctx: OldContext) => ({
        logError: (msg: string) => ctx.log.error(msg),
    }))
    .build();

interface NewContext {
    log: (level: "error" | "info", msg: string) => void;
}

const mappedBlock = ReduxBlock.mapContext(
    block,
    (ctx: NewContext): OldContext => ({
        log: {
            error: (msg) => ctx.log("error", msg),
            info: (msg) => ctx.log("info", msg),
        },
    }),
);

// Now mappedBlock expects NewContext
```

### Selector Mapping

You can adapt a block's selectors to work with a different state shape using `ReduxBlock.mapSelectors`. This is useful when you want to embed a block as part of a larger state structure or reuse a block with different state organization.

```typescript
const counterBlock = ReduxBlock.builder("counter", { count: 0 })
    .action("inc", (state) => ({ count: state.count + 1 }))
    .selectors({
        count: (state) => state.count,
        doubleCount: (state) => state.count * 2,
    })
    .build();

// Original selector expects { count: number }
// counterBlock.select.count({ count: 5 }) -> 5

// Map selectors to work with a different state shape
interface AppState {
    myCounter: { count: number };
}

const mappedBlock = ReduxBlock.mapSelectors(
    counterBlock,
    (state: AppState) => state.myCounter
);

// Now selectors expect AppState
// mappedBlock.select.count({ myCounter: { count: 5 } }) -> 5
// mappedBlock.select.doubleCount({ myCounter: { count: 5 } }) -> 10
```

Note: In most cases, compositions handle selector lifting automatically. Use `mapSelectors` when you need explicit control over how selectors access state, such as when integrating with existing Redux stores or creating reusable blocks.

### Minimal Redux Toolkit Example

```typescript
import { configureStore } from '@reduxjs/toolkit';
import { ReduxBlock } from "redux-sacala";

const store = configureStore({
    reducer: rootBlock.reducer,
    middleware: (getDefaultMiddleware) => 
        getDefaultMiddleware().concat(
            ReduxBlock.middleware(rootBlock, {
                dispatch: (action) => store.dispatch(action),
                logger: console.log,
                fetchUser: async (id) => ({ id, name: "John Doe" })
            })
        ),
});
```

## License

MIT
