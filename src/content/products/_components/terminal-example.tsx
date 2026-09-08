import styles from "@/components/showcase.module.css";

/** Show the two existing terminal entry points for 𝑒. */
export function TerminalExample() {
  return <figure className={styles.productShowcase}>
  <div className={styles.terminalExample}>
    <div className={styles.showcaseBar}><span aria-hidden="true">● ● ●</span><span>terminal</span></div>
    <pre><code><span className={styles.terminalComment}># start a session</span>{'\n'}$ e{'\n\n'}<span className={styles.terminalComment}># or start with a question</span>{'\n'}$ e &quot;why is this function 400 lines long&quot;</code></pre>
  </div>
  <figcaption>Two ways in, from the same terminal.</figcaption>
</figure>;
}
