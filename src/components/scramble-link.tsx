"use client";

import { useEffect, useRef, type AnchorHTMLAttributes } from "react";
import { PageLink as Link } from "@/components/page-link";

type ScrambleLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "children" | "href"> & {
  children: string;
  href: string;
};

/** Scramble the label's tail, fitting wider symbols inside its original width. */
export function ScrambleLink({ children, className = "", ...props }: ScrambleLinkProps) {
  const overlay = useRef<HTMLSpanElement>(null);
  const label = useRef<HTMLSpanElement>(null);
  const frame = useRef(0);

  function reset() {
    cancelAnimationFrame(frame.current);
    if (overlay.current) overlay.current.textContent = "";
    if (overlay.current) overlay.current.style.transform = "";
    label.current?.removeAttribute("data-scrambling");
  }

  function animate() {
    reset();
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const started = performance.now();
    const symbols = "@#$%&*+=<>?!/~^§¶†•◊×÷±∆";
    const characters = Array.from(children);
    const tailLength = Math.min(6, Math.max(3, Math.round(characters.length * 0.4)));
    const tailStart = characters.length - tailLength;
    const punctuation = new Set(" ,./()—–-'’:?");
    label.current?.setAttribute("data-scrambling", "true");

    function tick(now: number) {
      const progress = (now - started) / 560;
      if (progress >= 1) return reset();
      const settled = tailStart + Math.floor(progress * tailLength);
      if (overlay.current) {
        overlay.current.textContent = characters.map((character, index) =>
          index < settled || punctuation.has(character)
            ? character
            : symbols[Math.floor(Math.random() * symbols.length)],
        ).join("");
        const available = label.current?.getBoundingClientRect().width ?? 0;
        const natural = overlay.current.scrollWidth;
        overlay.current.style.transform = `scaleX(${natural > available && available > 0 ? available / natural : 1})`;
      }
      frame.current = requestAnimationFrame(tick);
    }

    frame.current = requestAnimationFrame(tick);
  }

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  return (
    <Link {...props} className={`text-link ${className}`}
      onPointerEnter={event => { if (event.pointerType === "mouse") animate(); }}
      onPointerLeave={reset} onFocus={event => { if (event.currentTarget.matches(":focus-visible")) animate(); }} onBlur={reset}>
      <span className="link-label">
        <span ref={label}>{children}</span>
        <span className="link-scramble" ref={overlay} aria-hidden="true" />
      </span>
    </Link>
  );
}
