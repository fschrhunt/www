/** Replay the shared entrance on navigation without animating form updates. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-entry">{children}</div>;
}
