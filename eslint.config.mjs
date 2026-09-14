import js from "@eslint/js";
import tseslint from "typescript-eslint";

/**
 * COKEY ESLint configuration.
 *
 * Applied as a flat config (ESLint 9+). The TypeScript recommended rules catch
 * type-aware mistakes; the rest is a minimal, opinionated set that matches the
 * project's existing conventions.
 */
export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ["dist/", "node_modules/", ".cokey/", "coverage/", "cokey-export.json", "*.tsbuildinfo"],
  },
  {
    files: ["src/**/*.ts", "src/**/*.tsx", "tests/**/*.ts"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": "warn",
      "no-console": "off",
      "no-process-exit": "off",
    },
  },
  {
    files: ["src/web/**/*.tsx"],
    languageOptions: {
      globals: {
        window: "readonly",
        document: "readonly",
        console: "readonly",
        localStorage: "readonly",
        navigator: "readonly",
        NodeJS: "readonly",
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["src/cli/**/*.ts", "src/cli/**/*.tsx"],
    languageOptions: {
      globals: {
        process: "readonly",
        console: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
      },
    },
  },
  {
    // Repository scripts run on Node, so their globals have to be declared.
    files: ["scripts/**/*.mjs", "scripts/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        process: "readonly",
        console: "readonly",
        Buffer: "readonly",
        // Node 18+ global. Declared rather than imported so the script needs no
        // dependency to fetch a font file.
        fetch: "readonly",
      },
    },
  },
  {
    files: ["src/version.ts"],
    rules: {},
  },
);
