import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Vendored Radix ref-composition util: a variadic hook can't express the
  // static array-literal deps the react-hooks/use-memo rule requires.
  {
    files: ["src/lib/compose-refs.ts"],
    rules: {
      "react-hooks/use-memo": "off",
      "react-hooks/exhaustive-deps": "off",
    },
  },
  // Vendored bklit-ui chart source, installed via `shadcn add @bklit/*`. It
  // drives visx/motion imperatively — reading refs during render and syncing
  // state from effects is how the animation phases work — which the React
  // Compiler rules reject. Any fix here is overwritten on the next registry
  // update, so scope the rules off rather than patch upstream code.
  {
    files: ["src/components/charts/**"],
    rules: {
      "react-hooks/refs": "off",
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/exhaustive-deps": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
