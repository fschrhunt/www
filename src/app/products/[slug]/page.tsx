import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentPage } from "@/components/content-page";
import { getContentEntries } from "@/lib/content";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

/** Generate a static route for each authored file. */
export function generateStaticParams() {
  return getContentEntries("products").map(({ slug }) => ({ slug }));
}

/** Use the same frontmatter for search metadata and the visible article heading. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const entry = getContentEntries("products").find(entry => entry.slug === slug);
  if (!entry) notFound();
  return { title: `${entry.title} · Fischer Hunt`, description: entry.description };
}

/** Render local Markdown or MDX inside the shared reader layout. */
export default async function Page({ params }: Props) {
  const { slug } = await params;
  const entry = getContentEntries("products").find(entry => entry.slug === slug);
  if (!entry) notFound();
  const { default: Content } = entry.extension === "md"
    ? await import(`@/content/products/${slug}.md`)
    : await import(`@/content/products/${slug}.mdx`);
  return <ContentPage entry={entry} collection="products"><Content /></ContentPage>;
}
