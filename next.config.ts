import type { NextConfig } from "next";
import createMDX from "@next/mdx";

const withMDX = createMDX({
  extension: /\.(md|mdx)$/,
  options: { remarkPlugins: ["remark-frontmatter"] },
});

const nextConfig: NextConfig = {
  devIndicators: false,
  /** Preserve shared writing and image URLs after the folder migration. */
  async redirects() {
    return [
      { source: "/notes/five-lines", destination: "/writings/damn-you-agents", permanent: true },
      { source: "/writings/five-lines", destination: "/writings/damn-you-agents", permanent: true },
      { source: "/notes/:path*", destination: "/writings/:path*", permanent: true },
    ];
  },
  /** Conservative security headers for a static site with one server-side send endpoint. */
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
      ],
    }];
  },
  turbopack: { root: process.cwd() },
  // Let the dev server be reached from non-localhost origins (a phone on the
  // LAN, a Tailscale hostname). Next 16 otherwise blocks the cross-origin dev
  // requests, so the HTML loads but client components never hydrate.
  // Dev-only; ignored in production builds.
  allowedDevOrigins: [
    "**.ts.net", // MagicDNS includes both machine and tailnet subdomains
    "100.64.0.0/10", // Tailscale CGNAT range
    "192.168.0.0/16", // common LAN range
  ],
};

export default withMDX(nextConfig);
