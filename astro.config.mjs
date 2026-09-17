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
 * and text-only links drawn as the scramble link.
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
  devToolbar: { enabled: false },
});
