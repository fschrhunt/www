import { createHash } from "node:crypto";
import { Resolver } from "node:dns/promises";
import { domainToASCII } from "node:url";

export const runtime = "nodejs";
const WINDOW_MS = 600000;
const MAX_ATTEMPTS = 5;
const MAX_BODY_BYTES = 16000;
const attempts = new Map<string, { count: number; until: number }>();

/** Development-only counter, bounded and self-expiring within one process. */
function memoryRateLimited(ip: string): boolean {
  const now = Date.now();
  for (const [key, entry] of attempts) if (entry.until < now) attempts.delete(key);
  if (attempts.size >= 10000) return true;
  const entry = attempts.get(ip) ?? { count: 0, until: now + WINDOW_MS };
  entry.count++;
  attempts.set(ip, entry);
  return entry.count > MAX_ATTEMPTS;
}

/** Shared fixed-window counter across instances via an Upstash-compatible REST store (Vercel KV or Upstash). */
async function durableRateLimited(url: string, token: string, ip: string): Promise<boolean> {
  const key = `contact:rl:${ip}`;
  // INCR returns the post-increment count; EXPIRE ... NX sets the window only on the first hit.
  const response = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify([["INCR", key], ["EXPIRE", key, String(WINDOW_MS / 1000), "NX"]]),
    signal: AbortSignal.timeout(1500),
  });
  if (!response.ok) throw new Error(`rate-limit store responded ${response.status}`);
  const result = await response.json();
  const count = result?.[0]?.result;
  const expiry = result?.[1]?.result;
  if (result?.[0]?.error || result?.[1]?.error || !Number.isSafeInteger(count) || count < 1 ||
    (expiry !== 0 && expiry !== 1)) throw new Error("rate-limit store returned an invalid result");
  return count > MAX_ATTEMPTS;
}

/** Require a working shared store in production; allow memory only during local development and tests. */
async function rateLimited(ip: string): Promise<boolean> {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_URL ? process.env.KV_REST_API_TOKEN : process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) return durableRateLimited(url, token, ip);
  if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) return memoryRateLimited(ip);
  throw new Error("rate-limit store is not configured");
}

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
  if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES) return fail("That note is too long.", 413);
  let data;
  try {
    // Bound the bytes while reading, including requests without Content-Length.
    const reader = request.body?.getReader();
    const buffer = new Uint8Array(MAX_BODY_BYTES);
    let size = 0;
    if (reader) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (size + value.byteLength > MAX_BODY_BYTES) {
            void reader.cancel().catch(() => {});
            return fail("That note is too long.", 413);
          }
          buffer.set(value, size);
          size += value.byteLength;
        }
      } finally { reader.releaseLock(); }
    }
    data = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, size)));
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

  // Apply the shared limit before DNS or mail provider requests.
  const ip = request.headers.get("x-vercel-forwarded-for") ?? request.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  try {
    if (await rateLimited(ip)) return fail("A few too many notes at once. Try again in ten minutes.", 429);
  } catch { return fail("Sending is temporarily unavailable. Your note is still here. Please try again shortly.", 503); }
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
