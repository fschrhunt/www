import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ReturnArrow } from "@/components/social-hub";
import { ContactConversation } from "@/components/contact-conversation";

export const metadata: Metadata = { title: "Get in touch · Fischer Hunt" };

/** A quiet, message-style contact form with a name, reply address, and note. */
export default function Contact() {
  return <>
    <a className="skip-link" href="#conversation">Skip to conversation</a>
    <main className="conversation-page" id="conversation">
      <h1 className="sr-only">Get in touch with Fischer</h1>
      <header className="conversation-header">
        <Link className="portrait contact-portrait" href="/" aria-label="Fischer’s home page"><Image src="/portrait.png" alt="An illustrated portrait of Fischer" width={160} height={160} sizes="160px" preload /></Link>
        <Link className="back-to-index" href="/"><ReturnArrow /><span>back</span></Link>
      </header>
      <ContactConversation />
    </main>
  </>;
}
