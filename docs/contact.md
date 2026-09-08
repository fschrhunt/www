# Contact email

The browser posts the reviewed name, reply email, subject, and message to
`/api/contact`. The server uses Resend's HTTPS API without an extra SDK.

Set `RESEND_API_KEY` in Vercel for Production, Preview, and Development. Use a
sending key restricted to the verified domain. Run `vercel env pull .env.local`
for local testing. Never put this key in a `NEXT_PUBLIC_` variable or Git.
The optional `CONTACT_FROM` defaults to `fschrhunt.com <contact@fschrhunt.com>`.
That domain must be verified in Resend. Gmail cannot be the From domain through
Resend because we cannot authenticate gmail.com's DNS.

All notes go to `fschrhunt@gmail.com`. The visitor's address is Reply-To, so a
normal Gmail reply goes to them. Their name and address also appear below the
message. The server sends plain text, an `X-Contact-Source: fschrhunt.com` header,
and a Resend source tag. No automatic visitor receipt is sent.

## Gmail label

In Gmail settings, create a filter with From `contact@fschrhunt.com` and To
`fschrhunt@gmail.com`. Choose Apply the label, then create `fschrhunt.com`.
This keeps the reviewed subject unchanged. Metadata cannot create a Gmail label;
the filter is an inbox setting. If CONTACT_FROM changes, update the filter too.

## Sending behavior

The server bounds and validates fields, refuses cross-origin browser requests,
fixes the recipient, and limits each IP to five attempts per ten minutes per
running instance. This in-memory limit resets on cold starts and is not shared
across Vercel instances. Configure a Vercel firewall rate-limit rule for
`/api/contact` for durable deployment-level abuse control. Origin checks alone
are not bot protection.

A draft UUID and payload hash form the Resend idempotency key. Retrying an
unchanged note cannot duplicate it within Resend's idempotency window. Editing
the note changes that key. Timeouts and provider errors keep the card open.
Only provider acceptance triggers success, flight, and the original swoosh.
Acceptance is not inbox delivery; check Resend delivery events and the actual
Gmail inbox when verifying. DNS authentication helps but cannot guarantee that
Gmail will never classify a note as spam.

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
the review open so the visitor can correct their email. Composer typo suggestions
still run locally; DNS runs only when the reviewed note is submitted.

Run `node --test scripts/contact-send.test.mjs` for validation, domain checks, fixed routing,
retry keys, missing configuration, and provider failures. These tests stub DNS and the provider and send no mail. A real end-to-end check requires the API key and a
verified domain. Send a clearly labeled test only when authorized, then check
Resend's delivery status and the Gmail label. Local changes must be deployed
before they change the public contact page.

Name parsing runs entirely in the browser, with no model, download, or inference API.
It extracts explicit introductions such as "my name is", "the names", and "call me",
while preserving the name's spelling, script, case, and internal spacing. Bare names
need no dictionary match. A few clear conversational signals, email addresses, and
unfinished introductions ask what name to use. Repeating the same answer accepts
it as entered, so the heuristic cannot permanently exclude an unusual name.
This is limited parsing, not identity validation or general conversation understanding.
The approach follows [W3C name guidance](https://www.w3.org/International/questions/qa-personal-names). Names and messages
remain editable in review. Composer hints identify what to enter. Reloading starts a fresh draft; corrections
can be made in the review. Typed messages are never navigation commands.
Email entry trims outside whitespace and spaces around @ and
lowercases the domain, preserving the mailbox. A unique single-letter edit or adjacent swap in a common .com provider, or a
listed .com suffix typo, prompts “did you mean?” with buttons to use the suggestion
or keep the original. Custom suffixes, subdomains, and mailbox spelling are preserved. Suggestions are
heuristics, not domain ownership checks. Keeping the original suppresses another
prompt for that domain until Start over.
Starting over, going back, or submitting another answer clears the suggestion. Message fields use browser spellcheck without rewriting the message.

The review keeps sender fields together under From on desktop. On phones, Name
and Email have separate aligned labels and single-line inputs. Long values scroll
within their field while editing instead of wrapping into the neighboring row.
The card follows the visual viewport above the keyboard, keeping its send footer
visible. Focusing a field scrolls only the review body enough to reveal it. In a
short viewport, the introductory review bubble hides to leave more editing room. While sending,
the draft is locked and repeat clicks are ignored. Failure preserves all fields;
success moves keyboard focus to Start over.
