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
are pinned to commit SHAs; Dependabot proposes weekly Actions and npm updates.
Triage has narrowly scoped write permissions for labels. It uses the base-branch
workflow and reads filenames through the API; it must never check out or execute
PR code. Triage becomes active after its workflow reaches the default branch.

Labels distinguish `area:ui`, `area:infra`, `documentation`, `dependencies`, and
`security-surface`, alongside the usual issue labels. Automatic labels describe
changed paths, not a security verdict. The workflow adds labels; it does not
remove manually applied labels. Keep its path rules current when files move.

GitHub settings are remote state, not enforced by this document. Verify them
through the API when changing protections. Keep stronger existing controls;
do not weaken them to match another repo's defaults.

## Deployment

The Vercel project is `fschrhunt/fschrhunt`. Verified on September 7, 2026,
it is connected to `fschrhunt/www` with `main` as its production branch. A PR
push triggered a preview deployment. Deployment protection was still set to
`all_except_custom_domains`; verify public access on the intended domain.

Before publishing, verify the Git connection to `fschrhunt/www`, production
branch `main`, domain, and deployment protection. Once connected, changes to
main should trigger a production build. A public GitHub repository does not
make a protected Vercel deployment public.

Inspect the deployment's checks and actual URL after release. Do not claim
that opening or merging a PR published the site without deployment evidence.
