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

## Verification

Run `node --test scripts/contact-send.test.mjs` for validation, fixed routing,
retry keys, missing configuration, and provider failures. These tests stub the
provider and send no mail. A real end-to-end check requires the API key and a
verified domain. Send a clearly labeled test only when authorized, then check
Resend's delivery status and the Gmail label. Local changes must be deployed
before they change the public contact page.
