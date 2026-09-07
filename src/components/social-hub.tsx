import { PageLink as Link } from "@/components/page-link";

/** Curved return arrow used to enter Contact and return to the index. */
export function ReturnArrow() {
  return <svg width="17" height="17" viewBox="0 0 14 14" fill="none" aria-hidden="true">
    <path d="M5.5 4 1.5 8m0 0 4 4m-4-4H10a2.5 2.5 0 0 0 0-5H8.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}

/** Floating links to Fischer's public profiles and the local contact page. */
export function SocialHub({ contact = false }: { contact?: boolean }) {
  return <nav className="social-hub" aria-label="Find me elsewhere">
    <a href="https://x.com/fschrhunt" aria-label="Fischer on X" target="_blank" rel="noopener noreferrer">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M4 3h4l12 18h-4L4 3Zm16 0-7 8M4 21l7-8" /></svg>
      <span className="hub-tooltip" aria-hidden="true">X</span>
    </a>
    <a href="https://github.com/fschrhunt" aria-label="Fischer on GitHub" target="_blank" rel="noopener noreferrer">
      <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.86c-2.78.6-3.37-1.18-3.37-1.18-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.89 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.64-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02A9.6 9.6 0 0 1 12 6.82c.85 0 1.71.12 2.51.34 1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.76c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" /></svg>
      <span className="hub-tooltip" aria-hidden="true">GitHub</span>
    </a>
    <span className="hub-divider" aria-hidden="true" />
    <Link href="/contact" aria-label="Get in touch" aria-current={contact ? "page" : undefined}>
      <ReturnArrow />
      <span className="hub-tooltip" aria-hidden="true">Get in touch</span>
    </Link>
  </nav>;
}
