import type { Metadata } from "next";
import { ReaderIndex } from "@/components/reader-index";
import { SocialHub } from "@/components/social-hub";
import { ScrambleLink } from "@/components/scramble-link";

export const metadata: Metadata = {
  title: "welcome who dis? · Fischer Hunt",
  description: "The site has a favicon. Now comes the difficult part: having something to say.",
};

/** A first note about making the site and finally putting something on it. */
export default function WelcomeNote() {
  return <>
    <a className="skip-link" href="#main">Skip to content</a>
    <main id="main" className="letter reader-page">
      <ReaderIndex />
      <article className="product-note">
        <h1>welcome who dis?</h1>
        <div className="product-meta"><time dateTime="2026-08-26">August 26, 2026</time><span>1 min read</span></div>
        <p>this was supposed to be a quick personal website.</p>
        <p>then the font was wrong. then the hover was wrong. then the hover was almost right, which is much worse because now you know it can be right.</p>
        <p>at one point, the scrambled text was running into the little arrow beside it. even the letters were trying to leave.</p>
        <p>anyway. welcome.</p>
        <p>i originally called this a blog, then renamed the repo before i had anything to post. good to get the important work out of the way.</p>
        <p>i want to write down the bits that usually disappear once something works. what i tried, what broke, what i deleted. the finished thing rarely tells you how many bad versions came before it. i&apos;d prefer not to discuss those.</p>
        <p>no posting schedule. i&apos;m not giving myself a manager just because i own a domain.</p>
        <p>if you&apos;re here early, there isn&apos;t much to read yet. please enjoy the favicon. i worked hard on that.</p>
        <p><ScrambleLink href="/contact">say hi</ScrambleLink></p>
      </article>
    </main>
    <SocialHub />
  </>;
}
