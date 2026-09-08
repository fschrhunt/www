import { createHash } from "node:crypto";
import { Resolver } from "node:dns/promises";
import { domainToASCII } from "node:url";

export const runtime = "nodejs";
const attempts = new Map<string, { count: number; until: number }>();

/** Reject only definite DNS failures; a two-second deadline leaves uncertain domains usable. */
async function emailDomainError(domain: string): Promise<string | null> {
  const resolver = new Resolver({ timeout: 800, tries: 1 });
  const timer = setTimeout(() => resolver.cancel(), 2000);
  const missing = (error: unknown) => ["ENODATA", "ENOTFOUND"].includes((error as NodeJS.ErrnoException)?.code ?? "");
  try {
    const mx = await resolver.resolveMx(domain).catch(error => {
      if (missing(error)) return [];
      throw error;
    });
    if (mx.some(record => record.exchange && record.exchange !== ".")) return null;
    if (mx.length === 1 && mx[0].priority === 0 && ["", "."].includes(mx[0].exchange)) {
      return "That email domain does not accept mail. Please edit your reply email.";
    }
    // SMTP permits A/AAAA delivery when MX is absent. DNS errors are not evidence of an invalid inbox.
    const addresses = await Promise.allSettled([resolver.resolve4(domain), resolver.resolve6(domain)]);
    if (addresses.some(result => result.status === "fulfilled" && result.value.length)) return null;
    if (addresses.every(result => result.status === "fulfilled" || missing(result.reason))) {
      return "That email domain could not be found. Please check the part after @.";
    }
    return null;
  } catch { return null; }
  finally { clearTimeout(timer); }
}

/** Validate and send one reviewed note to Fischer, never to a caller-selected recipient. */
export async function POST(request: Request) {
  const fail = (error: string, status: number) => Response.json({ error }, { status });
  const origin = request.headers.get("origin");
  try {
    if (!origin || new URL(origin).host !== (request.headers.get("host") || new URL(request.url).host)) return fail("Please send this from the contact page.", 403);
  } catch { return fail("Please send this from the contact page.", 403); }
  if (!request.headers.get("content-type")?.startsWith("application/json")) return fail("That request format isn't supported.", 415);
  if (Number(request.headers.get("content-length")) > 16000) return fail("That note is too long.", 413);
  let data;
  try {
    const raw = await request.text();
    if (raw.length > 16000) return fail("That note is too long.", 413);
    data = JSON.parse(raw);
  } catch { return fail("I couldn't read that note. Please try again.", 400); }
  if (!data || typeof data !== "object") return fail("Please check your note.", 400);
  const { name, email, subject, note, id } = data;
  if ([name, email, subject, note, id].some(value => typeof value !== "string")) return fail("Please fill in every field.", 400);
  if (!name.trim() || name.length > 80 || /[\r\n\x00]/.test(name)) return fail("Please check your name.", 400);
  if (email.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) return fail("Please check your reply email.", 400);
  const [mailbox, rawDomain] = email.split("@");
  const domain = domainToASCII(rawDomain);
  if (!domain || domain.length > 253 || !domain.split(".").every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label)) ||
    mailbox.startsWith(".") || mailbox.endsWith(".") || mailbox.includes("..") || /[\x00-\x1f\x7f]/.test(email)) return fail("Please check your reply email.", 400);
  if (!subject.trim() || subject.length > 120 || /[\r\n\x00]/.test(subject)) return fail("Please check the subject.", 400);
  if (!note.trim() || note.length > 2000 || !/^[\da-f-]{36}$/i.test(id)) return fail("Please check your message.", 400);
  const key = process.env.RESEND_API_KEY;
  if (!key) return fail("Sending isn't connected yet. Your note is still here.", 503);

  // A bounded per-instance limit complements the deployment's firewall protection.
  const now = Date.now();
  for (const [ip, entry] of attempts) if (entry.until < now) attempts.delete(ip);
  const ip = request.headers.get("x-vercel-forwarded-for") ?? request.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  const entry = attempts.get(ip) ?? { count: 0, until: now + 600000 };
  if (entry.count >= 5 || attempts.size >= 10000) return fail("A few too many notes at once. Try again in ten minutes.", 429);
  entry.count++;
  attempts.set(ip, entry);
  const domainError = await emailDomainError(domain);
  if (domainError) return fail(domainError, 400);
  const payload = {
    from: process.env.CONTACT_FROM || "fschrhunt.com <contact@fschrhunt.com>",
    to: ["fschrhunt@gmail.com"],
    reply_to: email.trim(),
    subject: subject.trim(),
    text: `${note.trim()}\n\nFrom: ${name.trim()} <${email.trim()}>\nVia fschrhunt.com`,
    headers: { "X-Contact-Source": "fschrhunt.com" },
    tags: [{ name: "source", value: "fschrhunt_com" }],
  };
  const fingerprint = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": `contact-${id}-${fingerprint}` },
      body: JSON.stringify(payload), signal: AbortSignal.timeout(15000),
    });
    const result = await response.json();
    if (!response.ok || typeof result.id !== "string") return fail("That didn't send. Your note is safe here. Please try again shortly.", 502);
    return Response.json({ sent: true });
  } catch { return fail("I couldn't confirm the send. Your note is still here. Please retry.", 502); }
}
