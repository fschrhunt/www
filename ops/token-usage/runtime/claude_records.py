"""Validate and merge anonymous Claude and Codex request counters shared by sender and receiver."""
import datetime as dt
import hashlib
import json
import re
import sqlite3

FIELDS = ('input_tokens', 'output_tokens', 'cache_read_input_tokens', 'cache_creation_input_tokens', 'cache_write_5m_tokens', 'cache_write_1h_tokens')


def connect(path):
    """Keep one monotonic counter record per provider message, plus incremental scan state."""
    db = sqlite3.connect(path, timeout=20)
    db.executescript('''CREATE TABLE IF NOT EXISTS records (
      id TEXT PRIMARY KEY, day TEXT NOT NULL, model TEXT NOT NULL,
      input_tokens INTEGER NOT NULL, output_tokens INTEGER NOT NULL,
      cache_read_input_tokens INTEGER NOT NULL, cache_creation_input_tokens INTEGER NOT NULL,
      dirty INTEGER NOT NULL DEFAULT 1);
      CREATE TABLE IF NOT EXISTS files (
      path TEXT PRIMARY KEY, inode TEXT, size INTEGER, mtime INTEGER, offset INTEGER, prefix TEXT);
      CREATE TABLE IF NOT EXISTS devices (device TEXT PRIMARY KEY, last_seen TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS contexts (path TEXT PRIMARY KEY, value TEXT NOT NULL);''')
    columns = {row[1] for row in db.execute('PRAGMA table_info(records)')}
    migrated = False
    for field in FIELDS[4:]:
        if field not in columns:
            db.execute('ALTER TABLE records ADD COLUMN '+field+' INTEGER NOT NULL DEFAULT 0')
            migrated = True
    if migrated:
        # Existing queues must revisit retained logs to recover cache-duration counters.
        db.execute('DELETE FROM files')
        db.execute('UPDATE records SET dirty=1')
        db.commit()
    return db


def validate(row):
    """Reject malformed counters and identities before they can enter either ledger."""
    if not isinstance(row, list) or len(row) not in (7, 9):
        raise ValueError('invalid_record')
    if len(row) == 7:
        row = row + [0, 0]
    key, day, model, *values = row
    if not isinstance(key, str) or not re.fullmatch('[a-f0-9]{64}', key):
        raise ValueError('invalid_record_id')
    if not isinstance(day, str) or dt.date.fromisoformat(day).isoformat() != day:
        raise ValueError('invalid_date')
    if not isinstance(model, str) or not re.fullmatch(r'(?:claude-|gpt-|codex-|o[134](?:-|$))[A-Za-z0-9._-]{0,120}', model):
        raise ValueError('invalid_model')
    if any(type(v) is not int or not 0 <= v <= 10**12 for v in values):
        raise ValueError('invalid_tokens')
    return row


def extract(row):
    """Discard transcript content and retain only hashed message identity, UTC day, model, and counters."""
    message = row.get('message')
    if row.get('type') != 'assistant' or not isinstance(message, dict):
        return None
    usage = message.get('usage')
    if not isinstance(usage, dict) or not str(message.get('model', '')).startswith('claude-'):
        return None
    identity = message.get('id')
    if not isinstance(identity, str) or not identity.startswith('msg_'):
        return None
    stamp = dt.datetime.fromisoformat(row['timestamp'].replace('Z', '+00:00'))
    if stamp.tzinfo is None:
        raise ValueError('timestamp_without_timezone')
    record = [hashlib.sha256(identity.encode()).hexdigest(),
              stamp.astimezone(dt.timezone.utc).date().isoformat(), message['model']]
    cache = usage.get('cache_creation') or {}
    return validate(record + [usage.get(field, 0) for field in FIELDS[:4]] +
                    [cache.get('ephemeral_5m_input_tokens', 0), cache.get('ephemeral_1h_input_tokens', 0)])


def merge(db, row):
    """Merge progressive or copied response records once, preserving the greatest observed counters."""
    previous = db.execute('SELECT day,model FROM records WHERE id=?', (row[0],)).fetchone()
    if previous and previous[1] != row[2]:
        raise ValueError('message_model_conflict')
    columns = 'id,day,model,' + ','.join(FIELDS)
    updates = ','.join(f'{field}=max(records.{field},excluded.{field})' for field in FIELDS)
    changed = ' OR '.join(f'excluded.{field}>records.{field}' for field in FIELDS)
    db.execute('INSERT INTO records ('+columns+') VALUES('+','.join('?' for _ in range(9))+') '
               'ON CONFLICT(id) DO UPDATE SET day=min(records.day,excluded.day),'+updates+
               ',dirty=1 WHERE excluded.day<records.day OR '+changed, row)



def atomic_json(path, payload):
    """Replace a private JSON file only after its complete contents are written."""
    import os
    temporary = path.with_suffix('.tmp')
    with temporary.open('w') as stream:
        json.dump(payload, stream, separators=(',', ':'))
        stream.write('\n')
        stream.flush()
        os.fsync(stream.fileno())
    os.chmod(temporary, 0o600)
    os.replace(temporary, path)


def snapshot(db, provider="claude"):
    """Publish aggregates and source freshness, excluding even hashed message identities."""
    days = {}
    sql = 'SELECT day,model,' + ','.join('sum('+f+')' for f in FIELDS) + (' FROM records WHERE model LIKE \'claude-%\'' if provider=='claude' else ' FROM records WHERE model NOT LIKE \'claude-%\'') + ' GROUP BY day,model ORDER BY day,model'
    for day, model, *values in db.execute(sql):
        days.setdefault(day, {'date': day, 'models': []})['models'].append(
            {'modelId': model, 'tokens': dict(zip(FIELDS, values))})
    return {'version': 1, 'provider': provider, 'unit': 'token', 'timezone': 'UTC',
            'scope': 'collected_'+provider+'_logs', 'days': list(days.values()),
            'devices': [{'device': device, 'lastSeen': stamp} for device, stamp in db.execute('SELECT * FROM devices ORDER BY device')]}


def extract_codex(row, context):
    """Read Codex's per-response usage once per cumulative checkpoint, excluding cached input twice."""
    payload = row.get('payload') or {}
    kind = row.get('type')
    if kind == 'session_meta':
        context['session'] = payload.get('id')
    elif kind == 'turn_context' and isinstance(payload.get('model'), str):
        context['model'] = payload['model']
    elif kind == 'event_msg' and payload.get('type') == 'token_count':
        info = payload.get('info') or {}
        usage, total = info.get('last_token_usage'), info.get('total_token_usage')
        if not usage or not total or not context.get('session') or not context.get('model'):
            return None
        checkpoint = json.dumps(total, sort_keys=True, separators=(',', ':'))
        if context.get('checkpoint') == checkpoint:
            return None
        context['checkpoint'] = checkpoint
        count = usage.get('input_tokens', 0)
        cached = usage.get('cached_input_tokens', 0)
        output = usage.get('output_tokens', 0)
        if any(type(v) is not int or v < 0 for v in [count, cached, output]) or cached > count:
            raise ValueError('invalid_codex_counters')
        if count + output == 0:
            return None
        identity = hashlib.sha256(('codex:'+context['session']+':'+checkpoint).encode()).hexdigest()
        stamp = dt.datetime.fromisoformat(row['timestamp'].replace('Z', '+00:00'))
        if stamp.tzinfo is None:
            raise ValueError('timestamp_without_timezone')
        return validate([identity, stamp.astimezone(dt.timezone.utc).date().isoformat(),
                         context['model'], count-cached, output, cached, 0, 0, 0])
    return None
