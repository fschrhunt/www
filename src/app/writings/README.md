# Writings

Each writing owns its route, metadata, and any private components.

- `big-bro/page.tsx`: the writing; `big-bro/_components/photo-album.tsx`: its interactive album.
- `damn-you-agents/page.tsx`: the longer writing about reviewing generated code.
- `i-aquired-a-color/page.tsx`: the color writing and its HTML swatch.
- `welcome-who-dis/page.tsx`: the introduction.

To add a writing:

1. Create `<slug>/page.tsx` here with its metadata and content.
2. Reuse `ReaderIndex` and `SocialHub` from `src/components/`.
3. Keep components used only by this writing in `<slug>/_components/`.
4. Put images in `public/writings/<slug>/` and reference them as `/writings/<slug>/<file>`.
5. Add its link and reading time to the Writings section in `src/app/page.tsx`.
6. Update `docs/architecture.md` and run `npm run site:stamp`.

Text-only writings do not need empty media folders. The color swatch is HTML,
so it does not need an image file. Shared components belong in `src/components/`
only when more than one page uses them.

Previous `/notes/` URLs redirect through `next.config.ts`. Keep those redirects
so bookmarks and previously shared links keep working.
