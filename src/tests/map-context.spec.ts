import { describe, expect, it, vi } from "vitest";
import { ReduxBlock } from "../redux-sacala";
import { configureStore } from "@reduxjs/toolkit";

describe("ReduxBlock.mapContext", () => {
    it("should map context as requested in the issue description", () => {
        interface OldContext {
            log: {
                error: (msg: string) => void;
                info: (msg: string) => void;
            };
        }

        interface NewContext {
            log: (level: "error" | "info", msg: string) => void;
        }

        const block = ReduxBlock.builder("test", { message: "" })
            .effects((ctx: OldContext) => ({
                logError: (msg: string) => ctx.log.error(msg),
                logInfo: (msg: string) => ctx.log.info(msg),
            }))
            .build();

        const mappedBlock = ReduxBlock.mapContext(
            block,
            (ctx: NewContext): OldContext => ({
                log: {
                    error: (msg) => ctx.log("error", msg),
                    info: (msg) => ctx.log("info", msg),
                },
            }),
        );

        const logSpy = vi.fn();
        const newContext: NewContext = {
            log: logSpy,
        };

        const store = configureStore({
            reducer: mappedBlock.reducer,
            middleware: (getDefaultMiddleware) =>
                getDefaultMiddleware({
                    serializableCheck: false,
                    immutableCheck: false,
                }).concat(ReduxBlock.middleware(mappedBlock, newContext)),
        });

        store.dispatch(mappedBlock.actions.logError("test error"));
        expect(logSpy).toHaveBeenCalledWith("error", "test error");

        store.dispatch(mappedBlock.actions.logInfo("test info"));
        expect(logSpy).toHaveBeenCalledWith("info", "test info");
    });

    it("should work with composed blocks", () => {
        interface InnerContext {
            prefix: string;
            print: (msg: string) => void;
        }

        const innerBlock = ReduxBlock.builder("inner", { value: "" })
            .effects((ctx: InnerContext) => ({
                run: (msg: string) => ctx.print(`${ctx.prefix}: ${msg}`),
            }))
            .build();

        const rootBlock = ReduxBlock.composition("root").block("child", innerBlock).build();

        // rootBlock.effects expects InnerContext

        interface OuterContext {
            log: (msg: string) => void;
        }

        const mappedRoot = ReduxBlock.mapContext(
            rootBlock,
            (ctx: OuterContext): InnerContext => ({
                prefix: "LOG",
                print: ctx.log,
            }),
        );

        const logSpy = vi.fn();
        const store = configureStore({
            reducer: mappedRoot.reducer,
            middleware: (getDefaultMiddleware) =>
                getDefaultMiddleware({
                    serializableCheck: false,
                    immutableCheck: false,
                }).concat(ReduxBlock.middleware(mappedRoot, { log: logSpy })),
        });

        store.dispatch(mappedRoot.actions.child.run("hello"));
        expect(logSpy).toHaveBeenCalledWith("LOG: hello");
    });
});
