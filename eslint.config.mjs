import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Native shell + IDE workspace data — never our source, never lint:
    "android/**",
    ".codebuddy/**",
  ]),
  // ── Project-wide rule tuning ────────────────────────────────────────
  // Honor the industry-standard underscore prefix to explicitly mark
  // "intentionally unused" destructured keys, parameters and caught
  // errors. This lets us write `const { id: _id, ...rest } = item;` to
  // strip a field cleanly without the linter complaining, while still
  // catching genuinely dead symbols that forgot their underscore.
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          args: "after-used",
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          caughtErrors: "all",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
]);

export default eslintConfig;
