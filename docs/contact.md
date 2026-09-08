# Contact email

The browser posts the reviewed name, reply email, subject, and message to
`/api/contact`. The server uses Resend's HTTPS API without an extra SDK.

Set `RESEND_API_KEY` in Vercel for Production, Preview, and Development. Use a
sending key restricted to the verified domain. Run `vercel env pull .env.local`
for local testing. Never put this key in a `NEXT_PUBLIC_` variable or Git.
The optional `CONTACT_FROM` defaults to `fschrhunt.com <contact@fschrhunt.com>`.
That domain must be verified in Resend. Gmail cannot be the From domain through
Resend because we cannot authenticate gmail.com's DNS.

All notes go to a fixed server-side recipient. The visitor's address is Reply-To.
The server sends plain text with source metadata. No automatic visitor receipt
is sent. Inbox routing and filtering instructions belong in the private operator
runbook.

## Sending behavior

The server reads at most 16,000 bytes before parsing JSON, cancels oversized
request streams, validates fields, refuses cross-origin browser requests, and
fixes the recipient. Each IP is limited to five attempts per ten minutes.

Production builds and Vercel deployments require a shared rate-limit store.
Set `KV_REST_API_URL` + `KV_REST_API_TOKEN` or
`UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`. The endpoint calls the
Upstash-compatible REST API directly using `INCR` and a first-hit `EXPIRE`.
Missing configuration, store outages, and invalid counter or expiry responses
return 503 before DNS or email requests. The visitor's draft remains available.
Only local development and tests can use a per-process memory limit when no
store is configured. Configure and verify the store before deploying this change.

The arithmetic question is browser-side interaction only. It must not be relied
on for server authorization or bot verification. Deployment controls and security
follow-up work belong in the private operator runbook.

The baseline Content Security Policy restricts object embeds, base URLs, framing,
and form actions. It does not define a script policy.

A draft UUID and payload hash form the Resend idempotency key. Retrying an
unchanged note cannot duplicate it within Resend's idempotency window. Editing
the note changes that key. Timeouts and provider errors keep the card open.
Only provider acceptance triggers success, flight, and the original swoosh.
Acceptance is not inbox delivery; check Resend delivery events and the actual
destination inbox when verifying. DNS authentication helps but cannot guarantee that
the receiving provider will never classify a note as spam.

Suggested subjects use three to five words, such as "Bug report for Flip" or
"A potential collaboration". The rules rank explicit requests above generic questions and thanks, and prefer
the product in the relevant sentence. Multiple product mentions do not force an
arbitrary choice. Common negated phrases such as "not a bug report" are ignored.
Hiring invitations use "A potential job opportunity". Unfamiliar messages use "A note for Fischer" instead of copying the opening sentence.
Visitors can still edit the subject freely within the existing 120-character
limit. The original message stays intact. Test subject suggestions with
`node --test scripts/contact-subject.test.mjs`.

## Verification

Before sending, the existing server endpoint checks the reply domain through
Node's DNS resolver. It rejects a null MX record or missing MX and A/AAAA records.
An A or AAAA record alone remains usable, as required by
[RFC 7505](https://www.rfc-editor.org/rfc/rfc7505.html). International domain names
are converted for the lookup; the entered reply address stays intact. DNS failures
and a two-second lookup deadline let the note proceed. The existing attempt limit
also bounds these checks. No additional API key or paid verification service is used;
DNS runs within the existing Vercel function's compute allowance.

This checks domain routing only, not mailbox existence or ownership. It does not
send verification messages or attempt SMTP mailbox probes. A domain error keeps
the review open so the visitor can correct their email. DNS runs only when the
reviewed note is submitted.

Run `node --test scripts/contact-send.test.mjs` for validation, domain checks, fixed routing,
retry keys, streamed body limits, shared-store failures, missing configuration, and provider failures. These tests stub DNS and the provider and send no mail. A real end-to-end check requires the API key and a
verified domain. Send a clearly labeled test only when authorized, then check
Resend's delivery status and the destination inbox. Local changes must be deployed
before they change the public contact page.

The conversation takes the name exactly as typed. There is no name parsing,
dictionary, or conversation understanding: whatever the visitor enters becomes the
name, and the reply repeats it back. This follows
[W3C name guidance](https://www.w3.org/International/questions/qa-personal-names)
by never judging what a real name looks like. Names and messages remain editable
in review. Composer hints identify what to enter, and reloading starts a fresh
draft.

Email entry trims outside whitespace and spaces around `@` and lowercases the
domain, preserving the mailbox. The only check is shape — a mailbox, an `@`, and a
dotted domain — so an unfinished address keeps the form on Email with a plain
retry. There is no provider typo correction. Message fields use browser spellcheck
without rewriting the message. Test the browser rules with
`node --test scripts/contact-rules.test.mjs`.

The final step is a human check: one small arithmetic question ("what's 5 plus
4?") answered as a digit or a spelled-out word. A wrong answer asks again with the
same sum; a correct answer opens the review. It is the visible, in-character bot
interaction and is not verified server-side. See the sending requirements above.

The review keeps sender fields together under From on desktop. On phones, Name
and Email have separate aligned labels and single-line inputs. Long values scroll
within their field while editing instead of wrapping into the neighboring row.
The card follows the visual viewport above the keyboard, keeping its send footer
visible. Focusing a field scrolls only the review body enough to reveal it. In a
short viewport, the introductory review bubble hides to leave more editing room. While sending,
the draft is locked and repeat clicks are ignored. Failure preserves all fields;
success moves keyboard focus to Start over.
