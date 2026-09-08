import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

/** Allow crawling everywhere except the send endpoint, and point crawlers at the sitemap. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
