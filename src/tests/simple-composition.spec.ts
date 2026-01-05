import { describe, expect, it } from "vitest";
import { ReduxBlock } from "../redux-sacala";

describe("simple-composition", () => {
    const counterBlock = ReduxBlock.builder("counter", 0)
        .action("inc", (state: number) => state + 1)
        .build();

    const messageBlock = ReduxBlock.builder("message", "hello")
        .action("set", (state: string, text: string) => text)
        .build();

    const rootBlock = ReduxBlock.compose({
        counter: counterBlock,
        message: messageBlock,
    });

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
        // counter changed, so state1 is a new object
        expect(state1).not.toBe(initialState);
        // message didn't change, so it should be the same instance (primitive in this case, but still)
        expect(state1.message).toBe(initialState.message);

        // If we set the same message, it shouldn't change the state instance
        const state2 = rootBlock.reducer(state1, rootBlock.actions.message.set("hello"));
        expect(state2).toBe(state1);
    });

    it("should return the same state instance if unrelated action is triggered", () => {
        const initialState = {
            counter: 0,
            message: "hello",
        };

        // UnknownAction normally has a type string
        const state1 = rootBlock.reducer(initialState, { type: "OTHER_ACTION" } as any);
        expect(state1).toBe(initialState);
    });
});
