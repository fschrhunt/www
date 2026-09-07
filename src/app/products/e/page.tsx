import type { Metadata } from "next";
import { ReaderIndex } from "@/components/reader-index";
import { SocialHub } from "@/components/social-hub";
import { ScrambleLink } from "@/components/scramble-link";

export const metadata: Metadata = {
  title: "𝑒 · Fischer Hunt",
  description: "A small coding agent for the terminal. One Rust binary, with tools, commands, themes, and skills.",
};

/** Introduce 𝑒 through its terminal workflow and link to the project's documentation. */
export default function E() {
  return <>
    <a className="skip-link" href="#main">Skip to content</a>
    <main id="main" className="letter reader-page">
      <ReaderIndex />
      <article className="product-note">
        <h1>𝑒</h1>
        <div className="product-meta"><span>In development</span><time dateTime="2026-08-21" title="Repository created">August 2026</time></div>
        <p>A small coding agent for the terminal.</p>
        <p>𝑒 is a tool I&apos;m building for working on code from the command line. Open it in a project, ask a question, and work from there.</p>
        <figure className="product-showcase">
          <div className="terminal-example">
            <div className="showcase-bar"><span aria-hidden="true">● ● ●</span><span>terminal</span></div>
            <pre><code><span className="terminal-comment"># start a session</span>{'\n'}$ e{'\n\n'}<span className="terminal-comment"># or start with a question</span>{'\n'}$ e &quot;why is this function 400 lines long&quot;</code></pre>
          </div>
          <figcaption>Two ways in, from the same terminal.</figcaption>
        </figure>
        <p>It&apos;s one Rust binary, with tools, commands, themes, prompts, and skills. Executable extensions can add tools and commands, or hook into a session.</p>
        <p>I&apos;m still working on it. The code and setup instructions are on GitHub.</p>
        <p><ScrambleLink href="https://github.com/intuitums/e">Explore 𝑒 on GitHub</ScrambleLink></p>
      </article>
    </main>
    <SocialHub />
  </>;
}
