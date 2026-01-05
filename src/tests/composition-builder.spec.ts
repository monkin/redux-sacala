import { describe, expect, it } from "vitest";
import { ReduxBlock } from "../redux-sacala";

describe("CompositionBuilder", () => {
    const counterBlock = ReduxBlock.builder("counter", 0)
        .action("inc", (state: number) => state + 1)
        .build();

    const messageBlock = ReduxBlock.builder("message", "hello")
        .action("set", (state: string, text: string) => text)
        .build();

    const rootBlock = ReduxBlock.composition("root")
        .block("counter", counterBlock)
        .block("message", messageBlock)
        .build();

    it("should update composed state when actions are triggered", () => {
        const initialState = {
            counter: 0,
            message: "hello",
        };

        const state1 = rootBlock.reducer(initialState, rootBlock.actions.counter.inc());
        expect(state1).toEqual({
            counter: 1,
            message: "hello",
        });

        const state2 = rootBlock.reducer(state1, rootBlock.actions.message.set("world"));
        expect(state2).toEqual({
            counter: 1,
            message: "world",
        });
    });

    it("should maintain referential equality for unchanged state parts", () => {
        const initialState = {
            counter: 0,
            message: "hello",
        };

        const state1 = rootBlock.reducer(initialState, rootBlock.actions.counter.inc());
        expect(state1).not.toBe(initialState);
        expect(state1.message).toBe(initialState.message);

        const state2 = rootBlock.reducer(state1, rootBlock.actions.message.set("hello"));
        expect(state2).toBe(state1);
    });

    it("should handle nested actions", () => {
        // ReduxBlock.composition("root").block("sub", block)
        // root.actions.sub.action()
        expect(rootBlock.actions.counter.inc().type).toBe("counter/inc");
    });
});
