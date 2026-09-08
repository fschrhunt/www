# Verification

Use Node.js 22 or newer. From the repository root:

```sh
npm ci
npm run dev
```

The dev server uses http://localhost:3000. For a release:

```sh
npm run lint
npm run build
npm run typecheck
npm start
```

Build before standalone typechecking on a clean checkout so generated Next.js
route types exist. CI runs the same order. `npm audit` checks dependency
advisories; investigate findings rather than applying a breaking fix blindly.
Do not run a production server and a dev server against the same output directory
while comparing builds. Stop the server or use a separate checkout.

Content metadata and reading-time checks run with
`node --test scripts/content.test.mjs`. A production build also compiles every
Markdown and MDX file. See [the writing guide](../src/content/README.md).

## Check the behavior that changed

- Pages: inspect desktop and a narrow phone viewport. Follow links into and out
  of the page, check wrapping, and reach the last control past the floating hub.
- Hover: inspect intermediate scramble frames, not only the settled state.
  Symbols must not reach the arrow or move neighboring dates. Check focus,
  pointer exit, and reduced motion.
- Entrance: check direct load and internal navigation. Local state changes such
  as opening About must not replay the page entrance.
- Contact: test the visual viewport shrinking with a keyboard, including the
  latest message, composer, and review controls staying in view. Test on native
  mobile Safari when available; a simulated viewport is not a keyboard test.
  Use fictional input. Verify an unusual name is preserved without a personalized
  greeting. Verify "The names fischer" becomes "fischer" in review, conversational
  input stays on Name, and repeating a questioned name accepts it. Verify
  invalid email stays on Email, and email corrections remain optional.
  Check editable review fields, a fresh draft after reloading, a multiline
  message, and literal messages such as "back" or "how are you?".
  Inspect the reviewed fields, verify failed sends preserve them, and check Start over. Do not
  send the test email. Verify the clipboard fallback only when relevant.
- Favicons: inspect alpha and small-size readability, then switch browser color
  preference. Chromium emulation does not verify native Safari's tab behavior.

Use focused regression tests where behavior warrants them. Copy changes do not
need tests that assert their wording. Docs-only changes need link and format
checks, not a production build. Report any verification limits.

Contact name and email helpers have focused regression coverage.
`node --test scripts/contact-send.test.mjs` checks domain rejection, address-record
fallbacks, and temporary DNS failures with DNS and the mail provider stubbed.
`node --test scripts/contact-subject.test.mjs` checks subject intent and product selection. Run
`node --test scripts/contact-rules.test.mjs` on Node 22.18 or newer.

## Real token usage

`/token-usage` loads the public Blob snapshot. Verify a real total, creator icons,
left/right wheel motion, keyboard dates, and pointer exit at desktop and phone
widths. Check a date with many models for tooltip clipping. Failed refreshes must
retain the last total; source and publisher freshness are in the total hover title.
See [usage publishing](usage-publishing.md) for the data contract.
