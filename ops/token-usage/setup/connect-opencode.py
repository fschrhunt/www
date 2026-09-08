#!/usr/bin/env python3
"""Privately connect the existing OpenCode console session to the server over SSH."""
import argparse
import getpass
import json
from pathlib import Path
import re
import shlex
import subprocess
import sys
from urllib.parse import urlsplit

# Run only on the SSH destination; credentials arrive on stdin, never in command arguments.
REMOTE = r'''
import json, os, pathlib, tempfile, urllib.request, urllib.error
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None
payload = json.load(__import__('sys').stdin)
request = urllib.request.Request(payload['url'], headers={
    'Cookie': 'auth=' + payload['cookie'], 'Accept': 'text/html',
    'User-Agent': 'token-usage/1.0'})
try:
    with urllib.request.build_opener(NoRedirect).open(request, timeout=30) as response:
        body = response.read(16 * 1024 * 1024 + 1)
        if len(body) > 16 * 1024 * 1024 or b'usage.list[' not in body:
            raise ValueError('Unexpected console page')
except urllib.error.HTTPError as error:
    print('Console verification failed: HTTP ' + str(error.code) + '. No credentials saved.')
    raise SystemExit(1)
except Exception:
    print('Console verification failed. No credentials saved.')
    raise SystemExit(1)
root = pathlib.Path('/srv/apps/token-usage/shared/env')
if not root.is_dir() or root.stat().st_uid != 0 or root.stat().st_mode & 0o077:
    print('Private server credential directory is missing or has unexpected permissions.')
    raise SystemExit(1)
def save(name, value):
    with tempfile.NamedTemporaryFile(mode='w', dir=root, delete=False) as handle:
        os.fchmod(handle.fileno(), 0o600)
        handle.write(value)
        temporary = handle.name
    os.replace(temporary, root / name)
save('opencode-auth', payload['cookie'])
config_path = root / 'opencode-config.json'
config = json.loads(config_path.read_text()) if config_path.exists() else {}
config['usagePage'] = payload['url']
save('opencode-config.json', json.dumps(config) + '\n')
print('OpenCode console verified from the server. Session saved privately; the polling schedule is managed separately.')
'''


def usage_page(capture):
    """Find only the console usage URL in the local capture, excluding headers and bodies."""
    if capture.exists():
        entries = json.loads(capture.read_text())['log']['entries']
        for entry in entries:
            url = urlsplit(entry['request']['url'])
            if url.scheme == 'https' and url.netloc == 'opencode.ai' and re.fullmatch(r'/workspace/wrk_[A-Za-z0-9]+/usage', url.path):
                return 'https://opencode.ai' + url.path
    raise ValueError('No OpenCode Usage-page URL was found in the supplied capture.')


def main():
    """Ask for one hidden cookie value, verify server access, then persist it mode 0600."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--host', required=True, help='Authorized receiver SSH alias')
    parser.add_argument('--capture', type=Path, required=True, help='Private Usage-page HAR outside the repository')
    args = parser.parse_args()
    if not re.fullmatch(r'[A-Za-z0-9_][A-Za-z0-9_.@:-]*', args.host):
        raise ValueError('Provide an SSH alias, not SSH options.')
    if not sys.stdin.isatty():
        raise ValueError('Run this interactively in your terminal so input stays hidden.')
    url = usage_page(args.capture)
    print('This gives the selected SSH destination your OpenCode console session, including its account access.')
    print('The value goes over SSH and is stored root-only under /srv/apps/token-usage/shared/env.')
    cookie = getpass.getpass('Paste the VALUE of the OpenCode auth cookie, then press Enter (hidden): ').strip()
    if cookie.startswith('auth='):
        cookie = cookie[5:]
    if not cookie or len(cookie) > 32768 or any(ord(ch) < 33 or ord(ch) > 126 or ch == ';' for ch in cookie):
        raise ValueError('Expected one auth cookie value, without other cookies or whitespace.')
    command = 'sudo -n python3 -c ' + shlex.quote(REMOTE)
    result = subprocess.run(['ssh', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes',
                             '-o', 'ForwardAgent=no', '-o', 'ConnectTimeout=10', args.host, command],
                            input=json.dumps({'url': url, 'cookie': cookie}).encode(), timeout=60)
    return result.returncode


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (KeyboardInterrupt, EOFError):
        print('\nCancelled; no further action taken.', file=sys.stderr)
        sys.exit(1)
    except (ValueError, OSError, subprocess.TimeoutExpired) as error:
        print(str(error) if isinstance(error, ValueError) else 'Connection failed; no credentials printed.', file=sys.stderr)
        sys.exit(1)
