import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { handleContact } from "../../lib/contact-send";

export const prerender = false;

/** The send endpoint: Worker secrets supply the settings; `astro dev` may count attempts in memory. */
export const POST: APIRoute = ({ request }) => handleContact(request, env as unknown as Record<string, string | undefined>, import.meta.env.DEV);

/** Anything but a POST is a wrong turn, not a missing page. */
export const ALL: APIRoute = () => new Response(null, { status: 405, headers: { Allow: "POST" } });
