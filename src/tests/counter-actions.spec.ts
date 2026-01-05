import { describe, expect, it } from "vitest";
import { ReduxBlock } from "../redux-sacala";

describe("counter-actions", () => {
    const counterBlock = ReduxBlock.builder("counter", 0)
        .action("inc", (state: number) => state + 1)
        .action("add", (state: number, value: number) => state + value)
        .build();

    it("should create actions correctly", () => {
        expect(counterBlock.actions.inc()).toEqual({ type: "counter/inc" });
        expect(counterBlock.actions.add(5)).toEqual({ type: "counter/add", payload: [5] });
    });

    it("should reduce actions correctly", () => {
        const state0 = 0;
        const state1 = counterBlock.reducer(state0, counterBlock.actions.inc());
        expect(state1).toBe(1);

        const state2 = counterBlock.reducer(state1, counterBlock.actions.add(10));
        expect(state2).toBe(11);
    });
});
