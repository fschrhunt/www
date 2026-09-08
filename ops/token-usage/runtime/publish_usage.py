#!/usr/bin/env python3
"""Price private aggregate snapshots and replace one public usage-only Vercel Blob object."""
import argparse
import datetime as dt
from decimal import Decimal
import json
import os
from pathlib import Path
import re
import sys
import urllib.request
from collector import NoRedirect, atomic_json


def amount(value):
    """Accept finite nonnegative monetary values without binary rounding."""
    number = Decimal(str(value))
    if not number.is_finite() or number < 0:
        raise ValueError('invalid_amount')
    return number


def model_id(value):
    """Unify known model aliases so their daily costs combine under one identity."""
    if not isinstance(value, str) or not re.fullmatch(r'[A-Za-z0-9._:/-]{1,150}', value):
        raise ValueError('invalid_model')
    if value == 'ox-alpha-free':
        return 'glm-5.3-flash'
    if value.startswith('claude-'):
        return re.sub(r'-\d{8}$', '', value).replace('.', '-')
    return value


def claude_cost(tokens, rates):
    """Estimate standard global API value using separate five-minute and one-hour cache writes."""
    values = [amount(tokens.get(key, 0)) for key in (
        'input_tokens', 'output_tokens', 'cache_read_input_tokens',
        'cache_write_5m_tokens', 'cache_write_1h_tokens')]
    total = amount(tokens['cache_creation_input_tokens'])
    # Some Claude responses omit the combined counter but retain the duration breakdown.
    unknown = max(Decimal(0), total - values[3] - values[4])
    if unknown:
        return None
    return sum(value * amount(rate) for value, rate in zip(values, rates)) / 1_000_000


def build(codex, opencode, claude, prices, now, codex_local=None):
    """Allowlist only dated model estimates and freshness metadata for public distribution."""
    if codex.get('unit') != 'credit' or opencode.get('unit') != 'USD' or claude.get('unit') != 'token':
        raise ValueError('unexpected_source_units')
    days, missing, local_counts = {}, set(), {}
    for provider, payload in [('codex',codex), ('opencode',opencode), ('claude',claude)]:
        for row in payload['days']:
            day = dt.date.fromisoformat(row['date']).isoformat()
            models = days.setdefault(day, {})
            for item in row['models']:
                model = model_id(item['modelId'])
                if provider == 'codex':
                    # Charged credits exclude included subscription usage; they cannot price these tokens.
                    value = None
                elif provider == 'opencode':
                    value = amount(item['usageCostUsd'])
                else:
                    rates = prices['claudeUsdPerMillion'].get(model)
                    value = claude_cost(item['tokens'], rates) if rates else None
                record = models.setdefault(model, {'usd':Decimal(0), 'complete':False})
                if value is None:
                    missing.add(model)
                else:
                    record['usd'] += value
                    record['complete'] = True
    # Local token counters replace unpriced cloud entries without adding charged credits.
    if codex_local is not None:
        if codex_local.get('unit') != 'token':
            raise ValueError('unexpected_local_units')
        for row in codex_local['days']:
            models = days.setdefault(dt.date.fromisoformat(row['date']).isoformat(), {})
            for item in row['models']:
                model = model_id(item['modelId'])
                rates = prices['codexUsdPerMillion'].get(model)
                tokens = item['tokens']
                value = sum(amount(tokens[key]) * amount(rate) for key, rate in zip(
                    ('input_tokens', 'output_tokens', 'cache_read_input_tokens'), rates)) / 1_000_000 if rates else None
                record = models.setdefault(model, {'usd':Decimal(0), 'complete':False})
                if value is not None:
                    local_counts[row['date']] = local_counts.get(row['date'], 0) + sum(
                        amount(tokens[key]) for key in ('input_tokens', 'output_tokens', 'cache_read_input_tokens'))
                    record['usd'] += value
                    record['complete'] = True
    reconstructed = []
    history = prices.get('historicalCodex')
    if history:
        # Only backfill the fixed historical window, subtracting tokens already priced from logs.
        for row in codex['days']:
            if row['date'] > history['through']:
                continue
            total = amount(row.get('tokens', {}).get('text_total_tokens') or 0)
            remaining = max(Decimal(0), total - local_counts.get(row['date'], 0))
            if remaining:
                model = next((model for date,model in reversed(history.get('models', []))
                              if date <= row['date']), 'gpt-unattributed')
                record = days[row['date']].setdefault(model, {'usd':Decimal(0), 'complete':False})
                record['usd'] += remaining * amount(history['usdPerToken'])
                record['complete'] = True
                reconstructed.append(row['date'])
    synthetic_dates = []
    synthetic = prices.get('syntheticClaude', {})
    recorded_claude_dates = {row['date'] for row in claude['days'] if row['models']}
    for row in synthetic.get('days', []):
        day = dt.date.fromisoformat(row['date']).isoformat()
        if day in recorded_claude_dates or not synthetic['start'] <= day <= synthetic['through']:
            continue
        model = model_id(row['modelId'])
        value = amount(row['usd'])
        if value > 0:
            record = days.setdefault(day, {}).setdefault(model, {'usd':Decimal(0), 'complete':False})
            record['usd'] += value
            record['complete'] = True
            synthetic_dates.append(day)
    # Do not publish placeholder model rows, including to already-open older chart clients.
    missing = {model for models in days.values() for model, record in models.items() if not record['complete']}
    dated = [{'date':day,'models':[{'modelId':model, 'usd':str(record['usd'])}
             for model,record in sorted(models.items()) if record['complete'] and record['usd'] > 0]}
             for day,models in sorted(days.items())]
    active_dates = {row['date'] for row in codex['days']
                    if amount(row.get('tokens', {}).get('text_total_tokens') or 0) > 0}
    active_dates.update(row['date'] for row in dated if row['models'])
    if active_dates:
        dated = [row for row in dated if row['date'] >= min(active_dates)]
    devices = claude['devices']
    delayed = sum((now - dt.datetime.fromisoformat(d['lastSeen'])).total_seconds() > 3600 for d in devices)
    return {'version':1, 'unit':'USD', 'metric':'estimated_usage_value',
            'publishedAt':now.isoformat(), 'pricingVerifiedAt':prices['verifiedAt'],
            'sources':{'codex':codex['updatedAt'], 'opencode':opencode['updatedAt'],
                       'claude':max((d['lastSeen'] for d in devices),default=None), 'claudeDevicesDelayed':delayed},
            'unpricedModels':sorted(missing), 'incompleteSources':['codex'],
            'reconstruction':{'dates':reconstructed, 'method':history['method'] if history else None,
                              'modelAttribution':history.get('modelAttribution') if history else None},
            'synthetic':{'provider':'claude','dates':synthetic_dates,'method':synthetic.get('method')},
            'days':dated}



