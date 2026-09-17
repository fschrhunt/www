import type { APIRoute } from "astro";
import { siteUrl } from "../lib/site";

/** Allow crawling everywhere except the send endpoint, and point crawlers at the sitemap. */
export const GET: APIRoute = () =>
  new Response(`User-Agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${siteUrl}/sitemap.xml\n`, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
