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

## Check the behavior that changed

- Pages: inspect desktop and a narrow phone viewport. Follow links into and out
  of the page, check wrapping, and reach the last control past the floating hub.
- Hover: inspect intermediate scramble frames, not only the settled state.
  Symbols must not reach the arrow or move neighboring dates. Check focus,
  pointer exit, and reduced motion.
- Entrance: check direct load and internal navigation. Local state changes such
  as a Flip demo click must not replay the page entrance.
- Contact: test the visual viewport shrinking with a keyboard, including the
  latest message, composer, and review controls staying in view. Test on native
  mobile Safari when available; a simulated viewport is not a keyboard test.
  Use fictional input, try a greeting as a name, a conversational introduction,
  the name override, repeated small talk at different steps, name corrections,
  back/start-over commands, invalid email, and a multiline message,
  inspect the draft's recipient and encoded body, and check Start over. Do not
  send the test email. Verify the clipboard fallback only when relevant.
- Favicons: inspect alpha and small-size readability, then switch browser color
  preference. Chromium emulation does not verify native Safari's tab behavior.

Use focused regression tests where behavior warrants them. Copy changes do not
need tests that assert their wording. Docs-only changes need link and format
checks, not a production build. Report any verification limits.

Contact name rules have focused regression coverage. Run
`node --test scripts/contact-rules.test.mjs` on Node 22.18 or newer.
