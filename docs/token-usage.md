# Private usage collector

The `/token-usage` page consumes a public aggregate snapshot from Vercel Blob. The collector is a separate server runtime;
it does not add a website API route, public database, or network listener.

## Runtime layout

The [operations README](../ops/token-usage/README.md) documents source folders,
flat installed releases, service templates, and private setup configuration.
Each collector runs as a restricted service account with its own SQLite ledger,
aggregate snapshot, and status file. The templates collect every five minutes.
Exact host aliases, operator login paths, account identifiers, and installation
history belong in the private operator runbook, outside this repository.

Normal Codex polls refresh today and the preceding seven UTC dates. Missing
provider dates are not invented or treated as confirmed zero usage. Longer
backfills can reconcile older provider corrections. OpenCode has a separate
ledger and schedule, so its USD values never enter the Codex credit ledger.

## Source and units

The collector reads the authenticated ChatGPT dashboard endpoint
`GET /backend-api/wham/analytics/daily-workspace-usage-counts`, with `start_date`,
`end_date`, `group_by=day`, and a specific `workspace_user` filter. That filter
comes from the authorized account dashboard request. It is private runtime configuration,
not checked into Git.

This is an internal dashboard endpoint, not a stable public API contract. Its
response and server access were verified directly before deployment. The collector
validates units, dates, model IDs, and numeric values before updating the ledger.

Per-model usage is **credits**, stored as decimal strings. Token totals are scoped
to **all models** for each date. They cannot be allocated to individual models from
this response, and credits cannot be labeled or added as USD. Model IDs remain
unchanged in storage; presentation can display `gpt-5.5` as `GPT 5.5`.

Each returned day replaces its previous records in one SQLite transaction.
Re-polling does not add the same usage twice. A changed account is rejected to
avoid merging different people's usage. Account identifiers stay inside the
private database; the snapshot omits identities, API keys, prompts, and sessions.

## Authentication and boundaries

Systemd supplies the approved Codex login through `LoadCredential`, using a
private drop-in that names its source path. The collector cannot browse the
operator's home directory or modify the original login. OpenCode uses a console
cookie transferred by the interactive helper described below. Collector settings
also arrive through private systemd credentials.

The collector uses the current access token and **does not refresh or rotate it**.
A subsequent Codex login refresh on the server is picked up at the next invocation.
If the provider rejects an expired login, status becomes `codex_login_expired` and
the last successful snapshot remains intact. To renew the server login, use the
normal Codex login flow on the authorized host. Never paste a token into chat, a shell argument, or the website.
Record credential-renewal procedures in the private operator runbook.

The service has a read-only filesystem apart from its data directory, hidden home
directories, no Linux capabilities, restricted system calls, and a private temporary
directory. Files in the data directory use mode 0600. Outbound HTTPS is permitted;
there is no incoming listener and no firewall rule was added. Redirects are refused
so credentials cannot follow a redirect to another origin. Logs contain success
counts and safe failure categories, not response bodies or credentials.

HTTP 429 backs off for one hour, login failures for 30 minutes, and other failures
for ten minutes. `status.json` and the snapshot's `updatedAt` allow the publisher
to detect stale data. The snapshot publisher runs separately; verify external alerting in the private deployment runbook.

## Operations

Use the configured SSH destination from the private runbook. Inspect the relevant
systemd timer, service result, and sanitized status file. Check collection and
publisher freshness separately; a successful publisher cannot make an offline
source current. Do not paste raw host status or journal output into public issues.

Run local tests using the command in the
[operations README](../ops/token-usage/README.md). Deployment copies the contents
of `runtime/` into a new immutable release, validates it, and switches `current`.
Install reviewed units from `systemd/` with the required private credential
overrides, then reload systemd. Never edit live source in place or overwrite an
existing host's private configuration from a repository template.

Stop affected schedules for ledger maintenance or a backfill. Preserve service
restrictions and use `--start YYYY-MM-DD` for Codex or `--start YYYY-MM` for
OpenCode. Stop collection before restoring SQLite, retain a verified recovery
copy, and follow the [device replay procedure](claude-collection.md) when needed.
Disabling a timer does not require deleting its ledger or the public snapshot.
Verify backup retention and recovery on the actual installation.

## OpenCode source and login

OpenCode reads the console's internal `POST /_server` function for monthly daily
model costs. The function headers were taken from the authenticated Usage-page
HAR and saved in private server configuration. A site release can change these
headers or the response format; this is not a supported public API. Update the
captured function headers if that happens. The collector parses only the observed
usage-array grammar and never evaluates JavaScript. Unexpected rows fail the
entire poll before it changes the ledger.

Costs are stored as integer units of 1/100,000,000 USD, summed across API keys and
plans for each model/day. The snapshot exports decimal USD usage costs, not actual
subscription payments. It contains no API-key identities or inferred token counts.
Codex credits remain separate. Monthly requests use UTC day boundaries, which can
differ from the console viewed in a local timezone.

Normal polling replaces the current and previous calendar months atomically,
including corrected or removed rows. Older corrections require a backfill. A
changed workspace is rejected. Login failures and format changes preserve the
last successful snapshot, with backoff recorded in `opencode-status.json`.
Sanitized HAR files are diagnostic captures, not reusable login sessions. No raw
HAR file is part of this repository or runtime.

To connect an authorized console session, run the interactive
`ops/token-usage/setup/connect-opencode.py` helper with an explicit SSH alias and
private HAR path, as documented in the operations README. It reads only the usage
URL from the capture and prompts for the `auth` cookie with hidden input. The
cookie grants console-session account access; it is not a read-only API key.

The helper sends the credential over SSH stdin, verifies the console page without
following redirects, and stores it in a root-owned private directory with mode
0600. It preserves existing function configuration and does not change schedules.
Replace expired or revoked sessions through the same procedure. Session renewal
is manual. Raw HAR files can contain credentials and must stay outside Git.

## Claude and website delivery

Claude's server login retrieves quota percentages and resets, but an account-wide
cloud source for daily model token history has not been verified. Separate
incremental Claude Code and Codex log collectors run on authorized senders every
five minutes. They upload counters through restricted SSH keys into a private
central ledger, with durable local queues for offline recovery. See
[Claude collection](claude-collection.md) for transport and recovery.
Quotas are not substituted for token counts.

The publisher converts model usage into dollar values and writes only allowlisted
aggregate fields to the dedicated Vercel Blob store every fifteen minutes. Private
SQLite files, credentials, and raw provider responses remain on the server. See
[usage publishing](usage-publishing.md) for pricing, delivery, and freshness.

Codex account profile buckets preserve older daily token totals when available.
These totals do not provide model-level input/output/cache counters. The publisher
uses retained local Codex records for dollar calculations and never treats zero
charged overage credits as zero subscription usage. See [publishing](usage-publishing.md).
