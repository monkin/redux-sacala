import { describe, expect, it } from "vitest";
import { ReduxBlock } from "../redux-sacala";

describe("ReduxBlock.mapSelectors", () => {
    it("should map selectors to a new state", () => {
        const counterBlock = ReduxBlock.builder("counter", { count: 0 })
            .selectors({
                count: (state: { count: number }) => state.count,
                doubleCount: (state: { count: number }) => state.count * 2,
            })
            .build();

        interface RootState {
            counterA: { count: number };
        }

        const mappedBlock = ReduxBlock.mapSelectors(counterBlock, (state: RootState) => state.counterA);

        const rootState: RootState = {
            counterA: { count: 5 },
        };

        expect(mappedBlock.select.count(rootState)).toBe(5);
        expect(mappedBlock.select.doubleCount(rootState)).toBe(10);
    });

    it("should work with nested selectors", () => {
        const innerBlock = ReduxBlock.builder("inner", { count: 0 })
            .selectors({
                count: (state: { count: number }) => state.count,
            })
            .build();

        const counterBlock = ReduxBlock.composition("counter").block("main", innerBlock).build();

        interface RootState {
            counterA: { main: { count: number } };
        }

        const mappedBlock = ReduxBlock.mapSelectors(counterBlock, (state: RootState) => state.counterA);

        const rootState: RootState = {
            counterA: { main: { count: 10 } },
        };

        expect(mappedBlock.select.main.count(rootState)).toBe(10);
    });

    it("should preserve other block properties", () => {
        const counterBlock = ReduxBlock.builder("counter", { count: 0 })
            .action("increment", (state) => ({ ...state, count: state.count + 1 }))
            .build();

        const mappedBlock = ReduxBlock.mapSelectors(counterBlock, (state: any) => state.somePath);

        expect(mappedBlock.actions).toBe(counterBlock.actions);
        expect(mappedBlock.reducer).toBe(counterBlock.reducer);
        expect(mappedBlock.effects).toBe(counterBlock.effects);
    });

    it("should work with composed blocks", () => {
        const innerBlock = ReduxBlock.builder("inner", { value: "initial" })
            .selectors({
                getValue: (state: { value: string }) => state.value,
            })
            .build();

        const rootBlock = ReduxBlock.composition("root").block("child", innerBlock).build();

        // rootBlock state is { child: { value: string } }
        // rootBlock.select.child.getValue(state) works

        interface AppState {
            feature: {
                child: { value: string };
            };
        }

        const mappedRoot = ReduxBlock.mapSelectors(rootBlock, (state: AppState) => state.feature);

        const appState: AppState = {
            feature: {
                child: { value: "hello" },
            },
        };

        expect(mappedRoot.select.child.getValue(appState)).toBe("hello");
    });

    it("should work with multiple levels of mapping", () => {
        const counterBlock = ReduxBlock.builder("counter", { count: 0 })
            .selectors({
                count: (state: { count: number }) => state.count,
            })
            .build();

        interface MidState {
            inner: { count: number };
        }
        interface RootState {
            outer: MidState;
        }

        const midBlock = ReduxBlock.mapSelectors(counterBlock, (state: MidState) => state.inner);

        const rootBlock = ReduxBlock.mapSelectors(midBlock, (state: RootState) => state.outer);

        const rootState: RootState = {
            outer: {
                inner: { count: 42 },
            },
        };

        expect(rootBlock.select.count(rootState)).toBe(42);
    });
});
