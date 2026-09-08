#!/usr/bin/env python3
"""Collect OpenCode console model costs in UTC without retaining request or key identities."""
import argparse
from contextlib import closing
import datetime as dt
import decimal
import json
import os
from pathlib import Path
import re
import sqlite3
import sys
import urllib.error
import urllib.request
from collector import NoRedirect, PollError, atomic_json

# Only accept the observed data grammar; never evaluate the console's JavaScript.
STRING = r'"(?:[^"\\\x00-\x1f]|\\["\\/bfnrt]|\\u[0-9a-fA-F]{4})*"'
ROW = re.compile(r'\$R\[\d+\]=\{date:(' + STRING + r'),model:(' + STRING +
                 r'),totalCost:(\d+),keyId:(' + STRING + r'|null),plan:(' + STRING + r'|null)\}')


def parse_usage(text, month):
    """Validate every row in the usage array and sum integer cost units across keys and plans."""
    match = re.search(r'usage:\$R\[\d+\]=\[(.*?)\],keys:', text, re.S)
    if not match:
        raise PollError('console_format_changed')
    body = match[1]
    rows, seen, offset = {}, set(), 0
    while offset < len(body):
        item = ROW.match(body, offset)
        if not item:
            raise PollError('console_format_changed')
        date, model, cost, key, plan = item.groups()
        date, model, key, plan = map(json.loads, (date, model, key, plan))
        dt.date.fromisoformat(date)
        if date[:7] != month or not re.fullmatch(r'[A-Za-z0-9._:/-]{1,150}', model):
            raise PollError('invalid_model_or_date')
        identity = (date, model, key, plan)
        if identity in seen:
            raise PollError('duplicate_provider_row')
        seen.add(identity)
        pair = (date, model)
        rows[pair] = rows.get(pair, 0) + int(cost)
        if rows[pair] > 2**53 - 1:
            raise PollError('invalid_cost_value')
        offset = item.end()
        if offset < len(body):
            if body[offset] != ',' or offset + 1 == len(body):
                raise PollError('console_format_changed')
            offset += 1
    return rows


def fetch(cookie, config, month):
    """Call the captured read-only console function at a fixed origin, with UTC day boundaries."""
    match = re.fullmatch(r'https://opencode.ai/workspace/(wrk_[A-Za-z0-9]+)/usage', config['usagePage'])
    if not match:
        raise PollError('invalid_workspace_url')
    workspace = match[1]
    year, number = map(int, month.split('-'))
    body = {'t': {'t': 9, 'i': 0, 'l': 4, 'a': [
        {'t': 1, 's': workspace}, {'t': 0, 's': year},
        {'t': 0, 's': number - 1}, {'t': 1, 's': '+00:00'}], 'o': 0}, 'f': 31, 'm': []}
    headers = {name: config['headers'][name] for name in ('x-server-id', 'x-server-instance')}
    headers.update({'Cookie': 'auth=' + cookie, 'User-Agent': 'token-usage/1.0',
                    'Content-Type': 'application/json', 'Accept': 'text/javascript'})
    request = urllib.request.Request('https://opencode.ai/_server', data=json.dumps(body).encode(), headers=headers)
    try:
        with urllib.request.build_opener(NoRedirect).open(request, timeout=30) as response:
            raw = response.read(8 * 1024 * 1024 + 1)
            if len(raw) > 8 * 1024 * 1024:
                raise PollError('response_too_large')
            return parse_usage(raw.decode(), month), workspace
    except urllib.error.HTTPError as error:
        if error.code in (301, 302, 303, 307, 308, 401, 403):
            raise PollError('opencode_login_or_access_rejected') from None
        if error.code == 429:
            raise PollError('provider_rate_limited') from None
        raise PollError('provider_http_' + str(error.code)) from None


def connect(path):
    """Keep OpenCode cost units in their own ledger, separate from Codex credits."""
    db = sqlite3.connect(path)
    db.executescript('''CREATE TABLE IF NOT EXISTS model_usage (
        day TEXT NOT NULL, model TEXT NOT NULL, cost_units INTEGER NOT NULL,
        PRIMARY KEY(day, model));
        CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);''')
    return db


