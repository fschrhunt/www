/** Show the two existing terminal entry points for 𝑒. */
export function TerminalExample() {
  return <figure className="product-showcase">
  <div className="terminal-example">
    <div className="showcase-bar"><span aria-hidden="true">● ● ●</span><span>terminal</span></div>
    <pre><code><span className="terminal-comment"># start a session</span>{'\n'}$ e{'\n\n'}<span className="terminal-comment"># or start with a question</span>{'\n'}$ e &quot;why is this function 400 lines long&quot;</code></pre>
  </div>
  <figcaption>Two ways in, from the same terminal.</figcaption>
</figure>;
}
