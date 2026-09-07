# Architecture

Next.js App Router with TypeScript and React. Routes are statically rendered;
small client components handle the interactions. There is no database, CMS,
server-side contact delivery, or required environment configuration.

## Routes and shared files

| Path | Responsibility |
| --- | --- |
| `src/app/page.tsx` | Introduction, expandable About passage, product and note indexes, update date |
| `src/app/products/{e,flip,diffuse}/page.tsx` | Product descriptions and demos |
| `src/app/notes/welcome-who-dis/page.tsx` | First note and its metadata |
| `src/app/notes/big-bro/page.tsx` | Thank-you to Fischer’s brother, with an interactive family photo album |
| `src/app/notes/five-lines/page.tsx` | Long note on reviewing agent changes, with section anchors |
| `src/app/notes/i-aquired-a-color/page.tsx` | Fischer blue note, color swatch, and metadata |
| `src/app/contact/page.tsx` | Contact layout and navigation |
| `src/app/layout.tsx` | Local font, document metadata, favicon links |
| `src/app/template.tsx` | Route remount boundary for entrance effects |
| `src/site-updated.json` | UTC update timestamp rendered in the homepage footer |
| `src/app/globals.css` | Current shared styles and motion |

New notes currently need a route and a homepage index entry. Keep route metadata
and reading time consistent with the text. No content framework is needed yet.
New page directions can use scoped CSS or their own components without changing
the accepted homepage. Read the agent kit for creative decisions.

## Client behavior

- `bro-photos.tsx` spreads a family photo pile on mouse hover, or pins it open
  with a keyboard/touch button. On phones the open row scrolls horizontally.
  Full photo aspect ratios are preserved; reduced motion skips the transition.

- `about-passage.tsx` remembers its first opening in session storage for the current
  tab. Internal navigation and reloads keep its handwritten invitation hidden.
  Memory provides a fallback when storage is unavailable. The annotation uses Benji Script and a locally drawn bracket on desktop.
  At narrower widths it sits to the right with a pointed brace. Both markers
  draw once from top to bottom; reduced motion shows the complete stroke. The invitation resets in a new browsing session.
- `reader-index.tsx` follows benji.org's reading layout: fixed 80px from the
  desktop top and left, inline above the article at 1080px and below. Its outline
  lists article h2/h3 headings and tracks the current section at a 128px offset,
  selecting the final section at the page end. After 100px of scroll, the article
  title fades into the rail and acts as a back-to-top button. Articles without
  subheadings show Index alone. The outline is hidden at 1080px and below.
- `page-link.tsx` uses Next's navigation event to accelerate the current document
  back to the top before changing routes. Reduced motion, modified clicks,
  external links, and fragment links keep normal navigation behavior.

- `about-passage.tsx` opens an inline biography from an About button
  with a curved arrow leading from the label downward into the passage.
  The passage expands with a staggered text reveal. Collapsed content is inert;
  reduced motion skips the transitions.
- `scramble-link.tsx` scrambles the whole label, resolving left to right while
  keeping whitespace and punctuation intact. It preserves the accessible label
  and fits temporary symbols within the measured width. CSS draws the underline
  and separate arrow mask.
- `social-hub.tsx` contains the profile links and the shared return-arrow icon.
- `contact-viewport.tsx` fits the contact frame to the visual viewport above
  mobile keyboards and keeps the latest message in view when already at the
  bottom. Pinch zoom is not disabled.
- `contact-conversation.tsx` validates name, email, and message locally, then
  prepares a `mailto:` draft. Clipboard copy is the fallback. Nothing is sent
  by the app, and replies are not persisted. Pressing `/` outside an editable
  field focuses the current reply. The shortcut leaves typing, modifier-key
  combinations, composition, loading, and the final review alone. Greetings
  arrive separately with typing dots and reading pauses; reduced motion skips
  delays and animation. Pending replies are canceled on unmount.
- `flip-demo.tsx` toggles an illustrative window between its front and note.
- `favicon-theme.tsx` selects a PNG from the browser's color preference.

## Assets

`public/portrait.png` is the supplied portrait. `scripts/generate-favicons.mjs`
traces its dark ink and exports transparent SVG, PNG, ICO, and Safari mask files.
Run it from the repository root if the portrait changes, then inspect the result
at tab-icon size. `public/link-arrow.svg` supplies the hover mask.

The seven family photos in `public/notes/big-bro/` are web-sized WebP copies of
the supplied JPEGs, with orientation applied and metadata stripped.

Inter and Caveat are locally hosted in `src/app/fonts/`, with their separate
OFL licenses. Retain both licenses. Caveat is limited to the blue About marks;
an inline SVG filter adds their crayon grain.
Product illustrations are not real captures. Product dates are repository
creation dates, and Diffuse's private repository is not linked publicly.

The footer mark is an inline SVG, not a Unicode character that can become an
emoji. Portrait links keep their hit area stationary while only the image tilts.
Touch layouts provide 44px targets for index links, navigation, and form actions.
Links and buttons suppress the native tap highlight; keyboard focus remains visible.

The family album opens individual photos in a native modal dialog after the pile
is spread. Touch users tap once to spread and again to enlarge a photo. Escape,
the Back arrow, or the dimmed background closes the viewer and restores focus.
Previous/next controls, left/right arrow keys, and horizontal swipes move through
the album and wrap at either end. The modal stays open and focus stays put while
photos change. Its frame follows the photo aspect ratio, with Back centered above, navigation
arrows beside the vertical midpoint, and the count centered below. On narrow
screens the arrows sit inside the photo edges to leave more room for the image.
