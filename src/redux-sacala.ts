import { Dispatch, Action, Reducer, Middleware, AnyAction, Store, MiddlewareAPI } from "redux";

type NotEmpty<X> = {} extends X ? never : X;

type Arguments<F> = F extends (...args: infer U) => any ? U : never;
type FirstArgument<F> = NotEmpty<F extends (arg1: infer U) => any ? U : never>;
type SecondArgument<F> = NotEmpty<F extends (arg1: any, arg2: infer U) => any ? U : never>;

function bindAll<T extends { [key: string]: Function }>(map: T): T {
    const result = {} as any as T;
    for (const i in map) {
        result[i] = map[i].bind(map);
    }
    return result;
}

function appendPrefix<T>(prefix: string, map: { [key: string]: T }) {
    const r: { [key: string]: any } = {};
    for (const i in map) {
        r[prefix + i] = map[i];
    }
    return r;
}

// Input
type ActionHandler<BlockState, Payload> = (state: BlockState, payload: Payload) => BlockState;
type ActionMap<BlockState> = { [action: string]: ActionHandler<BlockState, any> };
type EffectsMap<GlobalState> = (dispatch: Dispatch, getState: () => GlobalState) => { [effect: string]: (...args: any[]) => any }

// Output
type ActionCreator<Handler extends ActionHandler<any, any>> = SecondArgument<Handler> extends never
    ? () => Action<string>
    : (payload: SecondArgument<Handler>) => Action<string> & { payload: SecondArgument<Handler> };
type ActionCreatorMap<Actions extends ActionMap<any>> = {
    [name in keyof Actions]: ActionCreator<Actions[name]>;
};
type EffectsCreatorMap<GlobalState, Map extends EffectsMap<GlobalState>> = {
    [key in keyof ReturnType<Map>]: (...args: Arguments<ReturnType<Map>[key]>) => Action & {
        payload: Arguments<ReturnType<Map>[key]>;
    };
};

// Transformation
function createActionCreator(type: string) {
    return (payload?: any) => payload === undefined ? { type } : { type, payload };
}
function createEffectCreator(type: string) {
    return (...payload: any[]) => ({ type, payload })
}
function createReducer<BlockState>(prefix: string, initial: BlockState, actionMap: ActionMap<BlockState>): Reducer {
    const actions: ActionMap<BlockState> = appendPrefix(prefix + "/", bindAll(actionMap));
    return (state: BlockState = initial, action?: AnyAction) => {
        if (action && action.type) {
            const handler: (state: BlockState, payload?: any) => BlockState = actions[action.type];
            if (handler) {
                return handler(state, action.payload);
            } else {
                return state;
            }
        } else {
            return state;
        }
    }
}
function createMiddleware<GlobalState>(prefix: string, effectsMap: EffectsMap<GlobalState>): Middleware {
    return (store: MiddlewareAPI) => {
        const effects = appendPrefix(prefix + "/", bindAll(effectsMap(store.dispatch, store.getState)));
        return (next: Dispatch) => (action: Action<string> & { payload: any[] }) => {
            if (action && effects.hasOwnProperty(action.type)) {
                effects[action.type].apply(null, action.payload);
            } else {
                next(action);
            }
        };
    };
}

function fail(): never {
    throw new Error("Can't have ave access to 'dispatch' and 'getState' during initialization");
}

export function createReduxBlock<GlobalState>() {
    return function applyConfig<
        Name extends keyof GlobalState,
        Actions extends ActionMap<GlobalState[Name]>,
        Effects extends EffectsMap<GlobalState>
    >({ name, initial, actions, effects }: {
        name: Name;
        initial: GlobalState[Name];
        actions: Actions;
        effects?: Effects;
    }): {
        name: Name;
        reducer: Reducer<GlobalState[Name]>;
        middleware: Middleware;
        actions: ActionCreatorMap<Actions> & EffectsCreatorMap<GlobalState, Effects>;
    } {
        const actionCreators = Object.keys(actions).reduce((r, key) => {
            r[key] = createActionCreator(`${name}/${key}`);
            return r;
        }, {} as any);
        const effectCreators = Object.keys(effects ? effects(fail, fail) : {}).reduce((r, key) => {
            r[key] = createEffectCreator(`${name}/${key}`);
            return r;
        }, {} as any);
    
        return {
            name,
            reducer: createReducer(name as string, initial, actions),
            middleware: effects ? createMiddleware(name as string, effects) : ((_: MiddlewareAPI) => (next: Dispatch) => next),
            actions: {
                ...actionCreators,
                ...effectCreators
            }
        };
    }
}
