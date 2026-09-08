import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentPage } from "@/components/content-page";
import { getContentEntries, getContentEntry } from "@/lib/content";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

/** Generate a static route for each authored file. */
export function generateStaticParams() {
  return getContentEntries("products").map(({ slug }) => ({ slug }));
}

/** Use the same frontmatter for search metadata, link previews, and the visible heading. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const entry = getContentEntry("products", slug);
  if (!entry) notFound();
  const url = `/products/${slug}`;
  return {
    title: entry.title,
    description: entry.description,
    alternates: { canonical: url },
    openGraph: { type: "website", title: entry.title, description: entry.description, url },
    twitter: { title: entry.title, description: entry.description },
  };
}

/** Render local Markdown or MDX inside the shared reader layout. */
export default async function Page({ params }: Props) {
  const { slug } = await params;
  const entry = getContentEntry("products", slug);
  if (!entry) notFound();
  const { default: Content } = entry.extension === "md"
    ? await import(`@/content/products/${slug}.md`)
    : await import(`@/content/products/${slug}.mdx`);
  return <ContentPage entry={entry} collection="products"><Content /></ContentPage>;
}
