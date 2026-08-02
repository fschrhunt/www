import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Let the dev server be reached from non-localhost origins (a phone on the
  // LAN, a Tailscale hostname). Next 16 otherwise blocks the cross-origin dev
  // requests, so the HTML loads but client components never hydrate.
  // Dev-only; ignored in production builds.
  allowedDevOrigins: [
    "*.ts.net", // Tailscale MagicDNS hostnames
    "100.64.0.0/10", // Tailscale CGNAT range
    "192.168.0.0/16", // common LAN range
  ],
};

export default nextConfig;
