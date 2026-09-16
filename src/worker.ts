/**
 * The Worker entry: Astro's Cloudflare handler, plus the Durable Object class
 * the contact endpoint counts attempts in. Wrangler needs the class exported
 * from the main module, which Astro's own entry cannot do.
 */
import astro from "@astrojs/cloudflare/entrypoints/server";

export { RateLimiter } from "./lib/rate-limiter";
export default astro;
