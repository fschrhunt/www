# Private usage collector

The standalone token-usage prototype is in `prototypes/token-usage/`. The `/token-usage` page consumes a public aggregate snapshot from Vercel Blob. The collector is a separate server runtime;
it does not add a website API route, public database, or network listener.

## Installed on server

On September 8, 2026, the Codex and OpenCode collectors were installed on SSH host
`server`. Codex uses these paths:

- Source: `ops/token-usage/collector.py` and adjacent systemd units.
- Runtime: `/srv/apps/token-usage/current`, pointing to a root-owned release.
- Service account: `token-usage`, with no login shell, sudo, or Docker membership.
- Private configuration: `/srv/apps/token-usage/shared/env/config.json`.
- Database: `/srv/apps/token-usage/shared/data/usage.sqlite`.
- Sanitized snapshot: `/srv/apps/token-usage/shared/data/snapshot.json`.
- Collection status: `/srv/apps/token-usage/shared/data/status.json`.
- Schedule: `token-usage.timer`, every five minutes with up to 20 seconds of jitter.

The first backfill requested February 23 through September 8, 2026 in 28-day
chunks. The endpoint returned 112 dates spanning May 10 through September 8,
with 347 model/day rows across nine model IDs. Dates omitted by the provider
are not invented or treated as confirmed zero usage. The normal poll refreshes
today and the preceding seven UTC dates. Longer backfills can reconcile older
provider corrections.

OpenCode uses `opencode_collector.py` in the same release and service account, with
its own `token-usage-opencode.service` and five-minute `token-usage-opencode.timer`.
Its private data files are `opencode.sqlite`, `opencode-snapshot.json`, and
`opencode-status.json` in the same data directory. Systemd supplies `opencode-auth`
and `opencode-config.json` from the root-only environment directory.

The OpenCode backfill requested January through September 2026 and returned 43
model/day rows across 12 models on 21 dates, August 19 through September 8. A
repeat poll left every stored model cost unchanged. The initial SQLite backup
`opencode.initial-backup.sqlite` passed an integrity check.

## Source and units

The collector reads the authenticated ChatGPT dashboard endpoint
`GET /backend-api/wham/analytics/daily-workspace-usage-counts`, with `start_date`,
`end_date`, `group_by=day`, and a specific `workspace_user` filter. That filter
was taken from Fischer's own dashboard request. It is private runtime configuration,
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

The working login is on the server at `/home/fischer/.codex/auth.json`. No MacBook
credentials were copied for Codex. OpenCode uses the console cookie explicitly
transferred by the interactive helper described below. On every service invocation, systemd reads that existing
file through `LoadCredential` and supplies a private, temporary credential file.
The collector cannot browse Fischer's home directory or modify the original login.
Systemd likewise supplies the private collector configuration.

The collector uses the current access token and **does not refresh or rotate it**.
A subsequent Codex login refresh on the server is picked up at the next invocation.
If the provider rejects an expired login, status becomes `codex_login_expired` and
the last successful snapshot remains intact. To renew the server login, use the
normal Codex login flow on that server, for example `ssh -t server codex login
--device-auth`. Never paste a token into chat, a shell argument, or the website.
An independent, unattended credential-renewal workflow is still outstanding.

The service has a read-only filesystem apart from its data directory, hidden home
directories, no Linux capabilities, restricted system calls, and a private temporary
directory. Files in the data directory use mode 0600. Outbound HTTPS is permitted;
there is no incoming listener and no firewall rule was added. Redirects are refused
so credentials cannot follow a redirect to another origin. Logs contain success
counts and safe failure categories, not response bodies or credentials.

HTTP 429 backs off for one hour, login failures for 30 minutes, and other failures
for ten minutes. `status.json` and the snapshot's `updatedAt` allow a future publisher
to detect stale data. The snapshot publisher runs separately; external alerting is not configured.

## Operations

```sh
ssh server 'systemctl list-timers token-usage.timer --no-pager'
ssh server 'sudo systemctl start token-usage.service'
ssh server 'sudo journalctl -u token-usage.service -n 20 --no-pager'
ssh server 'sudo cat /srv/apps/token-usage/shared/data/status.json'
ssh server 'systemctl list-timers token-usage-opencode.timer --no-pager'
ssh server 'sudo systemctl start token-usage-opencode.service'
ssh server 'sudo cat /srv/apps/token-usage/shared/data/opencode-status.json'
```

The source uses only Python's standard library. Local verification:

```sh
python3 -B -m unittest discover -s ops/token-usage -p 'test_*.py'
```

Deployment copies reviewed source into a new immutable release directory, flips
`current`, installs the systemd units, and reloads systemd. Never edit runtime
source in place. Stop the timer before maintenance or another backfill. Use the
same service restrictions and add `--start YYYY-MM-DD` for historical Codex
collection, or `--start YYYY-MM` for OpenCode.

An initial SQLite backup is stored privately beside the database as
`usage.initial-backup.sqlite`; opening that backup and running `integrity_check`
verified it after the initial backfill. This is an on-server recovery copy, not an
off-server or recurring backup. Backup retention and recovery automation remain
unconfigured. Stop collection before restoring. Disabling collection is reversible:

```sh
ssh server 'sudo systemctl disable --now token-usage.timer'
```

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

To connect the existing OpenCode console session, run
`python3 ops/token-usage/connect-opencode.py` interactively on the Mac. It reads
only the Usage-page URL from `~/Downloads/opencode.ai.har`, then prompts with hidden
input for the `auth` cookie value from Helium's Developer Tools, Application,
Cookies, `https://opencode.ai`. The cookie grants console-session account access;
it is not a read-only API key. The helper sends it over SSH stdin, verifies the
Usage page from the server without following redirects, and only then stores it
as root-owned mode 0600 in `shared/env/opencode-auth`. Its associated usage-page
URL goes in `shared/env/opencode-config.json`. No credential is printed or placed
in command arguments. The helper preserves existing function configuration and does not change the
OpenCode timer. Replace an expired or revoked session through the same procedure;
the next poll after backoff reads the replacement credential. Session renewal is
manual.
The helper identifies itself as `token-usage/1.0`; the console returned HTTP 403
for Python’s default user agent even on its public homepage during verification.

## Claude and website delivery

Claude's server login retrieves quota percentages and resets, but an account-wide
cloud source for daily model token history has not been verified. Separate
incremental Claude Code and Codex log collectors now run on the Mac, mini, and server every
five minutes. They upload counters through restricted SSH keys into a private
central ledger, with durable local queues for offline recovery. See
[Claude collection](claude-collection.md) for deployment, measurements, and recovery.
Quotas are not substituted for token counts.

The publisher converts model usage into dollar values and writes only allowlisted
aggregate fields to the dedicated Vercel Blob store every fifteen minutes. Private
SQLite files, credentials, and raw provider responses remain on the server. See
[usage publishing](usage-publishing.md) for pricing, delivery, and freshness.

Codex account profile buckets preserve older daily token totals when available.
These totals do not provide model-level input/output/cache counters. The publisher
uses retained local Codex records for dollar calculations and never treats zero
charged overage credits as zero subscription usage. See [publishing](usage-publishing.md).
