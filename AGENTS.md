# Working on www

This is Fischer's personal website. Let it sound like someone lives here.
Read `.agents/site.md` when changing the site's writing, appearance, or behavior.
The user's current direction takes precedence over these defaults. New pages
can have their own art direction. Do not treat the homepage's layout, palette,
or type scale as limits on a creative brief.

## Find the work

- `README`: setup commands and a short overview.
- `docs/README.md`: technical documentation index.
- `docs/architecture.md`: routes, shared components, assets, and data boundaries.
- `docs/verification.md`: checks and relevant browser workflows.
- `docs/repository.md`: GitHub controls, labeling, and Vercel release behavior.
- `docs/licensing.md`: proprietary all-rights-reserved terms and third-party licenses.

Read only the docs relevant to the task. Check the actual code and remote state
when facts may have changed. Keep touched documentation accurate as paths move.

Use the relevant local skill, not the entire folder:

- `.agents/skills/www-write/SKILL.md` for notes, product copy, and humor.
- `.agents/skills/www-design/SKILL.md` for new pages and visual changes.
- `.agents/skills/www-review/SKILL.md` for a requested critique or a substantial
  page's final visual review. A typo does not need a design review.

Reusable task prompts live in `.agents/prompts/`. See `.agents/README.md`.
These are repo-local instructions, not permission to publish, push, or deploy.
Follow the authorization already present in the conversation.

Keep changes within the task and preserve unrelated work. Prefer the existing
Next.js components and CSS to new dependencies. Comment new components and
helpers with their purpose; keep touched docs accurate.

For code changes, run the checks appropriate to the change. Before a release,
run `npm run lint`, `npm run build`, and `npm run typecheck`. For visual changes,
inspect the running page at desktop and phone widths. Report what you actually
verified. Do not call a design pixel-perfect based on source inspection alone.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
