"use client";

import Link from "next/link";
import { scrollToTop } from "@/lib/scroll-to-top";
import { useRouter } from "next/navigation";
import { useEffect, useRef, type ComponentProps } from "react";

/** Rush back to the top before internal navigation; modified clicks retain Next's behavior. */
export function PageLink({ onNavigate, ...props }: ComponentProps<typeof Link>) {
  const router = useRouter();
  const cancelScroll = useRef<(() => void) | null>(null);
  useEffect(() => () => cancelScroll.current?.(), []);

  return <Link {...props} onNavigate={event => {
    onNavigate?.(event);
    const href = props.href;
    if (onNavigate || typeof href !== "string" || !href.startsWith("/") || href.includes("#") ||
      window.scrollY < 40 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    event.preventDefault();
    const destination = href;
    cancelScroll.current?.();
    cancelScroll.current = scrollToTop(() => {
      if (props.replace) router.replace(destination, { scroll: true });
      else router.push(destination, { scroll: true });
    });
  }} />;
}
