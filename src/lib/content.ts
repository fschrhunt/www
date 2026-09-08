import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import matter from "gray-matter";

export type Collection = "writings" | "products";

/** Metadata shared by content pages and their homepage entries. Dates stay in UTC. */
export type ContentEntry = {
  slug: string;
  extension: "md" | "mdx";
  title: string;
  date: string;
  description?: string;
  status?: string;
  /** Optional homepage label when the index should read differently from the article heading. */
  indexLabel?: string;
  readingTime: string;
};

/** Validate file metadata and estimate reading time from prose, excluding JSX and link URLs. */
export function parseContent(filename: string, source: string): ContentEntry {
  const { data, content } = matter(source);
  const match = /^([a-z0-9]+(?:-[a-z0-9]+)*)\.(md|mdx)$/.exec(filename);
  if (!match) throw new Error(`Invalid content filename: ${filename}`);
  for (const field of ["title", "date"]) {
    if (typeof data[field] !== "string" || !data[field].trim()) {
      throw new Error(`${filename}: ${field} must be a nonempty quoted string`);
    }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date) ||
      Number.isNaN(Date.parse(data.date)) || new Date(data.date).toISOString().slice(0, 10) !== data.date) {
    throw new Error(`${filename}: date must be a valid YYYY-MM-DD date`);
  }
  for (const field of ["description", "status", "indexLabel"]) {
    if (data[field] !== undefined && typeof data[field] !== "string") {
      throw new Error(`${filename}: ${field} must be a string`);
    }
  }
  const prose = content
    .replace(/^import .*$/gm, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\{[^}]*\}/g, " ")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1");
  const words = prose.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)?.length ?? 0;
  return {
    slug: match[1], extension: match[2] as ContentEntry["extension"],
    title: data.title, date: data.date, description: data.description, status: data.status,
    indexLabel: data.indexLabel,
    readingTime: `${Math.max(1, Math.ceil(words / 200))} min read`,
  };
}

// Parsing every file runs three times per page (params, metadata, render). Cache the
// result in production, where content is fixed; skip the cache in dev so edits hot-reload.
const cache = new Map<Collection, ContentEntry[]>();

/** Read local content on the server, newest first; duplicate URLs fail the build. */
export function getContentEntries(collection: Collection): ContentEntry[] {
  const cached = process.env.NODE_ENV === "production" ? cache.get(collection) : undefined;
  if (cached) return cached;
  const directory = path.join(process.cwd(), "src/content", collection);
  const entries = readdirSync(directory).filter(file => /\.(md|mdx)$/.test(file))
    .map(file => parseContent(file, readFileSync(path.join(directory, file), "utf8")));
  const slugs = new Set<string>();
  for (const entry of entries) {
    if (slugs.has(entry.slug)) throw new Error(`Duplicate ${collection} slug: ${entry.slug}`);
    slugs.add(entry.slug);
    if (collection === "writings" && !entry.description) throw new Error(`${entry.slug}: description is required`);
    if (collection === "products" && !entry.status) throw new Error(`${entry.slug}: status is required`);
  }
  entries.sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
  cache.set(collection, entries);
  return entries;
}

/** Find one entry by slug, or undefined when no file matches. */
export function getContentEntry(collection: Collection, slug: string): ContentEntry | undefined {
  return getContentEntries(collection).find(entry => entry.slug === slug);
}
