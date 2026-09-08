#!/usr/bin/env python3
"""Receive bounded usage-only SSH uploads; no shell commands or transcript data are accepted."""
import argparse
from contextlib import closing
import datetime as dt
import fcntl
import hashlib
import json
import os
from pathlib import Path
import resource
import signal
import sys
from claude_records import atomic_json, connect, merge, snapshot, validate


def ingest(data, device, raw):
    """Validate the whole batch, serialize concurrent devices, and acknowledge durable merges."""
    packet = json.loads(raw)
    if not isinstance(packet, dict) or set(packet) != {'version', 'records'} or packet['version'] != 1:
        raise ValueError('invalid_packet')
    if not isinstance(packet['records'], list) or len(packet['records']) > 2000:
        raise ValueError('batch_too_large')
    rows = [validate(row) for row in packet['records']]
    with (data/'ingest.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        with closing(connect(data/'claude.sqlite')) as db:
            with db:
                for row in rows:
                    merge(db, row)
                db.execute('INSERT OR REPLACE INTO devices VALUES(?,?)', (device, dt.datetime.now(dt.timezone.utc).isoformat()))
            atomic_json(data/'claude-snapshot.json', snapshot(db))
            atomic_json(data/'codex-local-snapshot.json', snapshot(db, 'codex'))
    return {'ack': hashlib.sha256(raw).hexdigest(), 'count': len(rows)}


if __name__ == '__main__':
    os.umask(0o077)
    os.nice(10)
    resource.setrlimit(resource.RLIMIT_AS, (128*1024*1024, 128*1024*1024))
    resource.setrlimit(resource.RLIMIT_CPU, (15, 15))
    signal.alarm(60)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data', type=Path, required=True)
    parser.add_argument('--device', choices=('mac', 'mini', 'server'), required=True)
    args = parser.parse_args()
    try:
        raw = sys.stdin.buffer.read(2*1024*1024+1)
        if len(raw) > 2*1024*1024:
            raise ValueError('batch_too_large')
        print(json.dumps(ingest(args.data, args.device, raw), separators=(',', ':')))
    except Exception:
        print('Usage upload rejected.', file=sys.stderr)
        raise SystemExit(1)
