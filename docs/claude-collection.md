# Device usage collection

Authorized senders collect retained session usage from Claude Code, Codex CLI,
Pi, and `e`. Collection makes no model requests and consumes no subscription
tokens. It does not cover browser chats, cloud-only sessions, ephemeral local
sessions, or deleted history. OpenCode-backed Pi and `e` requests are deliberately
left to the account-wide OpenCode collector, so those requests are not counted
twice. The website consumes a separately priced aggregate snapshot; see
[publishing](usage-publishing.md).

## Collection and resource limits

Each machine runs `claude_local.py` once every five minutes, then exits. The
filename and service labels predate the extra local sources and remain stable for
installed releases. macOS senders use `com.fischer.token-usage.claude`
LaunchAgents, which run at login and do not request system wake. They resume after
sleep while the user is logged in. Linux senders use the persistent
`token-usage-claude-local.timer`, which starts again after reboot. None of these
jobs keeps Python running between executions.

The local runtime and state live under `~/.local/share/token-usage/claude/`:

- `current/` points at a versioned source release.
- `queue.sqlite` retains normalized response counters and file offsets.
- `status.json` records the last attempt, upload, pending count on success, and errors.
- `upload-key` is a dedicated SSH private key, mode 0600.
- `known_hosts` pins the server's host key obtained over the existing trusted SSH connection.
- `config.json` contains only the destination host and port.

The collector checks log metadata and skips unchanged files. It reads appended
complete lines and remembers its offset in the same transaction as the counters.
An incomplete final line waits for the next run. Replaced, shortened, or detected
rewritten logs are read again and deduplicated. Deleted logs do not remove usage
already collected. A same-inode rewrite that grows a file while retaining its
prefix cannot always be distinguished from an append; ordinary Claude logs are
append-only, but manually rewritten archives should be imported with reset file
cursors.

Each pass has a 32 MiB scan budget, a 20-second scan deadline, a 16 MiB per-line
limit, and a 2,000-record upload batch. Budget exhaustion leaves the remaining
work for a later pass. Jobs cannot overlap on a device. The Linux sender service has a
128 MiB memory limit, 10% CPU quota, low scheduling priority, and a 90-second
service timeout. macOS senders run with background priority and low-priority I/O.
A pathological oversized record fails the scan and is reported through status;
it is not silently discarded. Malformed complete records are counted as skipped.

## Private transport and merging

The receiver uses a dedicated ingestion account. Its root-owned SSH authorized keys
force a fixed `claude_ingest.py` command for each device. The keys cannot open a
shell, forward ports, allocate a terminal, or choose another device identity.
The account cannot alter its authorized keys or the deployed source. Uploads use
the existing SSH server without a separate network listener.
The keys confer write access to usage collection, not access to Claude accounts.

The receiver accepts only a bounded schema containing a SHA-256 hash of the
provider response or local message identity, UTC day, raw model ID, and six token
counters, including separate five-minute and one-hour cache writes. No prompts,
code, project paths, account cookies, harness names, or raw session IDs are
uploaded.
The receiver has a 128 MiB address-space limit, fifteen seconds of CPU time, a
sixty-second lifetime limit, and low scheduling priority.

The central ledger and snapshot are in
`/srv/apps/token-usage/shared/claude/{claude.sqlite,claude-snapshot.json,codex-local-snapshot.json}`, owned by
`usage-ingest`, with directory mode 0700 and file mode 0600. Only aggregate daily
model counters and each device's last successful upload appear in the snapshot.
They use token units; they are not dollar charges or subscription quota estimates.

Repeated assistant content blocks, resumed sessions, and copies on another
machine merge by a stable response or message identity hash. Each counter takes
its greatest observed value, so progressive Claude usage updates replace earlier
partial counters. Conflicting models for one identity are rejected by the
receiver. Source records stay in each local ledger after acknowledgement so they
can be replayed for recovery.

## Offline behavior and recovery

An offline sender does not interrupt the other collectors. Its existing
history stays in the central snapshot; its last-seen timestamp stops advancing.
When it returns, complete new log records and pending uploads are collected.

If the server is offline, senders keep collecting into their local SQLite
queues. Network attempts have short timeouts and retry at the next scheduled
run, with no busy retry loop. Uploads are acknowledged only after the receiver
commits and replaces the snapshot. If a connection drops after commit, retrying
the same batch is safe. Central collection pauses while the receiver is offline; the website keeps
reading its last published Blob snapshot.

Tested recovery covers unreachable transport, lost acknowledgements, duplicate
uploads from different devices, partial log lines, incremental scan budgets,
truncated logs, and preservation of offline-device history. These tests simulate
transport failures; they do not establish suspend or reboot behavior on a
particular deployment.

A separate private aggregate archive can protect published history; see
[usage publishing](usage-publishing.md). After restoring an older central ledger, stop
the local jobs and mark `records.dirty=1` in each local `queue.sqlite` to resend
its retained counters. This does not require rereading transcripts. Restart the
jobs afterward. Never reset the local queue or delete source logs as part of
ordinary retry handling.

## Operations

Source lives in `ops/token-usage/runtime/claude_{local,records,ingest}.py`.
Those retained filenames now cover every device source. The
[operations README](../ops/token-usage/README.md) covers private inventory
configuration, installation, source layout, and test commands. Keep actual host
aliases and device names in the private operator runbook.

Check the local `status.json`, pending queue, and configured scheduler on each
authorized sender. Check receiver freshness independently from publishing health.
Do not publish raw status output, login paths, SSH configuration, or device IDs.

Codex CLI scans `~/.codex/sessions` and `~/.codex/archived_sessions` within the
same 32 MiB pass budget and SSH batch. It persists session and model context
across reads. Repeated cumulative checkpoints are ignored; session plus
checkpoint hashes merge copied logs across machines. Per-response token events
keep input, cached input, and output distinct. Reasoning tokens are already
included in output and are not charged twice.

Pi scans persisted JSONL below `~/.pi/agent/sessions`. Assistant responses retain
provider, model, response identity, and separate input, output, cache-read, and
cache-write counters. Pi's compaction, branch-summary, and usage-reporting tool
records are included too. Tool records need a single reported model; ambiguous
multi-model aggregates stay out. They currently retain total cache writes but no
one-hour split, so unspecified writes use the ordinary five-minute rate, matching
the current subagent configuration. OpenAI Codex and Anthropic records enter the
corresponding local aggregates. OpenCode records do not, because its account
snapshot already contains them.

`e` scans persisted JSONL below `~/.e/sessions`. Version 2 response envelopes
retain a stable response identity and timestamp, provider, model, purpose, and
disjoint input, output, cache-read, and cache-write counters. The envelope sits
outside replayable message content; billed blank replies use standalone response
records, while copied history retains the original response identity. Ordinary
turns and compaction requests therefore deduplicate and price against the model
that handled them. Direct OpenAI Codex and Anthropic responses are
imported; OpenCode responses again stay with the account collector. Earlier `e`
records use their local message identity and session model. Their OpenAI counters
are usable after subtracting cached input, but Anthropic records omit cache-write
detail and remain excluded rather than priced from a guess. Only retained local
sessions are covered for all four harnesses; cloud-only, ephemeral, and deleted
sessions cannot be recovered through this collector.
