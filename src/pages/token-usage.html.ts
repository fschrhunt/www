import type { APIRoute } from "astro";
import html from "../../public/token-usage-assets/index.html?raw";

/** Serve the accepted full-screen chart without the surrounding site's layout or styles. */
export const GET: APIRoute = () => new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
