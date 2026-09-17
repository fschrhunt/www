import type { APIRoute } from "astro";
import { getContentEntries } from "../lib/collections";
import { siteUrl } from "../lib/site";
import siteUpdate from "../site-updated.json";

/** List every static route so search engines discover new writings and products automatically. */
export const GET: APIRoute = () => {
  const entry = (path: string, lastModified: string) => `<url>\n<loc>${siteUrl}${path}</loc>\n<lastmod>${lastModified}</lastmod>\n</url>`;
  const content = (["writings", "products"] as const).flatMap(collection =>
    getContentEntries(collection).map(item => entry(`/${collection}/${item.slug}`, item.date)));
  const body = [entry("/", siteUpdate.updatedAt), entry("/contact", siteUpdate.updatedAt), ...content].join("\n");
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`, {
    headers: { "Content-Type": "application/xml" },
  });
};
