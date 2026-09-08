import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentPage } from "@/components/content-page";
import { getContentEntries, getContentEntry } from "@/lib/content";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

/** Generate a static route for each authored file. */
export function generateStaticParams() {
  return getContentEntries("writings").map(({ slug }) => ({ slug }));
}

/** Use the same frontmatter for search metadata, link previews, and the visible heading. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const entry = getContentEntry("writings", slug);
  if (!entry) notFound();
  const url = `/writings/${slug}`;
  return {
    title: entry.title,
    description: entry.description,
    alternates: { canonical: url },
    openGraph: { type: "article", title: entry.title, description: entry.description, url, publishedTime: entry.date },
    twitter: { title: entry.title, description: entry.description },
  };
}

/** Render local Markdown or MDX inside the shared reader layout. */
export default async function Page({ params }: Props) {
  const { slug } = await params;
  const entry = getContentEntry("writings", slug);
  if (!entry) notFound();
  const { default: Content } = entry.extension === "md"
    ? await import(`@/content/writings/${slug}.md`)
    : await import(`@/content/writings/${slug}.mdx`);
  return <ContentPage entry={entry} collection="writings"><Content /></ContentPage>;
}
