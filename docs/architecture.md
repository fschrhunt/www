# Architecture

Next.js App Router with TypeScript and React. Routes are statically rendered;
small client components handle the interactions. There is no database, CMS,
server-side contact delivery, or required environment configuration.

## Routes and shared files

| Path | Responsibility |
| --- | --- |
| `src/app/page.tsx` | Introduction, expandable About passage, product and note indexes, update date |
| `src/app/products/[slug]/page.tsx` | Static product routes rendered from Markdown and MDX |
| `src/app/writings/[slug]/page.tsx` | Static writing routes rendered from Markdown and MDX |
| `src/content/{writings,products}/` | Prose files with YAML frontmatter and local components |
| `src/lib/content.ts` | Metadata validation, file discovery, date ordering, and reading-time estimates |
| `src/components/content-page.tsx` | Shared article shell, title, date, and navigation |
| `src/mdx-components.tsx` | Markdown links mapped to the site's link treatment |
| `src/app/contact/page.tsx` | Contact layout and navigation |
| `src/app/layout.tsx` | Local font, document metadata, favicon links |
| `src/app/template.tsx` | Route remount boundary for entrance effects |
| `src/site-updated.json` | UTC update timestamp rendered in the homepage footer |
| `src/app/globals.css` | Current shared styles and motion |

New notes need only a `.md` or `.mdx` file in `src/content/writings/`. Product
prose lives in `src/content/products/`. The homepage discovers both collections
and orders them by date. Writings require title, date, and description; products
require title, date, and status. Reading time is estimated from prose at 200 words
per minute. `@next/mdx` compiles content at build time, `remark-frontmatter` removes
the metadata block from the rendered body, and `gray-matter` reads it for listings
and page metadata. Content imports and interactive components remain normal React
code; there is no runtime content evaluation or CMS. Unknown slugs return 404.
New page directions can use scoped CSS or their own components without changing
the accepted homepage. Read the agent kit for creative decisions.

## Client behavior

- `src/content/writings/_components/photo-album.tsx` spreads a family photo pile on mouse hover, or pins it open
  with a keyboard/touch button. On phones the open row scrolls horizontally.
  Full photo aspect ratios are preserved; reduced motion skips the transition.

- `about-passage.tsx` remembers its first opening in session storage for the current
  tab. Internal navigation and reloads keep its handwritten invitation hidden.
  Memory provides a fallback when storage is unavailable. The annotation uses Benji Script and a locally drawn bracket on desktop.
  At narrower widths it sits to the right with a square bracket. Both markers
  draw once from top to bottom; reduced motion shows the complete stroke. The invitation resets in a new browsing session.
- `reader-index.tsx` follows benji.org's reading layout: fixed 80px from the
  desktop top and left, inline above the article at 1080px and below. Its outline
  lists article h2/h3 headings and tracks the current section at a 128px offset,
  selecting the final section at the page end. After 100px of scroll, the article
  title fades into the rail and acts as a back-to-top button. Articles without
  subheadings show Index alone. The outline is hidden at 1080px and below.
- Page links use Next's normal navigation directly, without scrolling the old
  page first. Only the article title's dedicated back-to-top button uses the
  animated scroll helper.

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
  bottom. The review card uses the same height and offset in portrait and landscape.
  Focus and viewport changes reveal obscured review inputs by scrolling the card
  body; tall message fields retain native caret scrolling. Short viewports hide
  the review introduction while retaining the send footer. Pinch zoom is not disabled.
- `contact-conversation.tsx` validates name, email, and message locally, then
  opens an editable review and sends through `/api/contact` using Resend.
  Conversation replies are not persisted. Pressing `/` outside an editable
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

The seven family photos in `public/writings/big-bro/` are web-sized WebP copies of
the supplied JPEGs, with orientation applied and metadata stripped.

Inter and Caveat are locally hosted in `src/app/fonts/`, with their separate
OFL licenses. Retain both licenses. Caveat is limited to the blue About marks;
an inline SVG filter adds their crayon grain.
Product illustrations are not real captures. Product dates are repository
creation dates, and Diffuse's private repository is not linked publicly.

The footer mark is an inline SVG, not a Unicode character that can become an
emoji. The homepage portrait has no link; the contact portrait links home.
Portrait containers stay stationary while only the image tilts.
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

The contact form collects name, email, and message through composer hints and
accessible field labels. No label or navigation row sits above the composer.
Names preserve spelling and case. Explicit introductions are extracted locally;
ambiguous conversational answers prompt clarification, with repeat entry accepted
as confirmation. Messages retain their content with outside whitespace trimmed.
There is no spelling repair, general chatbot, or typed-command interpretation. Replies never interpolate the entered name. Reloading starts a fresh draft. The review
lets visitors edit every field and closes with Escape or a click on the dimmed area.

`src/lib/contact-rules.ts` handles browser-only name parsing, email cleanup, and
optional provider typo suggestions. It uses no model or external inference service. Invalid email syntax keeps the form on Email. A proposed correction
can be accepted or declined; the server still validates the chosen address.
No data goes to the contact endpoint until the visitor sends the reviewed note.
That endpoint checks reply-domain DNS before sending, rejecting explicit no-mail
domains and missing mail routes while allowing temporary DNS failures. It cannot
verify a mailbox exists or belongs to the visitor.

The contact reply queue switches the composer hint to the next accepted field
immediately, then enables that field after the reply finishes. The hints are
"your name", "you@example.com", and "your message". Visitor bubbles share the
send button's blue; Fischer replies and the review prompt stay gray.
The queue cancels superseded timers and records only unsent bubbles. Development effect restarts resume that queue without replaying the
introduction or resetting the active question. A synchronous busy guard blocks
duplicate submissions before React renders the disabled composer.

## Writing folders

Content lives in `src/content/writings/<slug>.md` or `.mdx`; its static route is
rendered by `src/app/writings/[slug]/page.tsx`. Note-specific components stay in
`src/content/writings/_components/`. Static media mirrors the slug under
`public/writings/`. Only writings with media need an asset folder. See
[the writing guide](../src/content/README.md) for adding a page.
Legacy `/notes/` routes and image paths redirect to `/writings/`; the previous
`five-lines` slug redirects to `damn-you-agents`.

`contact-review.tsx` opens a native modal above the transcript, showing recipient,
editable visitor details, subject, and complete message. The card scrolls
independently of the final action. `src/lib/contact-subject.ts` suggests an editable subject of three to five
words using product and topic matches. Unrecognized topics use a short generic
label instead of copying the first sentence. It never rewrites the message. The server uses the reviewed subject.
The card begins with the recipient. A soft grey Fischer chat bubble sits above it, outside the card. Only the send arrow
appears in the bottom row. Escape or clicking the dimmed area dismisses the modal. The card rises from the composer over a lightly dimmed, blurred background. Dismissal preserves edits and returns focus to the review control. The up arrow posts the reviewed fields to `/api/contact`. Only after Resend accepts
the email does the card fly upward with an original synthesized swoosh. Reduced
motion skips travel. Errors preserve edits and allow a retry with the same
idempotency key. Acceptance does not guarantee inbox placement. See
[contact setup](contact.md) for credentials, delivery, limits, and Gmail labeling.
