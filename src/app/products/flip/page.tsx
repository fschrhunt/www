import type { Metadata } from "next";
import { ReaderIndex } from "@/components/reader-index";
import { SocialHub } from "@/components/social-hub";
import { ScrambleLink } from "@/components/scramble-link";
import { FlipDemo } from "@/components/flip-demo";

export const metadata: Metadata = {
  title: "Flip · Fischer Hunt",
  description: "Notes on the back of your Mac windows. One plain-text note per app, saved locally.",
};

/** Explain Flip's per-app notes with an interactive illustration of the two sides. */
export default function Flip() {
  return <>
    <a className="skip-link" href="#main">Skip to content</a>
    <main id="main" className="letter reader-page">
      <ReaderIndex />
      <article className="product-note">
        <h1>Flip</h1>
        <div className="product-meta"><span>In development · macOS</span><time dateTime="2026-09-07" title="Repository created">September 2026</time></div>
        <p>Notes on the back of your windows.</p>
        <p>Flip gives your Mac apps somewhere to keep a note. Option-click an empty part of a window&apos;s title bar and the note opens on the other side.</p>
        <FlipDemo />
        <p>There&apos;s one plain-text note per app, shared by all its windows and saved locally. A reminder for your editor, something to come back to in your browser. Right there with the app.</p>
        <p>Option-click the note&apos;s title bar or press Escape to go back. Flip lives in the menu bar and runs on macOS 14 or newer.</p>
        <p>It&apos;s still in development. Build and setup instructions live with the code.</p>
        <p><ScrambleLink href="https://github.com/fschrhunt/flip">Explore Flip on GitHub</ScrambleLink></p>
      </article>
    </main>
    <SocialHub />
  </>;
}
