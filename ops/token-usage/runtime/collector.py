#!/usr/bin/env python3
"""Poll Codex's private dashboard into a private, idempotent daily usage ledger."""
import argparse
from contextlib import closing
import datetime as dt
import decimal
import json
import math
import os
from pathlib import Path
import re
import sqlite3
import sys
import urllib.error
import urllib.parse
import urllib.request

API = 'https://chatgpt.com/backend-api/wham/analytics/daily-workspace-usage-counts'
TOKEN_FIELDS = ('uncached_text_input_tokens', 'cached_text_input_tokens', 'text_output_tokens', 'text_total_tokens')


class PollError(Exception):
    """Carry a safe diagnostic without headers, response bodies, or account identifiers."""


class NoRedirect(urllib.request.HTTPRedirectHandler):
    """Prevent credentials following redirects away from the fixed provider endpoint."""
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def number(value):
    """Accept finite, nonnegative credit values without assuming a dollar conversion."""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise PollError('invalid_credit_value')
    if not math.isfinite(value) or value < 0:
        raise PollError('invalid_credit_value')
    return str(decimal.Decimal(str(value)))


def normalize(payload, start, end):
    """Validate the entire response before committing any model or token totals."""
    if payload.get('balance_unit') != 'credit' or payload.get('group_by') != 'day':
        raise PollError('unexpected_provider_units')
    if not isinstance(payload.get('data'), list):
        raise PollError('invalid_provider_data')
    days = []
    seen = set()
    for row in payload['data']:
        date = row['date']
        dt.date.fromisoformat(date)
        if not start <= date <= end or date in seen:
            raise PollError('invalid_provider_date')
        seen.add(date)
        models = {}
        for item in row.get('models') or []:
            model = item['model']
            if not isinstance(model, str) or not re.fullmatch(r'[A-Za-z0-9._:/-]{1,150}', model):
                raise PollError('invalid_model_id')
            models[model] = models.get(model, decimal.Decimal(0)) + decimal.Decimal(number(item['credits']))
        totals = row.get('totals') or {}
        tokens = {}
        for key in TOKEN_FIELDS:
            value = totals.get(key)
            if value is not None and (type(value) is not int or value < 0):
                raise PollError('invalid_token_count')
            tokens[key] = value
        days.append((date, {k: str(v) for k, v in models.items()}, tokens))
    return days


def connect(path):
    """Open the ledger with unique day/model keys and explicit aggregate token scope."""
    db = sqlite3.connect(path)
    db.executescript('''
      CREATE TABLE IF NOT EXISTS model_usage (
        day TEXT NOT NULL, model TEXT NOT NULL, credits TEXT NOT NULL,
        PRIMARY KEY(day, model));
      CREATE TABLE IF NOT EXISTS token_usage (
        day TEXT PRIMARY KEY, uncached_text_input_tokens INTEGER,
        cached_text_input_tokens INTEGER, text_output_tokens INTEGER, text_total_tokens INTEGER);
      CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    ''')
    return db


def store(db, days, account, fetched_at):
    """Replace returned days atomically; repeated polls never add the same usage twice."""
    previous = db.execute("SELECT value FROM metadata WHERE key='account'").fetchone()
    if previous and previous[0] != account:
        raise PollError('account_changed_requires_review')
    with db:
        for date, models, tokens in days:
            db.execute('DELETE FROM model_usage WHERE day=?', (date,))
            db.executemany('INSERT INTO model_usage VALUES(?,?,?)', [(date, model, value) for model, value in models.items()])
            db.execute('INSERT OR REPLACE INTO token_usage VALUES(?,?,?,?,?)', (date, *(tokens[k] for k in TOKEN_FIELDS)))
        db.executemany('INSERT OR REPLACE INTO metadata VALUES(?,?)', [('account', account), ('last_success', fetched_at)])


def atomic_json(path, value):
    """Replace private JSON files atomically, including when a reader is mid-refresh."""
    tmp = path.with_suffix('.tmp')
    tmp.write_text(json.dumps(value, separators=(',', ':')) + '\n')
    os.chmod(tmp, 0o600)
    os.replace(tmp, path)


def snapshot(db):
    """Export only dated model credits and separately scoped token totals, with no identity."""
    days = {}
    for row in db.execute('SELECT * FROM token_usage ORDER BY day'):
        days[row[0]] = {'date': row[0], 'models': [], 'tokens': dict(zip(TOKEN_FIELDS, row[1:]))}
    for date, model, credits in db.execute('SELECT * FROM model_usage ORDER BY day, model'):
        days[date]['models'].append({'modelId': model, 'credits': credits})
    updated = db.execute("SELECT value FROM metadata WHERE key='last_success'").fetchone()
    return {'version': 1, 'provider': 'codex', 'unit': 'credit', 'tokenScope': 'all_models',
            'updatedAt': updated[0] if updated else None, 'days': list(days.values())}


