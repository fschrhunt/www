# token-usage ops

Server-side runtime that feeds the site's `/token-usage` page. **This is not part of
the website build** — nothing here is imported by Next.js. It runs on the SSH host via
systemd timers and only publishes a public, allowlisted aggregate snapshot (date,
model id, USD) to a Vercel Blob. The site reads that snapshot at the same-origin
`/token-usage/data.json`, which `next.config.ts` rewrites to the Blob.

Stdlib Python only. Private ledgers and credentials stay on the host under
`/srv/apps/token-usage/shared/`.

## Pipeline

1. **Collect** — `collector.py` (Codex dashboard), `opencode_collector.py`, and
   `claude_ingest.py` / `claude_local.py` / `claude_records.py` (Claude logs) write
   private per-source snapshots on a 5-minute timer.
2. **Publish** — `publish_usage.py` merges the sources, prices them with
   `pricing.json`, and PUTs the public snapshot to the Blob on a 15-minute timer.
3. **Back up** — `backup_usage.py` copies the aggregate snapshots to a separate
   private Blob store daily.

## Layout

- `*.service` / `*.timer` — systemd unit pairs (collect / opencode / publish / backup);
  credentials are injected with `LoadCredential`, never committed.
- `install_claude.py`, `connect-opencode.py` — one-time setup helpers.
- `pricing.json` — per-model price table used by the publisher.
- `test_*.py` — unit tests (`python -m unittest` on the host).

See [`docs/token-usage.md`](../../docs/token-usage.md) and
[`docs/usage-publishing.md`](../../docs/usage-publishing.md) for the deployment and
data-contract details.
