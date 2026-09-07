"use client";

import { useEffect } from "react";

/** Select a transparent PNG from the browser theme, avoiding SVG media-query bugs. */
export function FaviconTheme() {
  useEffect(() => {
    const preference = window.matchMedia("(prefers-color-scheme: dark)");
    const icon = document.getElementById("site-favicon") as HTMLLinkElement | null;
    const update = () => {
      if (icon) icon.href = preference.matches ? "/favicon-dark.png" : "/favicon-light.png";
    };
    update();
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);

  return null;
}
