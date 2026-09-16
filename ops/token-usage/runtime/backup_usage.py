#!/usr/bin/env python3
"""Archive aggregate counters and pricing privately off server; never include login credentials."""
import argparse
import datetime as dt
import gzip
import hashlib
import json
import os
from pathlib import Path
import sys
import urllib.request
from collector import NoRedirect, atomic_json
from publish_usage import r2_object_url, r2_put


def run(args):
    """Write one dated archive and verify its authenticated read before reporting success."""
    now = dt.datetime.now(dt.timezone.utc)
    try:
        names = ('codex', 'codex_local', 'claude', 'opencode', 'prices')
        payload = {name: json.loads(Path(getattr(args, name)).read_text()) for name in names}
        raw = gzip.compress(json.dumps(payload, sort_keys=True, separators=(',', ':')).encode(), mtime=0)
        if len(raw) > 2 * 1024 * 1024:
            raise ValueError('archive_too_large')
        config = json.loads(Path(args.config).read_text())
        path = now.date().isoformat() + '-' + hashlib.sha256(raw).hexdigest()[:16] + '.json.gz'
        r2_put(config, path, raw, 'application/gzip')
        request = urllib.request.Request(r2_object_url(config, path), headers={
            'Authorization': 'Bearer ' + config['token'], 'User-Agent': 'token-usage/1.0'})
        with urllib.request.build_opener(NoRedirect).open(request, timeout=30) as response:
            restored = response.read(2 * 1024 * 1024 + 1)
        if restored != raw:
            raise ValueError('archive_verification_failed')
        atomic_json(Path(args.data)/'backup-status.json', {'state':'ok', 'lastSuccess':now.isoformat(),
                    'archive':path, 'bytes':len(raw), 'sha256':hashlib.sha256(raw).hexdigest()})
        print('Private aggregate archive uploaded and read back; bytes='+str(len(raw)))
        return 0
    except Exception as error:
        atomic_json(Path(args.data)/'backup-status.json', {'state':'error', 'lastAttempt':now.isoformat(),
                    'errorType':type(error).__name__})
        print('Archive failed: '+type(error).__name__, file=sys.stderr)
        return 1


if __name__ == '__main__':
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('codex', 'codex-local', 'claude', 'opencode', 'prices', 'config', 'data'):
        parser.add_argument('--'+name, required=True)
    raise SystemExit(run(parser.parse_args()))
