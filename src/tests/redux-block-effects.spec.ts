import { describe, expect, it } from "vitest";
import { applyMiddleware, legacy_createStore as createStore } from "redux";
import { ReduxBlock } from "../redux-sacala";

describe("ReduxBlock effects test", () => {
    it("should satisfy all requirements from the issue description", () => {
        // Define the context interface as requested
        interface Context {
            now: () => string;
            dispatch: (action: any) => void;
            set: (message: string) => any;
        }

        // Create the block
        const lateBlock = ReduxBlock.builder("late", { message: "" })
            .action("set", (state: { message: string }, message: string) => ({ ...state, message }))
            .effects((ctx: Context) => ({
                youAreLate: () => {
                    const time = ctx.now();
                    // calls dispatch(set('som message with time')) also provided in context
                    ctx.dispatch(ctx.set(`som message with ${time}`));
                },
            }))
            .build();

        // Minimal redux store setup
        // We need a way to get the store's dispatch and actions into the context
        let store: any;
        const context: Context = {
            now: () => "2026-01-06 02:46",
            dispatch: (action) => store.dispatch(action),
            set: (message: string) => lateBlock.actions.set(message),
        };

        store = createStore(lateBlock.reducer, applyMiddleware(ReduxBlock.middleware(lateBlock, context)));

        // Initial state
        expect(store.getState()).toEqual({ message: "" });

        // Dispatch the effect action
        store.dispatch(lateBlock.actions.youAreLate());

        // Verify the state change
        expect(store.getState()).toEqual({
            message: "som message with 2026-01-06 02:46",
        });
    });
});
