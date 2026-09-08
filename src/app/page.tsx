import Image from "next/image";
import { getContentEntries } from "@/lib/content";
import siteUpdate from "@/site-updated.json";
import { AboutPassage } from "@/components/about-passage";
import { SocialHub } from "@/components/social-hub";
import { ScrambleLink } from "@/components/scramble-link";

/** The homepage portrait has no link and keeps its hover tilt within a stationary frame. */
function Portrait() {
  return <div className="portrait">
    <Image src="/portrait.png" alt="An illustrated portrait of Fischer" width={160} height={160} sizes="160px" preload />
  </div>;
}

/** A personal letter with an inline About passage, products, writings, and contact hub. */
export default function Home() {
  const products = getContentEntries("products");
  const writings = getContentEntries("writings");
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
        {products.map(product => <li key={product.slug}>
          <ScrambleLink href={`/products/${product.slug}`} className={product.slug === "e" ? "product-e" : undefined}>{product.slug === "flip" || product.slug === "diffuse" ? product.title.toLowerCase() : product.title}</ScrambleLink>
          <time dateTime={product.date} title="Repository created">{new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(product.date))}</time>
        </li>)}
      </ul>
    </section>
    <section className="products notes" aria-labelledby="writings-heading">
      <h2 id="writings-heading">Writings</h2>
      <ul>{writings.map(writing => <li key={writing.slug}>
        <ScrambleLink href={`/writings/${writing.slug}`}>{writing.title}</ScrambleLink>
        <span className="reading-time">{writing.readingTime}</span>
      </li>)}</ul>
    </section>
    <footer className="letter-footer"><time dateTime={siteUpdate.updatedAt}>Updated {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(siteUpdate.updatedAt))}</time><svg className="tiny-mark" width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 2v16M2 10h16M4.35 4.35l11.3 11.3M4.35 15.65l11.3-11.3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg></footer>
  </main>
  <SocialHub />
  </>;
}
