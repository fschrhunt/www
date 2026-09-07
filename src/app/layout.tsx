import type { Metadata } from "next";
import localFont from "next/font/local";
import { FaviconTheme } from "@/components/favicon-theme";
import "./globals.css";

const inter = localFont({ src: "./fonts/inter-regular.ttf", variable: "--font-inter", display: "swap", weight: "400" });

export const metadata: Metadata = {
  title: "Fischer Hunt",
  description: "Software for the terminal and the Mac. Projects and small tools by Fischer Hunt.",
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
