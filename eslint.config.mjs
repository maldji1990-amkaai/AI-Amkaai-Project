import { defineConfig, globalIgnores } from "eslint/config";
import next from "eslint-config-next/core-web-vitals.js";

export default defineConfig([
  ...next,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);