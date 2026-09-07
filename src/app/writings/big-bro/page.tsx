import type { Metadata } from "next";
import { ReaderIndex } from "@/components/reader-index";
import { SocialHub } from "@/components/social-hub";
import { PhotoAlbum } from "./_components/photo-album";

export const metadata: Metadata = {
  title: "big bro · Fischer Hunt",
  description: "For my brother. My most consistent friend and least convenient person to argue with.",
};

/** A thank-you to Fischer's brother, with an interactive pile of childhood photographs. */
export default function BigBroNote() {
  return <>
    <a className="skip-link" href="#main">Skip to content</a>
    <main id="main" className="letter reader-page">
      <ReaderIndex />
      <article className="product-note">
        <h1>big bro</h1>
        <div className="product-meta"><time dateTime="2026-09-07">September 7, 2026</time><span>2 min read</span></div>
        <PhotoAlbum />
        <p>my brother is pretty much my only consistent friend. he&apos;s also someone i can disagree with at considerable length. these facts have somehow coexisted for years.</p>
        <p>we&apos;ve had our ups and downs. arguments, debates, the occasional discovery that having an opinion and being able to defend it are two different things. i prefer making that discovery about him.</p>
        <p>i don&apos;t particularly enjoy being challenged. i would like to say something confidently and have that be the end of it. unfortunately, my brother has follow-up questions.</p>
        <p>but having someone who pushes back forces me to learn. i have to understand what i&apos;m talking about, explain it, and sometimes admit that i don&apos;t know enough yet. annoying things to require of a person who was feeling very correct a minute ago.</p>
        <p>i&apos;m grateful for that, even when my immediate response suggests otherwise.</p>
        <p>more than the debates, though, i&apos;m grateful that he&apos;s been there. through the good parts and the parts i wouldn&apos;t put in a photo album. he knows more versions of me than most people ever will, and he&apos;s still my friend.</p>
        <p>i wouldn&apos;t be where i am without him. i wanted to put that somewhere i couldn&apos;t immediately take it back with a joke.</p>
        <p>love you. this is a thank-you, not a concession. we can resume being wrong about each other tomorrow.</p>
        <p>&gt; p.s. if you&apos;re reading this, don&apos;t make it weird next time i see you.</p>
      </article>
    </main>
    <SocialHub />
  </>;
}
