"use client";

import { useEffect } from "react";
import { ScrambleLink } from "@/components/scramble-link";
import { SocialHub } from "@/components/social-hub";

/** Keep the site's voice when a route throws, offering a retry and a way home. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return <>
    <main id="main" className="letter">
      <div className="letter-note">
        <h1>Something broke on my end.</h1>
        <p>That&apos;s the site&apos;s fault, not yours. You can try again, or head back home.</p>
        <p>
          <button type="button" className="text-link error-retry" onClick={reset}><span className="link-label"><span>Try again</span></span></button>
          <ScrambleLink href="/">Back home</ScrambleLink>
        </p>
      </div>
    </main>
    <SocialHub />
  </>;
}
