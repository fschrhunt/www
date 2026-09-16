import { defineMiddleware } from "astro:middleware";

/** The same security headers public/_headers gives static files, on Worker responses. */
export const onRequest = defineMiddleware(async (_context, next) => {
  const response = await next();
  response.headers.set("Content-Security-Policy", "object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), browsing-topics=()");
  return response;
});
