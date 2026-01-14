import { describe, expect, it } from "vitest";
import { configureStore, Store, UnknownAction } from "@reduxjs/toolkit";
import { ReduxBlock } from "../redux-sacala";

describe("Composition of blocks with effects", () => {
    it("should handle effects from multiple composed blocks", () => {
        // Block 1: Counter
        interface CounterState {
            count: number;
        }
        interface CounterContext {
            dispatch: (action: UnknownAction) => void;
        }

        const counterBlock = ReduxBlock.builder("counter", { count: 0 } as CounterState)
            .action("set", (state: CounterState, count: number) => ({ ...state, count }))
            .effects((ctx: CounterContext) => ({
                incrementAsync: (amount: number) => {
                    // In a real app this might be an async call
                    ctx.dispatch(counterBlock.actions.set(amount));
                },
            }))
            .build();

        // Block 2: Logger
        interface LoggerState {
            logs: string[];
        }
        interface LoggerContext {
            dispatch: (action: UnknownAction) => void;
        }

        const loggerBlock = ReduxBlock.builder("logger", { logs: [] } as LoggerState)
            .action("add", (state: LoggerState, log: string) => ({ ...state, logs: [...state.logs, log] }))
            .effects((ctx: LoggerContext) => ({
                logAsync: (message: string) => {
                    ctx.dispatch(loggerBlock.actions.add(message));
                },
            }))
            .build();

        // Composition
        const rootBlock = ReduxBlock.composition("root")
            .block("counter", counterBlock)
            .block("logger", loggerBlock)
            .build();

        type RootState = ReduxBlock.TakeState<typeof rootBlock>;

        // Store setup
        const store: Store<RootState, UnknownAction> = configureStore({
            reducer: rootBlock.reducer,
            middleware: (getDefaultMiddleware) =>
                getDefaultMiddleware({
                    serializableCheck: false,
                    immutableCheck: false,
                }).concat(
                    ReduxBlock.middleware(rootBlock, {
                        dispatch: (action: UnknownAction) => store.dispatch(action),
                    }),
                ),
        });

        // Initial state check
        expect(store.getState()).toEqual({
            counter: { count: 0 },
            logger: { logs: [] },
        });

        // Test Counter effect
        store.dispatch(rootBlock.actions.counter.incrementAsync(5));
        expect(store.getState().counter.count).toBe(5);

        // Test Logger effect
        store.dispatch(rootBlock.actions.logger.logAsync("First log"));
        expect(store.getState().logger.logs).toEqual(["First log"]);

        // Test both
        store.dispatch(rootBlock.actions.counter.incrementAsync(10));
        store.dispatch(rootBlock.actions.logger.logAsync("Second log"));

        expect(store.getState()).toEqual({
            counter: { count: 10 },
            logger: { logs: ["First log", "Second log"] },
        });
    });

    it("should handle composed block with its own effects and child effects", () => {
        interface SimpleState {
            value: string;
        }
        const simpleBlock = ReduxBlock.builder("simple", { value: "" } as SimpleState)
            .action("set", (state: SimpleState, value: string) => ({ ...state, value }))
            .effects((ctx: { dispatch: (a: UnknownAction) => void }) => ({
                runEffect: (val: string) => ctx.dispatch(simpleBlock.actions.set(val)),
            }))
            .build();

        const rootBlock = ReduxBlock.composition("root")
            .block("child", simpleBlock)
            .effects((ctx: { dispatch: (a: UnknownAction) => void }) => ({
                rootEffect: (val: string) => ctx.dispatch(rootBlock.actions.child.runEffect(val)),
            }))
            .build();

        type RootState = ReduxBlock.TakeState<typeof rootBlock>;

        const store: Store<RootState, UnknownAction> = configureStore({
            reducer: rootBlock.reducer,
            middleware: (getDefaultMiddleware) =>
                getDefaultMiddleware({
                    serializableCheck: false,
                    immutableCheck: false,
                }).concat(
                    ReduxBlock.middleware(rootBlock, {
                        dispatch: (action: UnknownAction) => store.dispatch(action),
                    }),
                ),
        });

        store.dispatch(rootBlock.actions.rootEffect("from root"));
        expect(store.getState().child.value).toBe("from root");
    });
});
