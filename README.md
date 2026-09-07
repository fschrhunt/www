# www

Fischer's corner of the internet. The favicon received an unreasonable amount
of attention. There is also some writing.

A small personal site with product pages for e, Flip, and Diffuse, occasional
notes, and a contact form that opens your email app. Built with Next.js, React,
and TypeScript. Design inspiration from [Shed](https://shedsgns.me/).

## Run it

```sh
npm ci
npm run dev
```

Open http://localhost:3000. No environment variables required.

## Where things live

- `src/app/page.tsx`: the introduction, products, and notes index.
- `src/app/products/`: product descriptions and small workflow illustrations.
- `src/app/notes/`: writing. No publishing system to maintain before writing a second post.
- `src/components/contact-conversation.tsx`: the contact conversation. It prepares
  an email draft; it does not send or store messages on a server.
- `src/app/globals.css`: the soft monochrome styling and motion.
- `public/portrait.png`: the face. It tilts. This was a requirement.

Product dates record repository creation, not launch dates. Diffuse's repository
is private, so its page describes the project without linking to the source.
Flip's clickable window is an illustration, not a screenshot of the native app.
Inter is hosted locally, with its license in `src/app/fonts/`.

## The small things

Page navigation uses a short fade, blur, and rise. Links scramble their final
characters while an underline draws and a curved arrow appears. Wider symbols
fit inside the original label so the letters cannot escape into the arrow again.
Motion respects reduced-motion preferences. The cursor stays a normal arrow.

To rebuild the transparent portrait favicons:

```sh
node scripts/generate-favicons.mjs
```

The browser's color preference selects charcoal or soft white PNG artwork.
A separate SVG mask supports Safari pinned tabs. Without JavaScript, the
charcoal fallback remains. Native Safari's live theme switching still needs
verification; [WebKit has an open SVG favicon theme bug](https://bugs.webkit.org/show_bug.cgi?id=309949).

## Before shipping

```sh
npm run lint
npm run build
npm run typecheck
```

`npm start` serves the production build. Deploy with Vercel's Next.js preset,
using `main` as the production branch. The Git integration and public domain
must be configured in Vercel; opening a PR alone does not publish the site.
