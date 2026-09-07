import Image from "next/image";
import siteUpdate from "@/site-updated.json";
import { AboutPassage } from "@/components/about-passage";
import { PageLink as Link } from "@/components/page-link";
import { SocialHub } from "@/components/social-hub";
import { ScrambleLink } from "@/components/scramble-link";

// Dates record repository creation, not a product launch or public release.
const products = [
  { name: "Flip", href: "/products/flip", date: "2026-09-07", label: "September 2026" },
  { name: "𝑒", href: "/products/e", date: "2026-08-21", label: "August 2026" },
  { name: "Diffuse", href: "/products/diffuse", date: "2026-07-23", label: "July 2026" },
];

/** The supplied portrait, framed around its transparent padding and tilted on hover. */
function Portrait() {
  return <Link className="portrait" href="/" aria-label="Fischer’s home page">
    <Image src="/portrait.png" alt="An illustrated portrait of Fischer" width={160} height={160} sizes="160px" preload />
  </Link>;
}

/** A personal letter with an inline About passage, products, writings, and contact hub. */
export default function Home() {
  return <>
    <a className="skip-link" href="#main">Skip to content</a>
    <main id="main" className="letter">
    <Portrait />
    <header className="letter-note">
      <p className="muted">Hello, I’m Fischer. <span className="name-pronunciation"><span aria-hidden="true">/&apos;fish-er/</span><span className="sr-only">Pronounced fish-er.</span></span></p>
      <h1>I make software, mostly for the terminal and the Mac.<br className="desktop-break" /> Small things that make the everyday a little nicer.</h1>
    </header>
    <AboutPassage />
    <section className="products" aria-labelledby="products-heading">
      <h2 id="products-heading">Products</h2>
      <ul>
        {products.map(product => <li key={product.name}>
          <ScrambleLink href={product.href}>{product.name}</ScrambleLink>
          <time dateTime={product.date} title="Repository created">{product.label}</time>
        </li>)}
      </ul>
    </section>
    <section className="products notes" aria-labelledby="writings-heading">
      <h2 id="writings-heading">Writings</h2>
      <ul><li>
        <ScrambleLink href="/notes/big-bro">big bro</ScrambleLink>
        <span className="reading-time">2 min read</span>
      </li><li>
        <ScrambleLink href="/notes/five-lines">damn you, agents</ScrambleLink>
        <span className="reading-time">5 min read</span>
      </li><li>
        <ScrambleLink href="/notes/i-aquired-a-color">I aquired a color!</ScrambleLink>
        <span className="reading-time">1 min read</span>
      </li><li>
        <ScrambleLink href="/notes/welcome-who-dis">welcome who dis?</ScrambleLink>
        <span className="reading-time">1 min read</span>
      </li></ul>
    </section>
    <footer className="letter-footer"><time dateTime={siteUpdate.updatedAt}>Updated {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(siteUpdate.updatedAt))}</time><svg className="tiny-mark" width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 2v16M2 10h16M4.35 4.35l11.3 11.3M4.35 15.65l11.3-11.3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg></footer>
  </main>
  <SocialHub />
  </>;
}
