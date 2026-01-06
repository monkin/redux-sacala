import { Middleware, Reducer, UnknownAction } from "redux";

/**
 * Composable Redux block with state description, action creators, and effects handlers.
 * Use `ReduxBlock.builder` to start building a new block.
 */
export interface ReduxBlock<State, Creators, Context> {
    /**
     * Action creators for this block.
     * When composed, action creators can form a folder tree structure.
     */
    actions: Creators;
    /**
     * Reducer that can be used directly in Redux store configuration.
     */
    reducer: Reducer<State, UnknownAction>;
    /**
     * Effects to be called on effects actions.
     * Use `ReduxBlock.middleware` to create middleware for effects processing.
     */
    effects: Effects<Context>;
}

type PayloadAction<Type extends string, Payload extends unknown[]> = Payload extends never[]
    ? { type: Type }
    : { type: Type; payload: Payload };

/**
 * Checks if the given key exists directly on the provided object.
 */
function has<K extends string | symbol>(v: unknown, k: K): v is Record<K, unknown> {
    return typeof v === "object" && v !== null && Object.hasOwn(v, k);
}

const creator = (scope: string) =>
    new Proxy(
        {},
        {
            get(target, property) {
                if (has(target, property)) {
                    return target[property];
                }

                return (...payload: unknown[]) => {
                    const type = `${scope}/${property as string}`;
                    return payload.length ? { type, payload } : { type };
                };
            },
        },
    ) as Record<string, (...payload: unknown[]) => UnknownAction>;

/**
 * Effects creator. It receives context with side effect APIs and returns non-pure handlers.
 */
type Effects<Context> = (context: Context) => Record<string, (...payload: unknown[]) => void>;

/**
 * Convert effects type to action creators.
 */
type EffectsToCreators<Name extends string, E extends Effects<any>> = {
    [K in keyof ReturnType<E> as `${Name}/${K extends string ? K : never}`]: (
        ...parameters: Parameters<ReturnType<E>[K]>
    ) => PayloadAction<`${Name}/${K extends string ? K : never}`, Parameters<ReturnType<E>[K]>>;
};

class BlockBuilder<
    Name extends string,
    State,
    Creators extends Record<string, (...parameters: unknown[]) => PayloadAction<any, any>>,
    Context,
> {
    private constructor(
        readonly name: Name,
        readonly initial: State,
        /**
         * Per-message action reducers for this block.
         */
        private readonly reducers: Record<string, (state: State, ...payload: unknown[]) => State>,
        /**
         * Effects handlers for this block.
         */
        private readonly handlers: Effects<Context>[],
    ) {}

    static init<Name extends string, State>(name: Name, initial: State): BlockBuilder<Name, State, {}, {}> {
        return new BlockBuilder(name, initial, {}, []);
    }

    /**
     * Append an action handler to the block.
     * Action is a pure function that takes the state + arguments and returns a new state.
     */
    action<Action extends string, Payload extends unknown[] = []>(
        action: Action,
        handler: (state: State, ...payload: Payload) => State,
    ): BlockBuilder<
        Name,
        State,
        Creators & Record<Action, (...payload: Payload) => PayloadAction<`${Name}/${Action}`, Payload>>,
        Context
    > {
        this.reducers[`${this.name}/${action}`] = handler as (state: State, ...payload: unknown[]) => State;
        return this as any;
    }

    /**
     * Append effect handlers to the block.
     * Effects can call any side effects provided from the context.
     */
    effects<E extends Effects<unknown>>(
        effects: E,
    ): BlockBuilder<
        Name,
        State,
        Creators & EffectsToCreators<Name, E>,
        Context & (E extends Effects<infer C> ? C : never)
    > {
        this.handlers.push(effects);
        return this as any;
    }

    build(): ReduxBlock<State, Creators, Context> {
        const initialState = this.initial;
        const blockName = this.name;
        return {
            actions: creator(this.name),
            effects: (context: Context) =>
                this.handlers.reduce(
                    (acc, effect) =>
                        Object.assign(
                            acc,
                            Object.fromEntries(
                                Object.entries(effect(context)).map(([effectName, handler]) => [
                                    `${blockName}/${effectName}`,
                                    handler,
                                ]),
                            ),
                        ),
                    {} as Record<string, (...payload: unknown[]) => void>,
                ),
            reducer: (state = initialState, action: UnknownAction) => {
                const handler = this.reducers[action.type];
                if (!handler) return state;
                const payload = "payload" in action ? (action.payload as unknown[]) : undefined;
                return payload && payload.length ? handler(state, ...payload) : handler(state);
            },
        } as any;
    }
}

