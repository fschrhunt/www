# Writing a note

Create `src/content/writings/my-note.md`:

```md
---
title: "My note"
date: "2026-09-07"
description: "A short description for search results and link previews."
---

Start writing here. The page supplies the title and date above this text.

## A section

Use **bold**, *italics*, [links](/contact), lists, quotes, images, and code blocks.
```

The filename becomes `/writings/my-note`. Use lowercase words separated by
hyphens. Quote metadata values, especially the date. The homepage lists notes
by date, newest first, with alphabetical slugs breaking same-day ties. Reading
time is estimated at 200 words per minute. You do not need to add a route,
import a layout, or edit the homepage. Every file in this directory is published;
keep unfinished drafts outside it.

Use `.mdx` when the note includes a React component. The existing `big-bro.mdx`
shows how to import the album and place `<PhotoAlbum />` between paragraphs.
Ordinary prose still uses Markdown. Keep note-specific components in
`_components/`; shared interface components belong in `src/components/`.
MDX is compiled as repository code, so only include content you trust.

Put images in `public/writings/<slug>/` and use Markdown image syntax:
`![A useful description](/writings/my-note/photo.webp)`. Only notes with images
need an asset folder. Standard Markdown is supported; GitHub-specific tables,
strikethrough, and task lists are not enabled.

The reader outline follows `##` and `###` headings. Existing explicit heading
IDs in `damn-you-agents.mdx` preserve shared section links. Plain text links
use the site's animated link component; formatted link labels keep their markup.

Product descriptions follow the same pattern in `src/content/products/`.
Their frontmatter also requires `status`, such as `"In development"`. Product
`date` records repository creation, not a release. Descriptions are optional for
products. Homepage product links also come from these files. Add an optional
`indexLabel` to show different link text on the homepage than the page heading
(the lowercase `flip` and `diffuse` labels use it); the article still shows `title`.

Run `npm run site:stamp` after editing content. Verify with `npm run lint`,
`node --test scripts/content.test.mjs`, `npm run build`, and `npm run typecheck`.
Use `npm run dev` to preview the page at desktop and phone widths. The production
build discovers and renders all content files. Missing or invalid metadata and
duplicate `.md`/`.mdx` slugs fail the build.

Keep filenames stable after sharing a URL. If one changes, add a redirect in
`next.config.ts`. Existing `/notes/` redirects remain in place.
