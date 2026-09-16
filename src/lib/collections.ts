import type { AstroComponentFactory } from "astro/runtime/server/index.js";
import { collectEntries, type Collection, type ContentEntry } from "./content";

type Module = { Content: AstroComponentFactory };

// Every authored file, compiled at build and keyed by its path under src/content;
// the raw sources beside them carry the front matter the index and metadata read.
const modules = import.meta.glob<Module>("/src/content/*/*.{md,mdx}", { eager: true });
const sources = import.meta.glob<string>("/src/content/*/*.{md,mdx}", { eager: true, query: "?raw", import: "default" });

/** A collection's entries, newest first. */
export function getContentEntries(collection: Collection): ContentEntry[] {
  const own = Object.fromEntries(Object.entries(sources).filter(([file]) => file.startsWith(`/src/content/${collection}/`)));
  return collectEntries(collection, own);
}

/** An entry's metadata paired with its compiled body. */
export function loadCollection(collection: Collection): { entry: ContentEntry; Content: AstroComponentFactory }[] {
  return getContentEntries(collection).map(entry => {
    const module = modules[`/src/content/${collection}/${entry.slug}.${entry.extension}`];
    if (!module) throw new Error(`No compiled content for ${collection}/${entry.slug}`);
    return { entry, Content: module.Content };
  });
}
