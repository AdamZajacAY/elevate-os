import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

// next-env.d.ts jest generowany przez Next i nie da sie go dostosowac do regul.
const config = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  { ignores: ["generated/**", ".next/**", "node_modules/**", "next-env.d.ts"] },
];

export default config;
