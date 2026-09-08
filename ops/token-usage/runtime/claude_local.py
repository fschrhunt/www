#!/usr/bin/env python3
"""Incrementally queue Claude log counters and upload through a dedicated restricted SSH key."""
import argparse
from contextlib import closing
import datetime as dt
import fcntl
import hashlib
import json
import os
from pathlib import Path
import subprocess
import time
from claude_records import FIELDS, atomic_json, connect, extract, extract_codex, merge

MAX_LINE = 16 * 1024 * 1024
SCAN_BUDGET = 32 * 1024 * 1024


def scan(db, root, budget=SCAN_BUDGET, provider="claude"):
    """Read changed regular logs within a byte/time budget; commit offsets together with counters."""
    consumed = skipped = 0
    deadline = time.monotonic() + 20
    if not root.is_dir():
        raise ValueError('log_directory_missing')
    with db:
        for path in sorted(root.rglob('*.jsonl')):
            if consumed >= budget or time.monotonic() >= deadline:
                break
            if path.is_symlink() or not path.is_file():
                continue
            stat = path.stat()
            inode = str(stat.st_dev) + ':' + str(stat.st_ino)
            prior = db.execute('SELECT inode,size,mtime,offset,prefix FROM files WHERE path=?', (str(path),)).fetchone()
            if prior and prior[:3] == (inode, stat.st_size, stat.st_mtime_ns) and prior[3] == stat.st_size:
                continue
            with path.open('rb') as stream:
                prefix = hashlib.sha256(stream.read(min(64, stat.st_size))).hexdigest()
                rewritten = prior and prior[1] == stat.st_size and prior[2] != stat.st_mtime_ns
                offset = prior[3] if prior and not rewritten and prior[0] == inode and prior[3] <= stat.st_size and prior[4] == prefix else 0
                previous_context = db.execute('SELECT value FROM contexts WHERE path=?', (str(path),)).fetchone()
                context = json.loads(previous_context[0]) if offset and previous_context else {}
                stream.seek(offset)
                while consumed < budget and time.monotonic() < deadline:
                    line = stream.readline(MAX_LINE + 1)
                    if not line:
                        break
                    consumed += len(line)
                    if len(line) > MAX_LINE:
                        raise ValueError('log_line_too_large')
                    if not line.endswith(b'\n'):
                        break
                    try:
                        item = extract_codex(json.loads(line), context) if provider=='codex' else extract(json.loads(line))
                        if item:
                            merge(db, item)
                    except (ValueError, KeyError, TypeError, AttributeError):
                        skipped += 1
                    offset = stream.tell()
                db.execute('INSERT OR REPLACE INTO contexts VALUES (?,?)', (str(path), json.dumps(context)))
                db.execute('INSERT OR REPLACE INTO files VALUES(?,?,?,?,?,?)',
                           (str(path), inode, stat.st_size, stat.st_mtime_ns, offset, prefix))
    return consumed, skipped


def upload(db, config, state):
    """Acknowledge queued records only after the server commits and confirms this exact payload."""
    rows = [list(r) for r in db.execute('SELECT id,day,model,'+','.join(FIELDS)+' FROM records WHERE dirty=1 ORDER BY id LIMIT 2000')]
    payload = json.dumps({'version': 1, 'records': rows}, separators=(',', ':')).encode()
    command = ['/usr/bin/ssh', '-F', '/dev/null', '-i', str(state/'upload-key'),
               '-o', 'IdentitiesOnly=yes', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes',
               '-o', 'UserKnownHostsFile='+str(state/'known_hosts'), '-o', 'ConnectTimeout=8',
               '-o', 'ServerAliveInterval=10', '-o', 'ServerAliveCountMax=1',
               '-p', str(config.get('port', 22)), 'usage-ingest@'+config['host']]
    result = subprocess.run(command, input=payload, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=45)
    if result.returncode != 0:
        raise ValueError('upload_unavailable')
    reply = json.loads(result.stdout)
    if reply != {'ack': hashlib.sha256(payload).hexdigest(), 'count': len(rows)}:
        raise ValueError('upload_unconfirmed')
    with db:
        db.executemany('UPDATE records SET dirty=0 WHERE id=?', [(r[0],) for r in rows])
    return len(rows)


def run(state, root):
    """Perform one low-priority scan/upload, retaining the local queue across all network failures."""
    os.umask(0o077)
    state.mkdir(parents=True, exist_ok=True, mode=0o700)
    with (state/'lock').open('a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return 0
        stamp = dt.datetime.now(dt.timezone.utc).isoformat()
        previous = json.loads((state/'status.json').read_text()) if (state/'status.json').exists() else {}
        status = {'lastAttempt': stamp, 'lastUpload': previous.get('lastUpload')}
        try:
            with closing(connect(state/'queue.sqlite')) as db:
                read, skipped = scan(db, root)
                for codex_root in [Path.home()/'.codex/sessions', Path.home()/'.codex/archived_sessions']:
                    if codex_root.is_dir() and read < SCAN_BUDGET:
                        count, invalid = scan(db, codex_root, budget=SCAN_BUDGET-read, provider='codex')
                        read += count
                        skipped += invalid
                status.update({'bytesRead': read, 'skippedRecords': skipped})
                sent = upload(db, json.loads((state/'config.json').read_text()), state)
                status.update({'state': 'ok', 'lastUpload': stamp, 'uploadedRecords': sent,
                               'pendingRecords': db.execute('SELECT count(*) FROM records WHERE dirty=1').fetchone()[0]})
            code = 0
        except Exception as error:
            # Exception messages may contain transcript fragments; log only their category.
            status.update({'state': 'retry_pending', 'errorType': type(error).__name__})
            code = 1
        atomic_json(state/'status.json', status)
        print(json.dumps(status, separators=(',', ':')))
        return code


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--state', type=Path, required=True)
    parser.add_argument('--logs', type=Path, default=Path.home()/'.claude/projects')
    args = parser.parse_args()
    raise SystemExit(run(args.state, args.logs))
