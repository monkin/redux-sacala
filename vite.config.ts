import { defineConfig } from "vitest/config";
import dts from "vite-plugin-dts";
import { resolve } from "path";

export default defineConfig({
    build: {
        lib: {
            entry: resolve(__dirname, "src/redux-sacala.ts"),
            name: "ReduxSacala",
            fileName: "redux-sacala",
            formats: ["es", "cjs"],
        },
        outDir: "build",
        sourcemap: true,
        rollupOptions: {
            external: ["redux", "@reduxjs/toolkit"],
        },
    },
    plugins: [dts({ rollupTypes: true })],
    test: {
        globals: true,
        environment: "node",
        exclude: ["**/node_modules/**", "**/build/**"],
    },
});
