import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  // Layer boundaries: domain and application code in modules never depends on the UI or on routes, and the shared
  // infrastructure in lib and config depends on neither modules nor UI. Module .tsx files (their own forms) may use
  // the shared UI kit.
  {
    files: ["src/modules/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [{ group: ["@/components/*", "@/app/*"], message: "Modules must not depend on UI or routes." }] },
      ],
    },
  },
  {
    files: ["src/lib/**/*.ts", "src/config/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/modules/*", "@/components/*", "@/app/*"],
              message: "lib and config sit below modules and UI.",
            },
          ],
        },
      ],
    },
  },
  prettier, // turn off ESLint style rules that Prettier owns; keep this last
  globalIgnores([".agents/**", ".next/**", "coverage/**", "docs/**", "supabase/**", "src/types/database.ts"]),
]);