def fetch(auth, config, start, end):
    """Read the observed dashboard endpoint with the existing server OAuth sign-in."""
    tokens = auth.get('tokens') or {}
    if not tokens.get('access_token') or not tokens.get('account_id'):
        raise PollError('codex_login_required')
    query = urllib.parse.urlencode({'start_date': start, 'end_date': end, 'group_by': 'day', 'workspace_user': config['workspaceUser']})
    req = urllib.request.Request(API + '?' + query, headers={
        'Authorization': 'Bearer ' + tokens['access_token'],
        'ChatGPT-Account-Id': tokens['account_id'], 'Accept': 'application/json'})
    try:
        with urllib.request.build_opener(NoRedirect).open(req, timeout=30) as response:
            raw = response.read(8 * 1024 * 1024 + 1)
            if len(raw) > 8 * 1024 * 1024:
                raise PollError('response_too_large')
            return json.loads(raw), tokens['account_id']
    except urllib.error.HTTPError as exc:
        if exc.code == 401:
            raise PollError('codex_login_expired') from None
        if exc.code == 429:
            raise PollError('provider_rate_limited') from None
        raise PollError('provider_http_' + str(exc.code)) from None


def profile_history(auth):
    """Read older account-wide token totals without pretending they contain model attribution."""
    tokens = auth['tokens']
    request = urllib.request.Request('https://chatgpt.com/backend-api/wham/profiles/me', headers={
        'Authorization': 'Bearer ' + tokens['access_token'],
        'ChatGPT-Account-Id': tokens['account_id'], 'Accept': 'application/json'})
    with urllib.request.build_opener(NoRedirect).open(request, timeout=30) as response:
        raw = response.read(8 * 1024 * 1024 + 1)
        if len(raw) > 8 * 1024 * 1024:
            raise PollError('response_too_large')
        buckets = json.loads(raw)['stats']['daily_usage_buckets']
    rows = []
    for bucket in buckets:
        day, count = bucket['start_date'], bucket['tokens']
        if dt.date.fromisoformat(day).isoformat() != day or type(count) is not int or count < 0:
            raise PollError('invalid_profile_history')
        rows.append((day, count))
    return rows


def run(args):
    """Refresh the last week normally, or bounded historical chunks for an explicit backfill."""
    data = Path(args.data)
    now = dt.datetime.now(dt.timezone.utc)
    status_path = data / 'status.json'
    if status_path.exists():
        status = json.loads(status_path.read_text())
        if not args.start and status.get('retryAfter', '') > now.isoformat():
            print('poll deferred until backoff expires')
            return 0
    try:
        config = json.loads(Path(args.config).read_text())
        auth = json.loads(Path(args.auth).read_text())
        end = now.date()
        start = dt.date.fromisoformat(args.start) if args.start else end - dt.timedelta(days=7)
        if start > end or (end-start).days > 730:
            raise PollError('invalid_backfill_range')
        with closing(connect(data / 'usage.sqlite')) as db:
            while start <= end:
                stop = min(end, start + dt.timedelta(days=27))
                payload, account = fetch(auth, config, start.isoformat(), stop.isoformat())
                rows = normalize(payload, start.isoformat(), stop.isoformat())
                store(db, rows, account, now.isoformat())
                start = stop + dt.timedelta(days=1)
            with db:
                db.executemany('INSERT OR IGNORE INTO token_usage (day,text_total_tokens) VALUES (?,?)', profile_history(auth))
            result = snapshot(db)
            atomic_json(data / 'snapshot.json', result)
            atomic_json(status_path, {'state': 'ok', 'lastAttempt': now.isoformat(), 'lastSuccess': result['updatedAt']})
            print('Codex poll successful; stored days=' + str(len(result['days'])))
        return 0
    except Exception as exc:
        reason = str(exc) if isinstance(exc, PollError) else type(exc).__name__
        delay = 60 if reason == 'provider_rate_limited' else 30 if 'login' in reason else 10
        atomic_json(status_path, {'state': 'error', 'lastAttempt': now.isoformat(), 'reason': reason,
                                 'retryAfter': (now + dt.timedelta(minutes=delay)).isoformat()})
        print('Codex poll failed: ' + reason, file=sys.stderr)
        return 1


if __name__ == '__main__':
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--auth', required=True)
    parser.add_argument('--config', required=True)
    parser.add_argument('--data', required=True)
    parser.add_argument('--start', help='Backfill from an ISO date, at most two years ago')
    sys.exit(run(parser.parse_args()))
