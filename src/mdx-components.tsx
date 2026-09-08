import type { ComponentProps } from "react";
import type { MDXComponents } from "mdx/types";
import { ScrambleLink } from "@/components/scramble-link";

/** Keep text-only Markdown links animated; formatted link labels retain their markup. */
function ContentLink({ children, href, ...props }: ComponentProps<"a">) {
  if (href && typeof children === "string") {
    return <ScrambleLink href={href} {...props}>{children}</ScrambleLink>;
  }
  return <a href={href} {...props}>{children}</a>;
}

/** Supply the site's link treatment to both Markdown and MDX pages. */
export function useMDXComponents(): MDXComponents {
  return { a: ContentLink };
}
