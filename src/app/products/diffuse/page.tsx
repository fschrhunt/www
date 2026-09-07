import type { Metadata } from "next";
import Link from "next/link";
import { ReturnArrow, SocialHub } from "@/components/social-hub";
import { ScrambleLink } from "@/components/scramble-link";

export const metadata: Metadata = { title: "Diffuse · Fischer Hunt" };

/** Give the private project a useful public destination without linking to an inaccessible repo. */
export default function Diffuse() {
  return <>
    <a className="skip-link" href="#main">Skip to content</a>
    <main id="main" className="letter">
      <Link className="back-to-index" href="/"><ReturnArrow /><span>Index</span></Link>
      <article className="product-note">
        <div className="product-meta"><span>In development</span><time dateTime="2026-07-23" title="Repository created">July 2026</time></div>
        <h1>Diffuse</h1>
        <p>A second look at your pull requests.</p>
        <p>I’m working on a tool that reviews code before it lands. It reads the changes in context, investigates possible issues, and checks its findings before leaving a review.</p>
        <p>It’s still on my desk for now. If you’re curious, <ScrambleLink href="/contact">get in touch</ScrambleLink>.</p>
      </article>
    </main>
    <SocialHub />
  </>;
}
