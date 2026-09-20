#!/usr/bin/env python3
"""Install the token-usage R2 credentials on the publishing server over SSH."""

import argparse
import getpass
import json
import re
import shlex
import subprocess
import sys


ACCOUNT_ID = "f08cf55f0c99cc52a5d46098c95e673d"
SSH = [
    "ssh",
    "-o",
    "BatchMode=yes",
    "-o",
    "StrictHostKeyChecking=yes",
    "-o",
    "ForwardAgent=no",
    "-o",
    "ConnectTimeout=10",
]

# Run as root on the publishing server. Secrets arrive on stdin and never appear
# in the SSH command, process list, output, or journal.
REMOTE = r'''
import json, os, pathlib, subprocess, sys, tempfile

payload = json.load(sys.stdin)
root = pathlib.Path('/srv/apps/token-usage/shared/env')
if not root.is_dir() or root.stat().st_uid != 0 or root.stat().st_mode & 0o077:
    print(json.dumps({'ok': False, 'error': 'private_directory'}))
    raise SystemExit(1)

def valid_credential(value):
    return isinstance(value, str) and 16 <= len(value) <= 512 and all(33 <= ord(ch) <= 126 for ch in value)

if not valid_credential(payload.get('accessKeyId')) or not valid_credential(payload.get('secretAccessKey')):
    print(json.dumps({'ok': False, 'error': 'invalid_credential'}))
    raise SystemExit(1)

configs = {
    'publish-config.json': {
        'accountId': payload['accountId'],
        'bucket': 'token-usage',
        'accessKeyId': payload['accessKeyId'],
        'secretAccessKey': payload['secretAccessKey'],
    },
    'backup-config.json': {
        'accountId': payload['accountId'],
        'bucket': 'token-usage-backups',
        'accessKeyId': payload['accessKeyId'],
        'secretAccessKey': payload['secretAccessKey'],
    },
}
previous = {name: (root / name).read_bytes() if (root / name).exists() else None for name in configs}

def save(name, content):
    with tempfile.NamedTemporaryFile(dir=root, delete=False) as handle:
        os.fchmod(handle.fileno(), 0o600)
        handle.write(content)
        handle.flush()
        os.fsync(handle.fileno())
        temporary = handle.name
    os.replace(temporary, root / name)
    os.chown(root / name, 0, 0)
    os.chmod(root / name, 0o600)

try:
    for name, config in configs.items():
        save(name, (json.dumps(config, separators=(',', ':')) + '\n').encode())
    for service in ('token-usage-publish.service', 'token-usage-backup.service'):
        subprocess.run(
            ['systemctl', 'start', service],
            check=True,
            timeout=240,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
except Exception:
    for name, content in previous.items():
        path = root / name
        if content is None:
            path.unlink(missing_ok=True)
        else:
            save(name, content)
    print(json.dumps({'ok': False, 'error': 'verification_failed'}))
    raise SystemExit(1)

print(json.dumps({'ok': True, 'published': True, 'backedUp': True}))
'''


def validate_host(host):
    """Accept one SSH alias and reject options or shell syntax."""
    if not re.fullmatch(r"[A-Za-z0-9_][A-Za-z0-9_.@:-]*", host):
        raise ValueError("Provide an SSH alias, not SSH options.")
    return host


def install(host, access_key_id, secret_access_key):
    """Send the credentials over SSH stdin and verify both R2 jobs remotely."""
    command = "sudo -n python3 -c " + shlex.quote(REMOTE)
    payload = {
        "accountId": ACCOUNT_ID,
        "accessKeyId": access_key_id,
        "secretAccessKey": secret_access_key,
    }
    result = subprocess.run(
        [*SSH, validate_host(host), command],
        input=json.dumps(payload),
        text=True,
        capture_output=True,
        timeout=540,
    )
    try:
        outcome = json.loads(result.stdout)
    except json.JSONDecodeError:
        outcome = {}
    if result.returncode or outcome.get("ok") is not True:
        raise RuntimeError(
            "R2 setup failed; the previous server configuration was restored. "
            "Inspect the services privately."
        )
    return outcome


def credential(prompt):
    """Read one printable credential without echoing it or accepting whitespace."""
    value = getpass.getpass(prompt).strip()
    if not 16 <= len(value) <= 512 or any(
        ord(character) < 33 or ord(character) > 126 for character in value
    ):
        raise ValueError("Expected one credential value without whitespace.")
    return value


def main():
    """Prompt for the R2 key pair, install it, and run both verification jobs."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", required=True, help="Publishing server SSH alias")
    args = parser.parse_args()
    validate_host(args.host)
    if not sys.stdin.isatty():
        raise ValueError("Run this interactively so both credential prompts stay hidden.")

    print("The credentials go directly to the publishing server over SSH.")
    print("They are stored root-only and are never printed or passed in command arguments.")
    access_key_id = credential("Paste the R2 Access Key ID, then press Enter (hidden): ")
    secret_access_key = credential(
        "Paste the R2 Secret Access Key, then press Enter (hidden): "
    )
    install(args.host, access_key_id, secret_access_key)
    print("R2 credentials installed; a publication and backup both succeeded.")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (KeyboardInterrupt, EOFError):
        print("\nCancelled; no further action taken.", file=sys.stderr)
        sys.exit(1)
    except (ValueError, RuntimeError, OSError, subprocess.TimeoutExpired) as error:
        if isinstance(error, (ValueError, RuntimeError)):
            print(str(error), file=sys.stderr)
        else:
            print("Connection failed; no credentials printed.", file=sys.stderr)
        sys.exit(1)
