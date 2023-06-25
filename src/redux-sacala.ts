import { Dispatch, Action, Reducer, Middleware, AnyAction, Store, MiddlewareAPI } from "redux";

type UnknownToUndefined<T> = unknown extends T ? undefined : T;

type FirstArgument<F> = F extends (arg1: infer U, ...args: any[]) => any ? UnknownToUndefined<U> : undefined;
type SecondArgument<F> = F extends (arg1: any, arg2: infer U, ...args: any[]) => any ? UnknownToUndefined<U> : undefined;

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
type EffectsMap<GlobalState, ExtraArgument> = (dispatch: Dispatch, getState: () => GlobalState) => { [effect: string]: (payload: any, extraArgument: ExtraArgument) => any }

// Output
type ActionCreator<Handler extends ActionHandler<any, any>> = undefined extends SecondArgument<Handler>
    ? () => Action<string>
    : (payload: SecondArgument<Handler>) => (Action<string> & { payload: SecondArgument<Handler> });

type ActionCreatorMap<Actions extends ActionMap<any>> = {
    [name in keyof Actions]: ActionCreator<Actions[name]>;
};

type EffectsCreatorMap<GlobalState, ExtraArgument, Map extends EffectsMap<GlobalState, ExtraArgument>> = {
    [key in keyof ReturnType<Map>]: (undefined extends FirstArgument<ReturnType<Map>[key]>
        ? () => Action
        : (payload: FirstArgument<ReturnType<Map>[key]>) => Action
    );
};

// Transformation
function createActionCreator(type: string) {
    return (payload?: any) => payload === undefined ? { type } : { type, payload };
}
function createEffectCreator(type: string) {
    return (payload: any) => ({ type, payload })
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

type MiddlewareCreator<T> = T extends undefined ? () => Middleware : (argument: T) => Middleware;

function createMiddlewareCreator<GlobalState, ExtraArgument>(prefix: string, effectsMap: EffectsMap<GlobalState, ExtraArgument>): MiddlewareCreator<ExtraArgument> {
    return ((argument: ExtraArgument) => (store: MiddlewareAPI) => {
        const effects = appendPrefix(prefix + "/", bindAll(effectsMap(store.dispatch, store.getState)));
        return (next: Dispatch) => (action: Action<string> & { payload: any[] }) => {
            if (action && effects.hasOwnProperty(action.type)) {
                effects[action.type](action.payload, argument);
            } else {
                next(action);
            }
        };
    }) as MiddlewareCreator<ExtraArgument>;
}

function fail(): never {
    throw new Error("Can't have access to 'dispatch' and 'getState' during initialization");
}

export function createReduxBlock<GlobalState, ExtraArgument = undefined>() {
    return function applyConfig<
        Name extends (keyof GlobalState) & string,
        Actions extends ActionMap<GlobalState[Name]>,
        Effects extends EffectsMap<GlobalState, ExtraArgument>
    >({ name, initial, actions, effects }: {
        name: Name;
        initial: GlobalState[Name];
        actions: Actions;
        effects?: Effects;
    }): {
        name: Name;
        reducer: Reducer<GlobalState[Name]>;
        createMiddleware: MiddlewareCreator<ExtraArgument>;
        actions: ActionCreatorMap<Actions> & EffectsCreatorMap<GlobalState, ExtraArgument, Effects>;
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
            createMiddleware: effects
                ? createMiddlewareCreator<GlobalState, ExtraArgument>(name as string, effects)
                : (() => ((_: MiddlewareAPI) => (next: Dispatch) => next)) as MiddlewareCreator<ExtraArgument>,
            actions: {
                ...actionCreators,
                ...effectCreators
            }
        };
    }
}
