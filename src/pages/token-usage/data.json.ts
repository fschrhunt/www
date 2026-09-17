import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

/**
 * The public usage snapshot, served same-origin from the R2 object the token-usage
 * publisher replaces. A missing object means nothing has been published yet.
 */
export const GET: APIRoute = async () => {
  const snapshot = await env.TOKEN_USAGE.get("usage.json");
  if (!snapshot) return new Response("Usage snapshot unavailable.", { status: 503 });
  return new Response(snapshot.body, {
    headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=60" },
  });
};
