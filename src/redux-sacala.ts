import { Action, Middleware, Reducer, UnknownAction } from "redux";

export interface ReduxBlock<State, ActionType extends Action, Creators, Context> {
    actions: Creators;
    reducer: Reducer<State, ActionType>;
    effects: Effects<Context>;
}

const creator = (scope: string) =>
    new Proxy(
        {},
        {
            get(_target, property) {
                return (...payload: unknown[]) => {
                    const type = `${scope}/${property as string}`;
                    return payload.length ? { type, payload } : { type };
                };
            },
        },
    ) as Record<string, (...payload: unknown[]) => UnknownAction>;

type UnionToIntersection<U> = (U extends any ? (x: U) => void : never) extends (x: infer I) => void ? I : never;

type Effects<Context> = (context: Context) => Record<string, (...payload: unknown[]) => void>;
type Composition<Blocks extends Record<string, ReduxBlock<any, any, any, any>>> = ReduxBlock<
    {
        [K in keyof Blocks]: ReduxBlock.TakeState<Blocks[K]>;
    },
    ReduxBlock.TakeActions<Blocks[string]>,
    {
        [K in keyof Blocks]: ReduxBlock.TakeCreators<Blocks[K]>;
    },
    UnionToIntersection<ReduxBlock.TakeContext<Blocks[string]>>
>;

class Builder<Name extends string, State, Actions extends UnknownAction, Context> {
    private constructor(
        readonly name: Name,
        readonly initial: State,
        private readonly handlers: Record<Actions["type"], (state: State, payload: unknown[]) => State>,
        private readonly effects: Effects<Context>[],
    ) {}

    static init<Name extends string, State>(name: Name, initial: State): Builder<Name, State, never, {}> {
        return new Builder(name, initial, {}, []);
    }
}

export namespace ReduxBlock {
    type Any = ReduxBlock<any, any, any, any>;

    export type TakeState<Block extends Any> = Block extends ReduxBlock<infer State, any, any, any> ? State : never;
    export type TakeActions<Block extends Any> =
        Block extends ReduxBlock<any, infer Actions, any, any> ? Actions : never;
    export type TakeCreators<Block extends Any> =
        Block extends ReduxBlock<any, any, infer Creators, any> ? Creators : never;
    export type TakeContext<Block extends Any> =
        Block extends ReduxBlock<any, any, any, infer Context> ? Context : never;

    /**
     * Create a block builder.
     * It's a starting point for creating a block.
     */
    export function builder<Name extends string, State>(name: Name, initial: State): Builder<Name, State, never, {}> {
        return Builder.init(name, initial);
    }

    /**
     * Compose blocks into one structured block
     */
    export function compose<Blocks extends Record<string, Any>>(blocks: Blocks): Composition<Blocks> {
        const reducers = Object.entries(blocks).map(([name, block]) => [name, block.reducer] as const);

        return {
            actions: Object.fromEntries(Object.entries(blocks).map(([name, block]) => [name, block.actions])),
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
            effects: (context: any) =>
                Object.values(blocks).reduce(
                    (effects, block) => Object.assign(effects, block.effects(context)),
                    {} as Record<string, (...payload: unknown[]) => void>,
                ),
        } as unknown as Composition<Blocks>;
    }

    /**
     * Create middleware for effects processing
     */
    export function middleware<Block extends Any>(block: Block, context: TakeContext<Block>): Middleware {
        const effects = block.effects(context);
        return () => (next) => (action) => {
            if (
                action &&
                typeof action === "object" &&
                "type" in action &&
                Object.prototype.hasOwnProperty.call(effects, action.type as string)
            ) {
                effects[action.type as string](...("payload" in action ? (action.payload as unknown[]) : []));
            }
            next(action);
        };
    }
}
