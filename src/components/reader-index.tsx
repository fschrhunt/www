"use client";

import { useEffect, useRef, useState } from "react";
import { PageLink } from "@/components/page-link";
import { ReturnArrow } from "@/components/social-hub";
import { scrollToTop } from "@/lib/scroll-to-top";

type Section = { id: string; text: string; level: number };

/** Match the desktop reading rail; short articles and narrow screens omit the outline. */
export function ReaderIndex() {
  const [sections, setSections] = useState<Section[]>([]);
  const [title, setTitle] = useState("");
  const [active, setActive] = useState("");
  const [scrolled, setScrolled] = useState(false);
  const cancelScroll = useRef<(() => void) | null>(null);

  useEffect(() => {
    const article = document.querySelector(".reader-page article");
    const headings = Array.from(article?.querySelectorAll<HTMLElement>("h2, h3") || []);
    if (!headings.length) return;
    for (const [index, heading] of headings.entries()) {
      if (!heading.id) {
        const slug = heading.textContent?.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "section";
        heading.id = `section-${index + 1}-${slug}`;
      }
    }
    let frame = 0;
    const initialFrame = requestAnimationFrame(() => {
      setTitle(article?.querySelector("h1")?.textContent || "");
      setSections(headings.map(heading => ({ id: heading.id, text: heading.textContent || "", level: Number(heading.tagName[1]) })));
      updatePosition();
    });

    /** Reveal the title after 100px and track headings at 128px, including the page end. */
    function updatePosition() {
      const atEnd = scrollY > 0 && innerHeight + scrollY >= document.documentElement.scrollHeight - 24;
      const current = atEnd ? headings.at(-1) : headings.filter(heading => heading.getBoundingClientRect().top < 128).at(-1);
      setActive(current?.id || "");
      setScrolled(window.scrollY > 100);
    }
    function scheduleUpdate() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(updatePosition);
    }
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    return () => {
      cancelAnimationFrame(initialFrame);
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      cancelScroll.current?.();
    };
  }, []);

  return <nav className="reader-index" aria-label="Article navigation">
    <PageLink className="back-to-index" href="/"><ReturnArrow /><span>Index</span></PageLink>
    {sections.length > 0 && <div className="reader-outline" data-scrolled={scrolled}>
      <button className="reader-current-title" type="button" aria-label={`Back to top: ${title}`} tabIndex={scrolled ? 0 : -1} aria-hidden={!scrolled} data-active={!active} onClick={() => {
        cancelScroll.current?.();
        cancelScroll.current = scrollToTop();
      }}>{title}</button>
      <ul>{sections.map(section => <li key={section.id} data-level={section.level}>
        <a href={`#${section.id}`} aria-current={active === section.id ? "location" : undefined}>{section.text}</a>
      </li>)}</ul>
    </div>}
  </nav>;
}
