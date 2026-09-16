import js from "@eslint/js";
import astro from "eslint-plugin-astro";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**", ".astro/**", ".wrangler/**", "node_modules/**", "public/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...astro.configs.recommended,
  { files: ["**/*.tsx"], plugins: { "react-hooks": reactHooks }, rules: reactHooks.configs.recommended.rules },
  // The contact validation rejects control characters by their code points on purpose.
  { files: ["src/lib/contact-send.ts"], rules: { "no-control-regex": "off" } },
  { files: ["**/*.mjs"], languageOptions: { globals: { process: "readonly", console: "readonly", Buffer: "readonly", ReadableStream: "readonly", Response: "readonly", Request: "readonly", globalThis: "readonly", fetch: "readonly", URL: "readonly" } } },
);
