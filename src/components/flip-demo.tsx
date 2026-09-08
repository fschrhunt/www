"use client";

import { useState } from "react";
import styles from "./showcase.module.css";

/** A small illustration of opening and closing an app's note, not a live macOS window. */
export function FlipDemo() {
  const [flipped, setFlipped] = useState(false);
  return <figure className={styles.productShowcase}>
    <div className={styles.flipExample}>
      <button className={styles.showcaseBar} onClick={() => setFlipped(!flipped)} aria-pressed={flipped} aria-label={flipped ? "Return to example window" : "Show example app note"}>
        <span aria-hidden="true">● ● ●</span><span>{flipped ? "TextEdit · note" : "TextEdit"}</span><span aria-hidden="true">↵</span>
      </button>
      <div className={styles.flipExampleBody}>
        <p className={styles.exampleLabel}>{flipped ? "THE BACK" : "THE WINDOW"}</p>
        <p>{flipped ? "things to come back to" : "a little room to write."}</p>
        <p className={styles.exampleSecondary}>{flipped ? "try that idea before making it bigger.\nleave a note for tomorrow." : "your app stays where it is.\nyour notes are just behind it."}</p>
      </div>
    </div>
    <figcaption>Click the title bar to try the idea. In Flip, it&apos;s Option-click.</figcaption>
  </figure>;
}
