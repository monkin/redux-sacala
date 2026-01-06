import { describe, expect, it } from "vitest";
import { applyMiddleware, legacy_createStore as createStore, Store, UnknownAction } from "redux";
import { ReduxBlock } from "../redux-sacala";

describe("ReduxBlock effects test", () => {
    it("should satisfy all requirements from the issue description", () => {
        interface State {
            message: string;
        }

        // Define the context interface as requested
        interface Context {
            now: () => string;
            dispatch: (action: UnknownAction) => void;
        }

        // Create the block
        const lateBlock = ReduxBlock.builder("late", { message: "" } as State)
            .action("set", (state: State, message: string) => ({ ...state, message }))
            .effects((ctx: Context) => ({
                youAreLate: () => {
                    const time = ctx.now();
                    // calls dispatch(set('some message with time')) also provided in context
                    ctx.dispatch(lateBlock.actions.set(`some message with ${time}`));
                },
            }))
            .build();

        // Minimal redux store setup
        // We need a way to get the store's dispatch and actions into the context
        const store: Store<State, UnknownAction> = createStore(
            lateBlock.reducer,
            applyMiddleware(
                ReduxBlock.middleware(lateBlock, {
                    now: () => "2026-01-06 02:46",
                    dispatch: (action) => store.dispatch(action),
                }),
            ),
        );

        // Initial state
        expect(store.getState()).toEqual({ message: "" });

        // Dispatch the effect action
        store.dispatch(lateBlock.actions.youAreLate());

        // Verify the state change
        expect(store.getState()).toEqual({
            message: "some message with 2026-01-06 02:46",
        });
    });
});
