import { describe, expect, it } from "vitest";
import { ReduxBlock } from "../redux-sacala";

describe("selectors", () => {
    it("should allow adding selectors to a block", () => {
        const counterBlock = ReduxBlock.builder("counter", { count: 0 })
            .action("inc", (state) => ({ count: state.count + 1 }))
            .selectors({
                count: (state) => state.count,
                doubleCount: (state) => state.count * 2,
            })
            .build();

        const state = { count: 5 };
        expect(counterBlock.select.count(state)).toBe(5);
        expect(counterBlock.select.doubleCount(state)).toBe(10);
    });

    it("should allow adding selectors multiple times", () => {
        const counterBlock = ReduxBlock.builder("counter", { count: 0 })
            .selectors({
                count: (state) => state.count,
            })
            .selectors({
                doubleCount: (state) => state.count * 2,
            })
            .build();

        const state = { count: 5 };
        expect(counterBlock.select.count(state)).toBe(5);
        expect(counterBlock.select.doubleCount(state)).toBe(10);
    });

    it("should allow adding selectors to a composition", () => {
        const counterBlock = ReduxBlock.builder("counter", 0)
            .action("inc", (state: number) => state + 1)
            .selectors({
                value: (state) => state,
            })
            .build();

        const rootBlock = ReduxBlock.composition("root")
            .block("counter", counterBlock)
            .selectors({
                counterValue: (state) => state.counter,
                doubledCounter: (state) => state.counter * 2,
            })
            .build();

        const state = { counter: 10 };
        // Test lifted selectors from a block
        expect(rootBlock.select.counter.value(state)).toBe(10);
        // Test composition selectors
        expect(rootBlock.select.counterValue(state)).toBe(10);
        expect(rootBlock.select.doubledCounter(state)).toBe(20);
    });
});
