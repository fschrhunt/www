# Repository and release

The source repository is `fschrhunt/www`; production is intended to follow `main`.
The README uses a plain `README` filename. The repo-local skills and prompts live
in `.agents/`, and root `AGENTS.md` routes agents to them.

## GitHub controls

Main protection follows Flip: the exact `Lint & typecheck` check is required,
the branch must be up to date, conversations must be resolved, and force-pushes
and deletion are blocked. Administrators are included. CODEOWNERS assigns
`@fschrhunt`; code-owner approval is not a merge requirement for this solo repo.
Tags are protected from deletion and force updates.

Actions default to read-only tokens and cannot approve PR reviews. CI actions
are pinned to commit SHAs. Dependabot groups weekly Actions updates into one PR
and npm maintenance into one PR, with at most one open version-update PR per
ecosystem. npm security updates have their own group. npm major upgrades are
reviewed manually so incompatible toolchain bumps do not repeatedly open PRs.
Keep dependency alerts enabled and review advisories even when a major is ignored.
Triage has narrowly scoped write permissions for labels. It uses the base-branch
workflow and reads filenames through the API; it must never check out or execute
PR code. Triage becomes active after its workflow reaches the default branch.

Labels distinguish `area:ui`, `area:infra`, `documentation`, `dependencies`, and
`security-surface`, alongside the usual issue labels. Automatic labels describe
changed paths, not a security verdict. The workflow adds labels; it does not
remove manually applied labels. Operations changes receive infrastructure and security labels; operations
READMEs also receive the documentation label. Keep path rules current when files move.

GitHub settings are remote state, not enforced by this document. Verify them
through the API when changing protections. Keep stronger existing controls;
do not weaken them to match another repo's defaults.

## Site update gate

The required `Lint & typecheck` job also runs `npm run site:check` on PRs.
Changes under `src/` or `public/`, or to Next configuration, TypeScript
configuration, package.json, or package-lock.json require a newer timestamp in
`src/site-updated.json` than the PR base has. Run `npm run site:stamp` after
website changes and include the generated file. Dependency PRs need this too.
Documentation-only PRs do not need a timestamp update.

The footer formats the timestamp as a UTC date, such as `Updated Sep 7, 2026`.
Same-day changes still require a newer timestamp, even when the visible date
stays the same. This is a recorded website update, not a claim about deployment
time. Check locally with `npm run site:check -- origin/main`.

## Deployment

Production follows `main`. The site runs on Cloudflare Workers: `wrangler.jsonc`
names the Worker, its custom domains, and the `token-usage` R2 binding, and the
Astro build supplies the pages and server code. A push to `main` runs
`.github/workflows/deploy.yml` in the `Production` environment, which is
`npm run deploy` with that environment's `CLOUDFLARE_API_TOKEN` secret and
`CLOUDFLARE_ACCOUNT_ID` variable.

The one secret is a Worker secret, set with `npx wrangler secret put RESEND_API_KEY`;
contact rate limits live in a Durable Object and need no configuration. `npm run preview` serves the built site on
the local Workers runtime; `.dev.vars` supplies local values. Keep token scopes and access notes in the private
operator runbook.

Inspect the deployment's checks and actual URL after release. Do not claim
that opening or merging a PR published the site without deployment evidence.
