/**
 * Contact helpers. The conversation takes the name as given and never tries to
 * parse, correct, or second-guess it. It only checks that an email is shaped
 * like an email and that a person can answer one small arithmetic question.
 */

/** Remove paste spacing around email separators; preserve the mailbox spelling and case. */
export function tidyContactEmail(value: string) {
  const compact = value.trim().replace(/\s*@\s*/g, "@");
  const at = compact.lastIndexOf("@");
  return at < 0 ? compact : compact.slice(0, at + 1) + compact.slice(at + 1).toLowerCase();
}

/** True when the address has a mailbox, an @, and a dotted domain. Shape only, not deliverability. */
export function isContactEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

const numberWords = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
  "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen"];

/** A tiny arithmetic prompt a person clears in a second and a form-filling bot ignores. */
export function humanChallenge(): { question: string; answer: number } {
  const a = 2 + Math.floor(Math.random() * 5);
  const b = 2 + Math.floor(Math.random() * 5);
  return { question: `${a} plus ${b}`, answer: a + b };
}

/** Accept the sum as digits or a spelled-out word, ignoring any words around it. */
export function isHumanAnswer(input: string, answer: number) {
  const text = input.trim().toLowerCase();
  if (new RegExp(`(^|\\D)${answer}(\\D|$)`).test(text)) return true;
  const word = numberWords[answer];
  return Boolean(word) && new RegExp(`\\b${word}\\b`).test(text);
}
