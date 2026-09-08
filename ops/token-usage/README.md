# Token usage operations

Stdlib Python jobs feed the site's `/token-usage` page. Next.js does not import or
execute this directory. Collectors retain private ledgers; the publisher sends
only an allowlisted aggregate snapshot to Vercel Blob.

## Source layout

| Directory | Contents |
| --- | --- |
| `runtime/` | Collectors, receiver, publisher, backup job, and reviewed pricing data |
| `setup/` | Interactive connection and device installation tools |
| `systemd/` | Service and timer templates |
| `tests/` | Collector, publisher, and setup regression tests |

Run from the repository root:

```sh
PYTHONPATH=ops/token-usage/runtime:ops/token-usage/setup python3 -B -m unittest discover -s ops/token-usage/tests -p 'test_*.py'
```

## Deployment boundary

The repository folders organize source; installed releases remain flat. Copy the
**contents** of `runtime/` into a new root-owned release, keeping Python modules
and `pricing.json` together. Existing `current/*.py` service commands and forced
SSH receiver commands therefore retain their paths. Do not copy the enclosing
`runtime/` directory into the installed release. Tests and setup tools are not
server runtime files.

The units use `/srv/apps/token-usage/` as the example installation root. Adapt it
to an authorized deployment and keep private data outside releases. The Codex
unit requires a root-owned systemd drop-in supplying
`LoadCredential=codex-auth:/absolute/path/to/approved/auth.json`. Preserve the
existing approved source when updating an installation. Do not deploy the
public unit without that private override. Other credentials are supplied from
the installation's private environment directory.

Validate the staged release and units before switching `current`. Preserve
ownership, service restrictions, data, and the previous release for rollback.
The source reorganization alone does not require migrating ledgers or restarting
services. See [collector operations](../../docs/token-usage.md).

## Setup tools

`setup/install_claude.py --config /private/path/devices.json` reads a private
inventory. It contains a receiver SSH alias and the complete sender list:

```json
{
  "server": "receiver-alias",
  "devices": [
    {"id": "workstation", "host": null, "scheduler": "launchd"},
    {"id": "linux-sender", "host": "sender-alias", "scheduler": "systemd"}
  ]
}
```

These are placeholders, not a deployed inventory. A null host means the machine
running the installer. Device IDs must remain stable across reinstalls. The
receiver's authorized keys are replaced with the configured set, so include all
authorized senders. The installer uses existing SSH trust; uploads currently
require the receiver's reachable hostname on port 22. It preserves keys and
queues, verifies uploads, then installs schedules. LaunchAgents require an active
graphical login. The Linux service user comes from the sender account.

`setup/connect-opencode.py --host receiver-alias --capture /private/path/usage.har`
reads a usage URL from a private capture and prompts for the session cookie with
hidden input. Never commit the capture or cookie. See
[collection](../../docs/claude-collection.md) and
[publishing](../../docs/usage-publishing.md) for data and recovery contracts.

Setup requires an already trusted SSH host key and disables agent forwarding.
Verify host fingerprints through a trusted channel before provisioning. The
helpers refuse unknown or changed host keys instead of accepting them.
