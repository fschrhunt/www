# Claude and Codex usage on three devices

Claude Code log collection is installed on this Mac, SSH host `mini`, and SSH host
`server`. It collects existing Claude Code assistant usage records and Codex session token events. It makes no
model requests and consumes no subscription tokens. It does not cover Claude.ai
browser chats or history that has already been deleted from all three devices.

The first import on September 8, 2026 merged 5,962 distinct response records over
16 UTC dates and five model IDs. All three queues drained without skipped records.
The server's aggregate snapshot was about 4.7 KB. The website consumes a separately priced aggregate snapshot. See
[usage publishing](usage-publishing.md).

## Collection and resource limits

Each machine runs `claude_local.py` once every five minutes, then exits. The
Macs use `com.fischer.token-usage.claude` LaunchAgents, which run at login and do
not request system wake. They resume after sleep while the user is logged in.
The server uses the persistent `token-usage-claude-local.timer`, which starts again
after reboot. None of these jobs keeps Python running between executions.

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
work for a later pass. Jobs cannot overlap on a device. The server sender has a
128 MiB memory limit, 10% CPU quota, low scheduling priority, and a 90-second
service timeout. The Macs run with background priority and low-priority I/O.
A pathological oversized record fails the scan and is reported through status;
it is not silently discarded. Malformed complete records are counted as skipped.

Measured post-import runs used about 26.5 MiB peak RSS on this Mac while uploading
its final queued batch, 19.5 MiB on the mini with unchanged logs, and 13 MiB on the
server with unchanged logs. CPU time was approximately 60, 80, and 50 milliseconds,
respectively. These are individual measurements, not permanent bounds or power
measurements. The Linux sender's configured limits apply independently.

## Private transport and merging

`usage-ingest` is a dedicated server account. Its root-owned SSH authorized keys
force a fixed `claude_ingest.py` command for each device. The keys cannot open a
shell, forward ports, allocate a terminal, or choose another device identity.
The account cannot alter its authorized keys or the deployed source. No new
network listener or firewall rule was added. Uploads use the existing SSH server.
The keys confer write access to usage collection, not access to Claude accounts.

The receiver accepts only a bounded schema containing a SHA-256 hash of the
provider message ID, UTC day, raw model ID, and six token counters, including separate five-minute and one-hour cache writes. No
prompts, code, project paths, account cookies, or raw session IDs are uploaded.
The receiver has a 128 MiB address-space limit, fifteen seconds of CPU time, a
sixty-second lifetime limit, and low scheduling priority.

The central ledger and snapshot are in
`/srv/apps/token-usage/shared/claude/{claude.sqlite,claude-snapshot.json,codex-local-snapshot.json}`, owned by
`usage-ingest`, with directory mode 0700 and file mode 0600. Only aggregate daily
model counters and each device's last successful upload appear in the snapshot.
They use token units; they are not dollar charges or subscription quota estimates.

Repeated assistant content blocks, resumed sessions, and copies on another
machine merge by the provider message ID hash. Each counter takes its greatest
observed value, so progressive usage updates replace earlier partial counters.
This relies on Claude's cumulative per-response usage convention. Conflicting
models for one message ID are rejected by the receiver. Source records stay in
each local ledger after acknowledgement so they can be replayed for recovery.

## Offline behavior and recovery

An offline Mac or mini does not interrupt the other collectors. Its existing
history stays in the central snapshot; its last-seen timestamp stops advancing.
When it returns, complete new log records and pending uploads are collected.

If the server is offline, both Macs keep collecting into their local SQLite
queues. Network attempts have short timeouts and retry at the next scheduled
run, with no busy retry loop. Uploads are acknowledged only after the receiver
commits and replaces the snapshot. If a connection drops after commit, retrying
the same batch is safe. The previous snapshot remains available wherever a future
website publisher has copied it. Central collection necessarily pauses while the server is off; the website keeps
reading its last published Blob snapshot.

Tested recovery covers unreachable transport, lost acknowledgements, duplicate
uploads from different devices, partial log lines, incremental scan budgets,
truncated logs, and preservation of offline-device history. The actual machines
were not rebooted or put to sleep during verification.

An initial private backup, `claude.initial-backup.sqlite`, passed an integrity
check. Like the other collectors' initial backups, it is on the same server, not
an off-server backup. A separate daily private aggregate archive now protects
all providers; see [usage publishing](usage-publishing.md). After restoring an older central ledger, stop
the local jobs and mark `records.dirty=1` in each local `queue.sqlite` to resend
its retained counters. This does not require rereading transcripts. Restart the
jobs afterward. Never reset the local queue or delete source logs as part of
ordinary retry handling.

## Operations

```sh
# This Mac; the same commands work through ssh mini.
cat ~/.local/share/token-usage/claude/status.json
launchctl print gui/$(id -u)/com.fischer.token-usage.claude

# Server sender and other provider schedules.
ssh server 'cat ~/.local/share/token-usage/claude/status.json'
ssh server 'systemctl list-timers token-usage-claude-local.timer token-usage.timer token-usage-opencode.timer --no-pager'
```

Source lives in `ops/token-usage/claude_{local,records,ingest}.py`.
`install_claude.py` provisions the three authorized devices, preserves their keys
and queues, checks the first upload, and installs their schedules. It uses the
existing `mini` and `server` SSH aliases. Installing while logged out of the
Mac graphical session requires loading its LaunchAgent after login.

Run focused verification with:

```sh
python3 -B -m unittest discover -s ops/token-usage -p 'test_*.py'
```

Codex scans `~/.codex/sessions` and `~/.codex/archived_sessions` within the same
32 MiB pass budget and SSH batch. It persists session/model context across reads.
Repeated cumulative checkpoints are ignored; session plus checkpoint hashes
merge copied logs across machines. Per-response token events keep input, cached
input, and output distinct. Reasoning tokens are already included in output and
are not charged twice. Only retained local sessions are covered; cloud-only
sessions and deleted logs cannot be recovered through this collector.
