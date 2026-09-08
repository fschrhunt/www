import { ScrambleLink } from "@/components/scramble-link";
import { SocialHub } from "@/components/social-hub";

/** A quiet, on-voice 404 that points back to the homepage instead of a bare framework page. */
export default function NotFound() {
  return <>
    <main id="main" className="letter">
      <div className="letter-note">
        <h1>This page wandered off.</h1>
        <p>The link may be old, or I may have moved something. The homepage is a good place to start again.</p>
        <p><ScrambleLink href="/">Back home</ScrambleLink></p>
      </div>
    </main>
    <SocialHub />
  </>;
}
