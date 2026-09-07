/** Accelerate to the document top, then finish navigation; return a cancellation function. */
export function scrollToTop(onComplete: () => void = () => {}) {
  const start = window.scrollY;
  if (start < 40 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    window.scrollTo({ top: 0, behavior: "instant" });
    onComplete();
    return () => {};
  }
  const started = performance.now();
  const duration = Math.min(440, 240 + start / 12);
  let frame = 0;
  function tick(now: number) {
    const progress = Math.min(1, (now - started) / duration);
    window.scrollTo({ top: start * (1 - progress ** 3), behavior: "instant" });
    if (progress < 1) frame = requestAnimationFrame(tick);
    else onComplete();
  }
  frame = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frame);
}
