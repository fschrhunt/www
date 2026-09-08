import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { FaviconTheme } from "@/components/favicon-theme";
import { siteUrl } from "@/lib/site";
import "./globals.css";

const inter = localFont({ src: "./fonts/inter-regular.ttf", variable: "--font-inter", display: "swap", weight: "400" });

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

const description = "Software for the terminal and the Mac. Projects and small tools by Fischer Hunt.";

// metadataBase resolves relative page URLs; per-page titles fill the "%s" template.
// Pages inherit these OpenGraph/Twitter defaults so shared links unfurl with a title.
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Fischer Hunt", template: "%s · Fischer Hunt" },
  description,
  alternates: { canonical: "/" },
  openGraph: { type: "website", siteName: "Fischer Hunt", title: "Fischer Hunt", description, url: "/" },
  twitter: { card: "summary", title: "Fischer Hunt", description },
};

/** Shared document shell and locally hosted type for the personal website. */
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <link rel="alternate icon" href="/favicon.ico" />
        <link id="site-favicon" rel="icon" type="image/png" sizes="32x32" href="/favicon-light.png" />
        <link rel="mask-icon" href="/safari-pinned-tab.svg" color="#262626" />
      </head>
      <body><FaviconTheme />{children}</body>
    </html>
  );
}
