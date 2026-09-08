import { readFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-static";

/** Serve the accepted full-screen chart without the surrounding site's layout or styles. */
export async function GET() {
  const html = await readFile(
    path.join(process.cwd(), "public/token-usage-assets/index.html"),
    "utf8",
  );
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
