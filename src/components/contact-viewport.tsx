"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Fit the conversation to the visible viewport above a mobile keyboard, preserving pinch zoom. */
export function ContactViewport({ children }: { children: ReactNode }) {
  const main = useRef<HTMLElement>(null);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => {
      if (!main.current || viewport.scale !== 1) return;
      const thread = main.current.querySelector<HTMLElement>(".conversation-thread");
      const atBottom = thread && thread.scrollHeight - thread.scrollTop - thread.clientHeight < 24;
      main.current.style.setProperty("--conversation-height", `${viewport.height}px`);
      main.current.style.setProperty("--conversation-top", `${viewport.offsetTop}px`);
      main.current.toggleAttribute("data-compact", viewport.height < 550);
      if (thread && atBottom) thread.scrollTop = thread.scrollHeight;
    };
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, []);

  return <main ref={main} className="conversation-page" id="conversation">{children}</main>;
}
