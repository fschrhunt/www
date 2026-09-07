# Architecture

Next.js App Router with TypeScript and React. Routes are statically rendered;
small client components handle the interactions. There is no database, CMS,
server-side contact delivery, or required environment configuration.

## Routes and shared files

| Path | Responsibility |
| --- | --- |
| `src/app/page.tsx` | Introduction, product and note indexes, credit |
| `src/app/products/{e,flip,diffuse}/page.tsx` | Product descriptions and demos |
| `src/app/notes/welcome-who-dis/page.tsx` | First note and its metadata |
| `src/app/contact/page.tsx` | Contact layout and navigation |
| `src/app/layout.tsx` | Local font, document metadata, favicon links |
| `src/app/template.tsx` | Route remount boundary for entrance effects |
| `src/app/globals.css` | Current shared styles and motion |

New notes currently need a route and a homepage index entry. Keep route metadata
and reading time consistent with the text. No content framework is needed yet.
New page directions can use scoped CSS or their own components without changing
the accepted homepage. Read the agent kit for creative decisions.

## Client behavior

- `scramble-link.tsx` preserves the accessible label and fits the temporary
  symbols within its measured width. CSS draws the underline and arrow mask.
- `social-hub.tsx` contains the profile links and the shared return-arrow icon.
- `contact-viewport.tsx` fits the contact frame to the visual viewport above
  mobile keyboards and keeps the latest message in view when already at the
  bottom. Pinch zoom is not disabled.
- `contact-conversation.tsx` validates name, email, and message locally, then
  prepares a `mailto:` draft. Clipboard copy is the fallback. Nothing is sent
  by the app, and replies are not persisted.
- `flip-demo.tsx` toggles an illustrative window between its front and note.
- `favicon-theme.tsx` selects a PNG from the browser's color preference.

## Assets

`public/portrait.png` is the supplied portrait. `scripts/generate-favicons.mjs`
traces its dark ink and exports transparent SVG, PNG, ICO, and Safari mask files.
Run it from the repository root if the portrait changes, then inspect the result
at tab-icon size. `public/link-arrow.svg` supplies the hover mask.

Inter and its separate OFL license are in `src/app/fonts/`. Retain that license.
Product illustrations are not real captures. Product dates are repository
creation dates, and Diffuse's private repository is not linked publicly.

The footer mark is an inline SVG, not a Unicode character that can become an
emoji. Portrait links keep their hit area stationary while only the image tilts.
Touch layouts provide 44px targets for index links, navigation, and form actions.