class CompositionBuilder<
    Name extends string,
    BlockMap extends Record<string, ReduxBlock<any, any, any>>,
    Creators,
    Context,
> {
    private blocks: BlockMap = {} as BlockMap;
    private handlers: Effects<Context>[] = [];
    private creators: Creators;

    private constructor(private name: Name) {
        this.creators = creator(name) as Creators;
    }

    static init<Name extends string>(name: Name): CompositionBuilder<Name, {}, {}, {}> {
        return new CompositionBuilder(name);
    }

    block<Name extends string, Block extends ReduxBlock<any, any, any>>(
        name: Name,
        block: Block,
    ): CompositionBuilder<
        Name,
        BlockMap & Record<Name, Block>,
        Creators & Record<Name, ReduxBlock.TakeCreators<Block>>,
        Context & ReduxBlock.TakeContext<Block>
    > {
        (this.blocks as Record<string, ReduxBlock<any, any, any>>)[name] = block;
        (this.creators as Record<string, unknown>)[name] = block.actions;
        return this as any;
    }

    effects<E extends Effects<any>>(
        effects: E,
    ): CompositionBuilder<
        Name,
        BlockMap,
        Creators & EffectsToCreators<Name, E>,
        Context & (E extends Effects<infer ExtraContext> ? ExtraContext : never)
    > {
        (this.handlers as (Effects<Context> | E)[]).push(effects);
        return this as any;
    }

    build(): ReduxBlock<{ [K in keyof BlockMap]: ReduxBlock.TakeState<BlockMap[K]> }, Creators, Context> {
        const reducers = Object.entries(this.blocks).map(([name, block]) => [name, block.reducer] as const);
        return {
            actions: this.creators,
            effects: (context: Context) => {
                const result = this.handlers.reduce(
                    (effects, handlers) => Object.assign(effects, handlers(context)),
                    {} as Record<string, (...payload: unknown[]) => void>,
                );
                Object.values(this.blocks).forEach((block) => Object.assign(result, block.effects(context)));
                return result;
            },
            reducer: (state: any, action: UnknownAction) => {
                let result = state;
                let changed = false;
                reducers.forEach(([name, reducer]) => {
                    const original = result[name];
                    const updated = reducer(original, action);
                    if (updated !== original) {
                        if (!changed) {
                            changed = true;
                            result = { ...result };
                        }
                        result[name] = updated;
                    }
                });
                return result;
            },
        } as any;
    }
}

export namespace ReduxBlock {
    type AnyBlock = ReduxBlock<any, any, any>;

    export type TakeState<Block extends AnyBlock> = Block extends ReduxBlock<infer State, any, any> ? State : never;
    export type TakeCreators<Block extends AnyBlock> =
        Block extends ReduxBlock<any, infer Creators, any> ? Creators : never;
    export type TakeContext<Block extends AnyBlock> =
        Block extends ReduxBlock<any, any, infer Context> ? Context : never;

    /**
     * Create a block builder.
     * It's a starting point for creating a block.
     */
    export function builder<Name extends string, State>(name: Name, initial: State): BlockBuilder<Name, State, {}, {}> {
        return BlockBuilder.init(name, initial);
    }

    /**
     * Create a composition builder.
     */
    export function composition<Name extends string>(name: Name): CompositionBuilder<Name, {}, {}, {}> {
        return CompositionBuilder.init(name);
    }

    /**
     * Create middleware for effects processing.
     * It expects to receive a context object that provides necessary dependencies for effect handlers.
     */
    export function middleware<Block extends AnyBlock>(block: Block, context: TakeContext<Block>): Middleware {
        const effects = block.effects(context);
        return () => (next) => (action) => {
            if (action && typeof action === "object" && "type" in action && has(effects, action.type as string)) {
                effects[action.type as string](...("payload" in action ? (action.payload as unknown[]) : []));
            }
            next(action);
        };
    }
}
