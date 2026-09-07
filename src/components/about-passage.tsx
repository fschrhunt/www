"use client";

import { useState, useSyncExternalStore } from "react";
import localFont from "next/font/local";

const crayon = localFont({ src: "../app/fonts/caveat.ttf", variable: "--font-crayon", display: "swap", weight: "400 700" });
let openedThisVisit = false;

/** Remember About within this document, including client-side page navigation. */
function hasOpenedAbout() { return openedThisVisit; }

/** Notify mounted disclosures when About is opened during this visit. */
function subscribeToAbout(callback: () => void) {
  window.addEventListener("about-opened", callback);
  return () => window.removeEventListener("about-opened", callback);
}

/** Keep the invitation still until the client checks this visit's interaction. */
function serverSnapshot() { return true; }

/** An inline About disclosure that animates to the passage's natural height. */
export function AboutPassage() {
  const [open, setOpen] = useState(false);
  const hasOpened = useSyncExternalStore(subscribeToAbout, hasOpenedAbout, serverSnapshot);

  /** Retire the invitation for this visit, independently of expanded state. */
  function toggleAbout() {
    if (!open && !hasOpened) {
      openedThisVisit = true;
      window.dispatchEvent(new Event("about-opened"));
    }
    setOpen(!open);
  }

  return <section className={`about-passage ${crayon.variable}`} aria-labelledby="about-heading">
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
      <button className="about-trigger" type="button" data-unopened={!hasOpened} aria-expanded={open} aria-controls="about-content" onClick={toggleAbout}>
        <span className="about-label">About</span> <svg className="about-arrow" width="20" height="22" viewBox="0 0 20 22" fill="none" aria-hidden="true">
          <path d="M1 10c3-.5 5.4.7 7.3.1 3-.5 5.2 2 4.7 5.2l.1 2.7m-4.3-3.7 4.3 3.7 3.8-4.2" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </h2>
    <div id="about-content" className="about-reveal" data-open={open} inert={!open}>
      <div className="about-clip">
        <div className="about-body">
          <div className="about-title">
            <p className="about-opening">I&apos;m Fischer. I&apos;m 16.</p>
          </div>
          <p>I run, cycle, and swim. I realized my entire life was tech and I didn&apos;t really have a hobby outside it. I missed playing sports, so I picked them back up. Now I also have Strava activities to post.</p>
          <p>I started coding pretty young, if writing Roblox scripts to cheat at games counts. Then I took a break from being a nerd to try being the guy everyone liked. In hindsight, a questionable use of my time.</p>
          <p>OpenClaw got me back into coding. What happened to them btw? The idea of AGI, and how different life could be in five years, made me want to help build some part of it.</p>
          <p>It&apos;s been hell ever since. Mostly reading a 400-line function an agent wrote for something that needed five.</p>
          <p className="about-postscript">My favorite color is the blue up there. That part of the website is finished.</p>
        </div>
      </div>
    </div>
  </section>;
}
