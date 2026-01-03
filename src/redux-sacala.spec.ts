import { applyMiddleware, combineReducers, createStore } from "redux";
import { createReduxBlock } from "./redux-sacala";

interface LocalState {
    count: number;
}

interface MyState {
    local: LocalState;
}

const {
    actions: local,
    reducer: localReducer,
    createMiddleware: createLocalMiddleware,
} = createReduxBlock<MyState, number>()({
    name: "local",
    initial: { count: 0 },
    actions: {
        inc(state) {
            return { count: state.count + 1 };
        },
        set(_, count: number) {
            return { count };
        },
    },
    effects: (dispatch) => ({
        incEffect() {
            dispatch(local.inc());
        },
    }),
});

const createMyStore = () =>
    createStore(
        combineReducers({
            local: localReducer,
        }),
        applyMiddleware(createLocalMiddleware(100)),
    );

describe("Store with reducer and middleware", () => {
    it("Should be updated on action without payload", () => {
        const store = createMyStore();
        store.dispatch(local.inc());
        store.dispatch(local.inc());
        expect(store.getState()).toEqual({ local: { count: 2 } });
    });

    it("Should be updated on action with payload", () => {
        const store = createMyStore();
        store.dispatch(local.set(12));
        expect(store.getState()).toEqual({ local: { count: 12 } });
    });
});
