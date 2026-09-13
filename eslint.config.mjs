// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintConfigPrettier,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/.turbo/**",
      "**/coverage/**",
      "infrastructure/**",
      // apps/mobile's Metro/Babel config and custom entry point aren't
      // part of any tsconfig "include" (its tsconfig.json only includes
      // "src" and "App.tsx" - Expo/Metro loads these directly, not tsc)
      // - can't be typed-linted like the rest of the repo.
      "**/babel.config.js",
      "apps/mobile/metro.config.js",
      "apps/mobile/index.js",
      // apps/web (Next.js): its build output and the two files Next.js
      // itself generates/loads outside any tsconfig "include".
      "**/.next/**",
      "**/next.config.mjs",
      "**/next-env.d.ts",
    ],
  },
);
