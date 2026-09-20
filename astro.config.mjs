import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import { satteri } from "@astrojs/markdown-satteri";

import { contentLinks } from "./src/lib/markdown.mjs";

/**
 * fschrhunt.com: pages prerender to static files; the contact API and the
 * token-usage snapshot run on the Worker. Markdown renders the way the site's
 * MDX pipeline always has: no GFM, no smart punctuation, no syntax highlighting,
 * and text-only links drawn with the shared underline and arrow.
 */
export default defineConfig({
  site: "https://fschrhunt.com",
  output: "static",
  trailingSlash: "never",
  build: { format: "file" },
  adapter: cloudflare({ imageService: "compile" }),
  integrations: [react(), mdx()],
  markdown: {
    syntaxHighlight: false,
    processor: satteri({
      features: { gfm: false, smartPunctuation: false },
      hastPlugins: [contentLinks],
    }),
  },
  // The dev server runs SSR in workerd, which has no `require`. Vite pre-bundles
  // server deps into ESM, but @astrojs/react pulls a nested picomatch copy that
  // escapes discovery and reaches workerd as raw CommonJS, crashing the runner.
  // Pinning the ids (and astro/logger/console, discovered at startup) bundles them
  // in the first pass. See withastro/astro#17489.
  vite: {
    ssr: {
      optimizeDeps: {
        include: ["astro/logger/console", "picomatch", "astro > @astrojs/internal-helpers > picomatch"],
      },
    },
  },
  devToolbar: { enabled: false },
});
