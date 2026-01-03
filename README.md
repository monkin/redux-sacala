# redux-sacala

A lightweight utility to create Redux blocks with minimal boilerplate, featuring type-safe actions, reducers, and side effects.

## Features

- **Minimal Boilerplate**: Define actions and reducers in one place.
- **Type Safety**: Full TypeScript support for state and action payloads.
- **Integrated Side Effects**: Middleware-based effects that have access to `dispatch` and `getState`.
- **Ducks Pattern**: Encourages grouping related logic together.
- **Extra Arguments**: Inject dependencies into your effects via middleware.

## Installation

```bash
npm install redux-sacala
```

*Note: `redux` is a peer dependency.*

## Usage Example

### 1. Create a Redux Block

```typescript
import { createReduxBlock } from 'redux-sacala';

interface CounterState {
  count: number;
}

interface RootState {
  counter: CounterState;
}

// Define the block
const {
  actions,
  reducer,
  createMiddleware
} = createReduxBlock<RootState, { logger: (msg: string) => void }>()({
  name: 'counter',
  initial: { count: 0 },
  actions: {
    increment(state) {
      return { count: state.count + 1 };
    },
    setCount(state, payload: number) {
      return { count: payload };
    }
  },
  effects: (dispatch, getState) => ({
    asyncIncrement(payload: number, { logger }) {
      logger('Starting async increment');
      setTimeout(() => {
        dispatch(actions.increment());
        logger('Incremented');
      }, payload);
    }
  })
});

export { actions, reducer, createMiddleware };
```

### 2. Configure the Store

```typescript
import { createStore, combineReducers, applyMiddleware } from 'redux';
import { reducer, createMiddleware } from './counterBlock';

const rootReducer = combineReducers({
  counter: reducer
});

// Create middleware with extra argument
const counterMiddleware = createMiddleware({
  logger: (msg) => console.log(msg)
});

const store = createStore(
  rootReducer,
  applyMiddleware(counterMiddleware)
);
```

### 3. Dispatch Actions

```typescript
// These are type-safe
store.dispatch(actions.increment());
store.dispatch(actions.setCount(10));
store.dispatch(actions.asyncIncrement(1000)); // Delay of 1000ms
```

## API

### `createReduxBlock<GlobalState, ExtraArgument = undefined>()(options)`

Creates a Redux block. The double-call pattern is used for better TypeScript type inference.

#### Options
- `name`: `string`. The key under which the state is stored in the global state. Must match a key in `GlobalState`.
- `initial`: `GlobalState[name]`. The initial state of the block.
- `actions`: An object where each key is an action name and each value is a state handler: `(state: BlockState, payload: any) => BlockState`.
- `effects`: (Optional) A function `(dispatch, getState) => effectsMap`.
    - `effectsMap` keys are action types.
    - `effectsMap` values are effect handlers: `(payload: any, extraArgument: ExtraArgument) => void`.

#### Returns
- `name`: The name of the block.
- `reducer`: The Redux reducer for this block.
- `actions`: An object containing action creators for both `actions` and `effects`.
- `createMiddleware`: A function `(extraArgument: ExtraArgument) => Middleware` to create the Redux middleware for handling the effects.

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build the project
npm run build

# Lint the code
npm run lint
```

## License

Author: Andrey Monkin (monkin.andrey@gmail.com)
