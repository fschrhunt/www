import type { Metadata } from "next";
import { ReaderIndex } from "@/components/reader-index";
import { SocialHub } from "@/components/social-hub";

export const metadata: Metadata = {
  title: "I aquired a color! · Fischer Hunt",
  description: "My favorite blue has a name now. Conveniently, mine.",
};

/** A short note giving Fischer's favorite blue an entirely unofficial name. */
export default function ColorNote() {
  return <>
    <a className="skip-link" href="#main">Skip to content</a>
    <main id="main" className="letter reader-page">
      <ReaderIndex />
      <article className="product-note">
        <h1>I aquired a color!</h1>
        <div className="product-meta"><time dateTime="2026-08-30">August 30, 2026</time><span>1 min read</span></div>
        <p>this is my favorite blue.</p>
        <figure className="color-note-swatch">
          <div role="img" aria-label="A swatch of Fischer blue, hex 3565C5"><span>fischer blue</span></div>
          <figcaption><span>#3565C5</span><span>rgb 53, 101, 197</span></figcaption>
        </figure>
        <p>i wanted something to call it besides &quot;that blue.&quot; #3565C5 is precise, but it sounds like a replacement part.</p>
        <p>so, fischer blue. i checked with myself and the decision was unanimous.</p>
        <p>for the record, it is a real color. #3565C5 is just a way to write its red, green, and blue values. a color doesn&apos;t need a name to exist.</p>
        <p>fischer blue is the unofficial part. i didn&apos;t discover a new wavelength. i just think my favorite color deserves a name, and mine was right there.</p>
        <p>anyway, i have a color now. feel free to use it. i&apos;d be terrible at keeping track.</p>
      </article>
    </main>
    <SocialHub />
  </>;
}
