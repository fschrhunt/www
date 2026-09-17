import type { AnchorHTMLAttributes } from "react";

type TextLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "children" | "href"> & {
  children: string;
  href: string;
};

/** Keep the label still while CSS animates the underline and trailing arrow. */
export function TextLink({ children, className = "", ...props }: TextLinkProps) {
  return (
    <a {...props} className={`text-link ${className}`}>
      <span className="link-label">{children}</span>
    </a>
  );
}
