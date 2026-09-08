"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Fit the chat and review above the keyboard and reveal focused fields without scrolling the page. */
export function ContactViewport({ children }: { children: ReactNode }) {
  const main = useRef<HTMLElement>(null);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    let frame = 0;
    /** Reveal only the obscured edge of a review field; leave tall message caret scrolling to the browser. */
    const revealField = () => {
      if (viewport.scale !== 1) return;
      const active = document.activeElement;
      if (!(active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement)) return;
      const scroller = active.closest<HTMLElement>(".contact-review-scroll");
      if (!scroller || !main.current?.contains(scroller)) return;
      const field = active.getBoundingClientRect();
      const bounds = scroller.getBoundingClientRect();
      if (field.height > bounds.height - 24) return;
      if (field.bottom > bounds.bottom - 12) scroller.scrollTop += field.bottom - bounds.bottom + 12;
      else if (field.top < bounds.top + 12) scroller.scrollTop -= bounds.top + 12 - field.top;
    };
    const update = () => {
      if (!main.current || viewport.scale !== 1) return;
      const thread = main.current.querySelector<HTMLElement>(".conversation-thread");
      const atBottom = thread && thread.scrollHeight - thread.scrollTop - thread.clientHeight < 24;
      main.current.style.setProperty("--conversation-height", `${viewport.height}px`);
      main.current.style.setProperty("--conversation-top", `${viewport.offsetTop}px`);
      main.current.toggleAttribute("data-compact", viewport.height < 550);
      if (thread && atBottom) thread.scrollTop = thread.scrollHeight;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(revealField);
    };
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    const container = main.current;
    container?.addEventListener("focusin", update);
    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
      container?.removeEventListener("focusin", update);
    };
  }, []);

  return <main ref={main} className="conversation-page" id="conversation">{children}</main>;
}
