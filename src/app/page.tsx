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
      <h1>I build things. What they add up to, I&apos;m still figuring out.</h1>
    </header>
    <AboutPassage />
    <section className="products" aria-labelledby="products-heading">
      <h2 id="products-heading">Products</h2>
      <ul>
        {products.map(product => <li key={product.slug}>
          <ScrambleLink href={`/products/${product.slug}`} className={product.slug === "e" ? "product-e" : undefined}>{product.indexLabel ?? product.title}</ScrambleLink>
          <time dateTime={product.date} title="Repository created">{new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(product.date))}</time>
        </li>)}
      </ul>
    </section>
    <section className="products writings" aria-labelledby="writings-heading">
      <h2 id="writings-heading">Writings</h2>
      <ul>{writings.map(writing => <li key={writing.slug}>
        <ScrambleLink href={`/writings/${writing.slug}`}>{writing.title}</ScrambleLink>
        <span className="reading-time">{writing.readingTime}</span>
      </li>)}</ul>
    </section>
    <footer className="letter-footer"><time dateTime={siteUpdate.updatedAt}>Updated {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(siteUpdate.updatedAt))}</time><a className="token-usage-link" href="/token-usage" aria-label="Token usage" title="Token usage"><Image src="/chip.svg" alt="" width={28} height={28} /></a></footer>
  </main>
  <SocialHub />
  </>;
}
