/** Extract explicit introductions without changing name spelling; null requests clarification, not rejection. */
export function parseContactName(value: string): string | null {
  const answer = value.trim();
  const introduction = /^(?:(?:hi|hello|hey)[,!]?\s+)?(?:my name is|my name['’]s|the name(?:['’]s|s| is)|call me|you can call me)\s+/iu;
  const candidate = answer.replace(introduction, "").trim();
  // Recognize clear conversational signals, never a dictionary of valid names.
  const conversation = /^(?:hi|hello|hey|thanks|thank you)[!.]*$|^(?:i(?:['’]m| am| want| need| would| was)|how are|what is|what['’]s|can you|could you|please help)\b|\b(?:and|but|because)\s+(?:i|my|you|it)\b/iu;
  if (!candidate || /[?？\r\n@]|https?:\/\//iu.test(candidate) || conversation.test(candidate)) return null;
  if (/^(?:my name is|my name['’]s|the name(?:['’]s|s| is)|call me|you can call me)$/iu.test(candidate)) return null;
  return candidate;
}

/** Remove paste spacing around email separators; preserve the mailbox spelling and case. */
export function tidyContactEmail(value: string) {
  const compact = value.trim().replace(/\s*@\s*/g, "@");
  const at = compact.lastIndexOf("@");
  return at < 0 ? compact : compact.slice(0, at + 1) + compact.slice(at + 1).toLowerCase();
}

/** Match one insertion, deletion, replacement, or adjacent swap without broad fuzzy guessing. */
function oneEmailTypo(a: string, b: string): boolean {
  if (a === b || Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (a[i] === b[i] && i < Math.min(a.length, b.length)) i++;
  if (a.length !== b.length) {
    const [longer, shorter] = a.length > b.length ? [a, b] : [b, a];
    return longer.slice(i + 1) === shorter.slice(i);
  }
  return a.slice(i + 1) === b.slice(i + 1) ||
    (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2));
}

/** Offer a unique near-match to a common provider, preserving mailbox and legitimate suffixes. */
export function suggestContactEmail(value: string): string | undefined {
  const address = tidyContactEmail(value);
  const match = address.match(/^([^\s@<>]+)@([a-z]+)\.([a-z]+)$/u);
  if (!match) return;
  const [, mailbox, provider, suffix] = match;
  const providers = ["gmail", "hotmail", "outlook", "yahoo", "icloud", "protonmail", "proton", "fastmail"];
  // Real country and alternative suffixes are not spelling mistakes.
  const mistypedCom = ["con", "cmo", "ocm", "comn", "comm", "om", "vom", "xom"];
  const otherProviders = ["mail", "ymail", "googlemail", "aol", "gmx", "live", "msn", "hey", "zoho", "rocketmail"];
  if (providers.includes(provider) || otherProviders.includes(provider)) {
    return mistypedCom.includes(suffix) ? `${mailbox}@${provider}.com` : undefined;
  }
  if (suffix !== "com" || provider.length < 4) return;
  const candidates = providers.filter(candidate => oneEmailTypo(provider, candidate));
  return candidates.length === 1 ? `${mailbox}@${candidates[0]}.com` : undefined;
}
