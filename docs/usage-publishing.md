# Publishing token usage

The server combines the three private aggregate snapshots into a single public
JSON object in a dedicated public Vercel Blob store. No additional database or Vercel Cron job is needed.

`token-usage-publish.timer` runs every fifteen minutes, two minutes after the
quarter hour plus up to fifteen seconds of jitter. It calls a restricted oneshot
service and exits. The page fetches the public snapshot when opened and once per
minute while visible. Blob's browser/CDN cache lasts sixty seconds. Collection
and publishing schedules mean this is periodic freshness, not a live event stream.
Device changes can take roughly twenty minutes to appear if they just miss a device
collection and publisher cycle. Offline sources take longer.

## Public page

`src/app/token-usage/route.ts` statically serves the accepted standalone chart at
`/token-usage`. Its HTML, JavaScript, icons, and scoped favicon live in
`public/token-usage-assets/`. Keeping this full-screen route outside the site's
React layout preserves its typography, blue background, horizontal gestures, and
sound behavior. The only visible numbers remain the total and hovered model costs.
The chart tries to start its audio context on load. When browser autoplay policy
blocks it, a click, tap, or keypress retries; hover alone cannot grant permission.
The chart reads the snapshot from the same-origin `/token-usage/data.json`, which
`next.config.ts` rewrites to the public Blob; that Blob URL is public, not a
credential. Other page favicons are unchanged.

The client validates a new snapshot before replacing the current chart. A failed
refresh leaves the last loaded numbers visible. Freshness and missing-value details
are available in the total's native hover title and the chart's accessible
description, without an extra permanent label. A first visit cannot load data if
both the network and Blob are unavailable. If only the collection server is down,
Blob continues serving the previously published snapshot.

## Dollar calculation

These are usage values, not Fischer's subscription payments. The unchanged chart
displays dollar amounts without an extra estimate label, as requested. Calculation
metadata stays in the JSON and this document.

