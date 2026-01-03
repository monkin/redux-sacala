import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import prettierConfig from "eslint-config-prettier";

export default tseslint.config(
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    prettierConfig,
    {
        rules: {
            "prefer-arrow-callback": "error",
            "arrow-body-style": ["error", "as-needed"],
            "func-style": ["error", "expression", { allowArrowFunctions: true }],
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-unsafe-function-type": "off",
            "@typescript-eslint/no-empty-object-type": "off",
            "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
        },
    },
    {
        ignores: ["build/", "node_modules/", "coverage/"],
    },
);