def store(db, months, workspace, fetched_at):
    """Replace complete returned months atomically, including corrected and deleted usage."""
    previous = db.execute("SELECT value FROM metadata WHERE key='workspace'").fetchone()
    if previous and previous[0] != workspace:
        raise PollError('workspace_changed_requires_review')
    with db:
        for month, rows in months.items():
            db.execute('DELETE FROM model_usage WHERE substr(day,1,7)=?', (month,))
            db.executemany('INSERT INTO model_usage VALUES(?,?,?)', [(day, model, cost) for (day, model), cost in rows.items()])
        db.executemany('INSERT OR REPLACE INTO metadata VALUES(?,?)', [('workspace', workspace), ('last_success', fetched_at)])


def snapshot(db):
    """Export model-day USD usage costs, never console account fields or inferred token counts."""
    days = {}
    for day, model, cost in db.execute('SELECT * FROM model_usage ORDER BY day, model'):
        days.setdefault(day, {'date': day, 'models': []})['models'].append({
            'modelId': model, 'usageCostUsd': str(decimal.Decimal(cost) / decimal.Decimal(100_000_000))})
    updated = db.execute("SELECT value FROM metadata WHERE key='last_success'").fetchone()
    return {'version': 1, 'provider': 'opencode', 'unit': 'USD', 'metric': 'usage_cost',
            'timezone': 'UTC', 'updatedAt': updated[0] if updated else None, 'days': list(days.values())}


def next_month(date):
    """Advance a month without assuming month lengths."""
    return (date.replace(day=28) + dt.timedelta(days=4)).replace(day=1)


def run(args):
    """Refresh two calendar months normally, backing off failures and preserving the last snapshot."""
    data = Path(args.data)
    now = dt.datetime.now(dt.timezone.utc)
    status_path = data / 'opencode-status.json'
    try:
        if status_path.exists() and not args.start:
            status = json.loads(status_path.read_text())
            if status.get('retryAfter', '') > now.isoformat():
                print('OpenCode poll deferred until backoff expires')
                return 0
        config = json.loads(Path(args.config).read_text())
        cookie = Path(args.auth).read_text().strip()
        if not cookie or any(ord(c) < 33 or ord(c) > 126 or c == ';' for c in cookie):
            raise PollError('opencode_login_required')
        end = now.date().replace(day=1)
        start = dt.date.fromisoformat(args.start + '-01') if args.start else (end - dt.timedelta(days=1)).replace(day=1)
        if start > end or (end-start).days > 730:
            raise PollError('invalid_backfill_range')
        months = {}
        while start <= end:
            month = start.strftime('%Y-%m')
            rows, workspace = fetch(cookie, config, month)
            months[month] = rows
            start = next_month(start)
        with closing(connect(data / 'opencode.sqlite')) as db:
            store(db, months, workspace, now.isoformat())
            result = snapshot(db)
            atomic_json(data / 'opencode-snapshot.json', result)
        atomic_json(status_path, {'state': 'ok', 'lastAttempt': now.isoformat(), 'lastSuccess': result['updatedAt']})
        print('OpenCode poll successful; stored days=' + str(len(result['days'])))
        return 0
    except Exception as error:
        reason = str(error) if isinstance(error, PollError) else type(error).__name__
        delay = 60 if reason == 'provider_rate_limited' else 30 if 'login' in reason else 10
        atomic_json(status_path, {'state': 'error', 'lastAttempt': now.isoformat(), 'reason': reason,
                                 'retryAfter': (now + dt.timedelta(minutes=delay)).isoformat()})
        print('OpenCode poll failed: ' + reason, file=sys.stderr)
        return 1


if __name__ == '__main__':
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--auth', required=True)
    parser.add_argument('--config', required=True)
    parser.add_argument('--data', required=True)
    parser.add_argument('--start', help='Backfill from YYYY-MM, at most two years ago')
    sys.exit(run(parser.parse_args()))
