"use client";

import { useState, useSyncExternalStore } from "react";
import localFont from "next/font/local";
import { ScrambleLink } from "./scramble-link";

const crayon = localFont({ src: "../app/fonts/caveat.ttf", variable: "--font-crayon", display: "swap", weight: "400 700" });
const handwriting = localFont({ src: "../app/fonts/benji-script.woff", variable: "--font-annotation", display: "swap" });
const invitationKey = "www:about-invitation-dismissed";
let openedThisVisit = false;

/** Keep the invitation dismissed across navigation and refreshes in this tab. */
function hasOpenedAbout() {
  try { return openedThisVisit || sessionStorage.getItem(invitationKey) === "true"; }
  catch { return openedThisVisit; }
}

/** Notify mounted disclosures when About is opened during this visit. */
function subscribeToAbout(callback: () => void) {
  window.addEventListener("about-opened", callback);
  return () => window.removeEventListener("about-opened", callback);
}

/** Hide the invitation until the client checks this visit's interaction. */
function serverSnapshot() { return true; }

/** An inline About disclosure that animates to the passage's natural height. */
export function AboutPassage() {
  const [open, setOpen] = useState(false);
  const hasOpened = useSyncExternalStore(subscribeToAbout, hasOpenedAbout, serverSnapshot);

  /** Retire the invitation for this visit, independently of expanded state. */
  function toggleAbout() {
    if (!open && !hasOpened) {
      openedThisVisit = true;
      try { sessionStorage.setItem(invitationKey, "true"); }
      catch { /* Memory still preserves dismissal during internal navigation. */ }
      window.dispatchEvent(new Event("about-opened"));
    }
    setOpen(!open);
  }

  return <section className={`about-passage ${crayon.variable} ${handwriting.variable}`} aria-labelledby="about-heading">
    <svg className="crayon-definitions" width="0" height="0" aria-hidden="true">
      <defs><filter id="about-crayon" x="-10%" y="-15%" width="120%" height="130%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="3" seed="8" result="grain" />
        <feDisplacementMap in="SourceGraphic" in2="grain" scale=".7" xChannelSelector="R" yChannelSelector="G" result="rough" />
        <feColorMatrix in="grain" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  1 0 0 0 0" />
        <feComponentTransfer><feFuncA type="discrete" tableValues=".15 .45 .8 1" /></feComponentTransfer>
        <feComposite in="rough" operator="in" />
      </filter></defs>
    </svg>
    <h2 id="about-heading">
      <span className="about-annotation" data-visible={!hasOpened} aria-hidden="true">
        <span>click this</span>
        <svg width="14" height="24" viewBox="0 0 14 24" fill="none">
          <path pathLength="1" d="M2 3c3 2.5 6 5.7 9 9-3 2.8-6 5.5-9 9" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <button className="about-trigger" type="button" data-unopened={!hasOpened} aria-expanded={open} aria-controls="about-content" onClick={toggleAbout}>
        <span className="about-label">About</span> <svg className="about-arrow" width="20" height="22" viewBox="0 0 20 22" fill="none" aria-hidden="true">
          <path d="M1 10c3-.5 5.4.7 7.3.1 3-.5 5.2 2 4.7 5.2l.1 2.7m-4.3-3.7 4.3 3.7 3.8-4.2" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </h2>
    <div id="about-content" className="about-reveal" data-open={open} inert={!open}>
      <div className="about-clip">
        <div className="about-body">
          <p>My favorite color is blue, the one up there. I&apos;m 16. There, the small talk&apos;s out of the way.</p>
          <p>My hobbies, let&apos;s see. I like to <ScrambleLink href="/token-usage" className="about-inline-link">spend tokens</ScrambleLink>, go on runs, swim (even though I&apos;m bad at it), and last but not least, cycle. Tech used to be my whole life, until I picked up those hobbies. Now I have Strava activities to post and tokens to spend tinkering with AI.</p>
          <p>I started coding young, if Roblox scripts to cheat at games count. Then I shelved it, figuring the &quot;weird&quot; kid was first in line to get bullied, and spent a while trying to be likeable instead. Bad trade, in hindsight.</p>
          <p><ScrambleLink href="https://openclaw.ai" className="about-inline-link">OpenClaw</ScrambleLink> got me back into it. What happened to them btw? The idea of AGI, and how different life might look in five years, made me want to build some part of it.</p>
          <p>It&apos;s been hell ever since. Mostly reading a <ScrambleLink href="/writings/damn-you-agents" className="about-inline-link">400-line function</ScrambleLink> an agent wrote for something that needed five.</p>
          <p className="about-postscript">Anyway, that&apos;s the tour.</p>
        </div>
      </div>
    </div>
  </section>;
}
