import { createReduxBlock } from "./redux-sacala";

interface LocalState {
    flag: boolean;
}

interface GlobalState {
    local: LocalState;
}

const {
    actions: local,
    reducer: localReducer,
    createMiddleware: createLocalMiddleware,
} = createReduxBlock<GlobalState>()({
    name: "local",
    initial: { flag: false },
    actions: {
        toggle(state) {
            return { flag: !state.flag };
        },
        set(state, value: boolean) {
            return { flag: value };
        }
    }
});

test("dummy", () => {
    expect(3).toBe(3);
});
