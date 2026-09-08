import type { MetadataRoute } from "next";
import { getContentEntries } from "@/lib/content";
import { siteUrl } from "@/lib/site";
import siteUpdate from "@/site-updated.json";

/** List every static route so search engines discover new writings and products automatically. */
export default function sitemap(): MetadataRoute.Sitemap {
  const entry = (path: string, lastModified: string | Date) => ({ url: `${siteUrl}${path}`, lastModified });
  const content = (["writings", "products"] as const).flatMap(collection =>
    getContentEntries(collection).map(item => entry(`/${collection}/${item.slug}`, item.date)));
  return [entry("/", siteUpdate.updatedAt), entry("/contact", siteUpdate.updatedAt), ...content];
}