def put(snapshot, config):
    """Use the Blob SDK v12 PUT protocol at its fixed HTTPS origin, refusing redirects."""
    raw = json.dumps(snapshot,separators=(',',':')).encode()
    if len(raw) > 2*1024*1024:
        raise ValueError('snapshot_too_large')
    request = urllib.request.Request('https://vercel.com/api/blob/?pathname=usage.json',data=raw,method='PUT',headers={
        'Authorization':'Bearer '+config['token'], 'x-api-version':'12',
        'x-vercel-blob-store-id':config['storeId'], 'x-vercel-blob-access':'public',
        'x-add-random-suffix':'0', 'x-allow-overwrite':'1', 'x-content-type':'application/json',
        'x-cache-control-max-age':'60', 'User-Agent':'token-usage/1.0'})
    with urllib.request.build_opener(NoRedirect).open(request, timeout=30) as response:
        result = json.loads(response.read(65536))
    expected = 'https://'+config['storeId'].removeprefix('store_').lower()+'.public.blob.vercel-storage.com/usage.json'
    if result.get('url') != expected:
        raise ValueError('unexpected_blob_url')
    return result['url']


def run(args):
    """Keep the previous public object when validation or upload fails; retry on the next timer."""
    now = dt.datetime.now(dt.timezone.utc)
    state = Path(args.data)
    try:
        load = lambda name: json.loads(Path(name).read_text())
        result = build(load(args.codex),load(args.opencode),load(args.claude),load(args.prices),now,load(args.codex_local))
        url = put(result,load(args.config))
        atomic_json(state/'published-snapshot.json', result)
        atomic_json(state/'publish-status.json', {'state':'ok','lastSuccess':now.isoformat(),'url':url,
                                                 'unpricedModels':result['unpricedModels']})
        print('Usage published; days='+str(len(result['days']))+' unpriced='+str(len(result['unpricedModels'])))
        return 0
    except Exception as error:
        atomic_json(state/'publish-status.json', {'state':'error','lastAttempt':now.isoformat(),'errorType':type(error).__name__})
        print('Usage publish failed: '+type(error).__name__,file=sys.stderr)
        return 1


if __name__=='__main__':
    os.umask(0o077)
    p=argparse.ArgumentParser(description=__doc__)
    for name in ['codex','codex-local','opencode','claude','prices','config','data']:
        p.add_argument('--'+name,required=True)
    raise SystemExit(run(p.parse_args()))