- Codex uses recorded model-level input, output, and cached-input tokens at
  [OpenAI's standard API rates](https://developers.openai.com/api/docs/pricing).
  Cached input is subtracted from the input total before pricing. Charged cloud
  credits exclude included subscription use and are never used as its price.
  Standard rates approximate usage value; fast-mode, long-context, regional,
  and cache-write premiums are not reconstructed by this calculation.
- OpenCode contributes the console's reported USD usage costs, already grouped by
  model and date. Subscription payments are not added on top.
- Claude uses actual collected token counters with current standard global API
  rates from [Anthropic's pricing table](https://platform.claude.com/docs/en/about-claude/pricing).
  Input, output, cache hits, five-minute cache writes, and one-hour cache writes
  are priced separately. Fable 5.1's cache-hit rate differs from Fable 5's.
  These standard-mode values do not apply optional fast-mode or regional premiums.

`ops/token-usage/runtime/pricing.json` records the rates and verification date. Rates are
explicitly reviewed source, not scraped at every poll. Adding a previously unseen
Claude or Codex model requires adding its verified rate. Unknown prices or unknown cache
durations remain unavailable, not guessed or treated as free. Some Claude logs
omit the combined cache-write counter while retaining the duration-specific
counters; pricing uses the known duration counters in that case.

The cache-duration upgrade reread retained Claude logs on authorized senders and
replayed their records without duplicating messages. Old seven-field uploads are
still accepted during rolling upgrades; nine-field records include both cache
write durations. The publisher merges the former `ox-alpha-free` alias into `glm-5.3-flash`,
combining their costs for each date. The public page formats
labels such as `GPT 5.5` and `Opus 4.8`.

## Security and operations

The publisher runs as `token-usage` with a 96 MiB memory limit, 10% CPU quota, a
read-only system, hidden home directories, and no Linux capabilities. Systemd
provides copies of only the aggregate snapshots and the dedicated Blob store's
write token through `LoadCredential`. It does not receive Claude or OpenCode login
cookies, Codex OAuth credentials, raw databases, or transcripts. The token is
stored root-only in `shared/env/publish-config.json` and never reaches browser
code. It grants write access to this dedicated store, not the entire Vercel account.

`publish_usage.py` validates and builds an allowlisted public schema. The only
record fields are date, model ID, and USD value, plus source freshness, missing
price metadata, and the pricing verification date. Account IDs, message hashes,
API key IDs, machine names, and private file paths are excluded. It uses the fixed
HTTPS Blob PUT endpoint and protocol version 12, as implemented by Vercel's SDK,
and refuses redirects. A Blob protocol change can require updating this small
client.

The object is overwritten at the same URL only after successful validation. A
failed poll, validation, or upload leaves the previous public object available.
Private `publish-status.json` records publisher health;
`published-snapshot.json` retains the most recently confirmed upload. Source
freshness timestamps remain unchanged when a source stops reporting. The publisher
does not mistake its own successful upload for fresh source data.

Inspect the configured publisher timer, service result, and private status file
on the authorized host. Connection details belong in the private runbook, not
in this document.

To pause publication without touching collectors or deleting the last public
snapshot, disable `token-usage-publish.timer`. Credential renewal and external failure alerts remain separate operational work.

## Retained history and backup

Cloud Codex account totals extend to February 23, 2026. The chart starts on the
first date with recorded tokens or positive costs, omitting earlier empty dates.
Retained local Codex logs begin July 28 and do not cover every intervening day.

At Fischer's request, historical gaps through September 7, 2026 are reconstructed
from the recorded daily token total at a fixed blended USD/token rate calibrated
from the priced local Codex records on September 8. The calibration is frozen in
`pricing.json`; future usage does not change that rate. Tokens already priced from
local records are subtracted first, preventing their inclusion in the backfill.
Recovered local records can replace that part of the reconstruction later.

Historical GPT model attribution is assumed, following Fischer's stated rule of
adopting the newest generally available coding flagship at release. The dated
model table and official release sources are stored with the calibration. This
assigns GPT 5.3 Codex, GPT 5.4, GPT 5.5, GPT 5.6 Sol, and GPT 6 Astra to their
respective release periods. Recorded local models always retain their identity.
The backfill's value is still the fixed blended approximation, not a historical
invoice or proof of model choice. The public JSON records this attribution method.

Fischer also requested synthetic Anthropic history. `syntheticClaude` in
`pricing.json` freezes 174 daily entries from February 23 through August 15, before
the retained Claude logs begin. Values were sampled deterministically from the
retained daily cost distribution, with variation and a gradual activity ramp.
They are invented values, not token records. Their assumed model follows the
strongest generally available Claude releases, including Fable 5's June 12
withdrawal and July 1 return. Sources and selection dates are retained in the
configuration. Public JSON separately lists synthetic dates and method.

No synthetic Claude value is added on a day with actual Claude records, and no
synthetic entry is allowed outside the frozen historical interval. OpenCode
continues using only its reported console values. The chart keeps the requested
appearance and adds no permanent provenance label. Its totals therefore include
both calculated and synthetic historical values, not actual subscription charges.

The publisher omits zero and unpriced model rows, including for older chart clients.
The client applies the same filter. The script URL has a version suffix so a page
refresh retrieves the current behavior. A tab already running older JavaScript
must be refreshed to pick up new formatting, but its next data poll removes empty
model rows without waiting for a refresh.

`token-usage-backup.timer` archives the four aggregate snapshots and pricing daily
in a separate private Blob store. The timer template defines the schedule. Dated gzip
objects include a content hash in their filename, preserving distinct archive
versions and avoiding stale reads after overwrites. The job
verifies an authenticated read before recording success in `backup-status.json`.
The archive includes token counters, model IDs, dates, and device freshness but no
transcripts or provider credentials. Its store-scoped token stays root-only on
the server, supplied to the restricted job through systemd credentials. Keep backup credentials separate from public publishing credentials and exclude
them from website deployments. Record the actual store binding privately.

These are aggregate archives, not full SQLite backups. They retain daily data for
repricing and chart recovery. For request-level deduplication recovery, replay the
retained device queues as described in [device collection](claude-collection.md).
Daily backups leave up to one backup interval of exposure to total server loss;
local queues provide another copy of collected Codex and Claude records. Monitor
`backup-status.json` because a failed archive cannot provide that protection.
