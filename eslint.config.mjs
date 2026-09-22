import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  prettier, // turn off ESLint style rules that Prettier owns; keep this last
  globalIgnores([".agents/**", ".next/**", "coverage/**", "docs/**", "supabase/**", "src/types/database.ts"]),
]);
