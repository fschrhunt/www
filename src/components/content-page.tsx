import type { ReactNode } from "react";
import type { Collection, ContentEntry } from "@/lib/content";
import { ReaderIndex } from "@/components/reader-index";
import { SocialHub } from "@/components/social-hub";

/** Frame authored content with the existing reader layout and collection-specific date label. */
export function ContentPage({ entry, collection, children }: {
  entry: ContentEntry;
  collection: Collection;
  children: ReactNode;
}) {
  const writing = collection === "writings";
  const date = new Intl.DateTimeFormat("en-US", {
    month: "long", ...(writing ? { day: "numeric" as const } : {}), year: "numeric", timeZone: "UTC",
  }).format(new Date(entry.date));

  return <>
    <a className="skip-link" href="#main">Skip to content</a>
    <main id="main" className="letter reader-page">
      <ReaderIndex />
      <article className="product-note">
        <h1>{entry.title}</h1>
        <div className="product-meta">
          {!writing && <span>{entry.status}</span>}
          <time dateTime={entry.date} title={writing ? undefined : "Repository created"}>{date}</time>
          {writing && <span>{entry.readingTime}</span>}
        </div>
        {children}
      </article>
    </main>
    <SocialHub />
  </>;
}
