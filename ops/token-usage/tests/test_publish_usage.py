"""Pin pricing math, keep private snapshot fields out of the public output, and pin the R2 upload."""
import datetime as dt
import io
import json
from pathlib import Path
import unittest
from unittest import mock
import publish_usage
from publish_usage import build, claude_cost, model_id


class PricingTests(unittest.TestCase):
    def test_historical_reconstruction_subtracts_priced_tokens_and_has_a_cutoff(self):
        now=dt.datetime.now(dt.timezone.utc)
        prices={'verifiedAt':'2026-09-08','claudeUsdPerMillion':{},
                'codexUsdPerMillion':{'gpt-5.5':['5','30','.5']},
                'historicalCodex':{'through':'2026-09-07','usdPerToken':'0.000001','method':'test'}}
        cloud={'unit':'credit','updatedAt':now.isoformat(),'days':[
            {'date':date,'models':[],'tokens':{'text_total_tokens':tokens}}
            for date,tokens in [('2026-02-22',0),('2026-02-23',100),('2026-09-07',200),('2026-09-08',300)]]}
        local={'unit':'token','days':[{'date':'2026-09-07','models':[{'modelId':'gpt-5.5',
            'tokens':{'input_tokens':50,'output_tokens':10,'cache_read_input_tokens':40}}]}]}
        result=build(cloud,{'unit':'USD','updatedAt':now.isoformat(),'days':[]},
                     {'unit':'token','devices':[],'days':[]},prices,now,local)
        self.assertEqual(result['days'][0]['date'],'2026-02-23')
        models={m['modelId']:m['usd'] for m in result['days'][1]['models']}
        self.assertEqual(models['gpt-unattributed'],'0.000100')
        self.assertEqual(result['days'][-1]['models'],[])
        self.assertEqual(result['reconstruction']['dates'],['2026-02-23','2026-09-07'])

    def test_synthetic_history_never_replaces_recorded_claude_usage(self):
        now=dt.datetime.now(dt.timezone.utc)
        prices={'verifiedAt':'2026-09-08','claudeUsdPerMillion':{'claude-opus-5':['5','25','.5','6.25','10']},
                'syntheticClaude':{'start':'2026-08-15','through':'2026-08-16','method':'synthetic',
                'days':[{'date':day,'modelId':'claude-opus-5','usd':'99'}
                        for day in ['2026-08-15','2026-08-16','2026-08-17']]}}
        claude={'unit':'token','devices':[],'days':[{'date':'2026-08-16','models':[{'modelId':'claude-opus-5',
                'tokens':{'input_tokens':1000000,'cache_creation_input_tokens':0}}]}]}
        result=build({'unit':'credit','updatedAt':now.isoformat(),'days':[]},
                     {'unit':'USD','updatedAt':now.isoformat(),'days':[]},claude,prices,now)
        self.assertEqual(result['synthetic']['dates'],['2026-08-15'])
        self.assertEqual(result['days'][-1]['models'][0]['usd'],'5.00')
        self.assertEqual(result['days'][-1]['date'],'2026-08-16')

    def test_opencode_alias_costs_merge(self):
        now=dt.datetime.now(dt.timezone.utc)
        prices=json.loads((Path(__file__).resolve().parents[1]/'runtime/pricing.json').read_text())
        prices.pop('syntheticClaude', None)
        cloud={'unit':'credit','updatedAt':now.isoformat(),'days':[]}
        opencode={'unit':'USD','updatedAt':now.isoformat(),'days':[{'date':'2026-09-08','models':[
            {'modelId':'ox-alpha-free','usageCostUsd':'0.2'},
            {'modelId':'glm-5.3-flash','usageCostUsd':'0.3'}]}]}
        claude={'unit':'token','devices':[],'days':[]}
        result=build(cloud,opencode,claude,prices,now)
        self.assertEqual(result['days'][0]['models'],[{'modelId':'glm-5.3-flash','usd':'0.5'}])

    def test_distinct_cache_prices(self):
        tokens={'input_tokens':1000000,'output_tokens':1000000,'cache_read_input_tokens':1000000,
                'cache_creation_input_tokens':2000000,'cache_write_5m_tokens':1000000,'cache_write_1h_tokens':1000000}
        self.assertEqual(claude_cost(tokens,['5','25','.5','6.25','10']),46.75)
        del tokens['cache_write_1h_tokens']
        self.assertIsNone(claude_cost(tokens,['5','25','.5','6.25','10']))

    def test_subscription_credits_are_not_treated_as_usage_value(self):
        prices=json.loads((Path(__file__).resolve().parents[1]/'runtime/pricing.json').read_text())
        prices.pop('syntheticClaude', None)
        now=dt.datetime.now(dt.timezone.utc)
        a={'unit':'credit','updatedAt':now.isoformat(),'account':'PRIVATE',
           'days':[{'date':'2026-09-08','models':[{'modelId':'gpt-5.5','credits':'25'}]}]}
        b={'unit':'USD','updatedAt':now.isoformat(),'days':[]}
        c={'unit':'token','devices':[{'device':'PRIVATE','lastSeen':now.isoformat()}],'days':[]}
        result=build(a,b,c,prices,now)
        self.assertEqual(result['days'][0]['models'], [])
        self.assertEqual(result['incompleteSources'], ['codex'])
        local={'unit':'token','days':[{'date':'2026-09-08','models':[{'modelId':'gpt-5.5',
               'tokens':{'input_tokens':1000000,'output_tokens':1000000,'cache_read_input_tokens':1000000}}]}]}
        priced=build(a,b,c,prices,now,local)
        self.assertEqual(priced['days'][0]['models'][0]['usd'], '35.5')
        self.assertNotIn('PRIVATE',json.dumps(result))
        self.assertEqual(model_id('claude-haiku-4-5-20251001'),'claude-haiku-4-5')

    def test_r2_object_url_refuses_identifiers_that_could_leave_the_bucket(self):
        config = {'accountId': '0' * 32, 'bucket': 'token-usage'}
        self.assertEqual(publish_usage.r2_object_url(config, 'usage.json'),
                         'https://' + '0' * 32 + '.r2.cloudflarestorage.com/token-usage/usage.json')
        for bad in [{'bucket': '../x'}, {'bucket': 'token-usage/objects'}, {'accountId': 'x'}]:
            with self.assertRaises(ValueError):
                publish_usage.r2_object_url({**config, **bad}, 'usage.json')
        with self.assertRaises(ValueError):
            publish_usage.r2_object_url(config, '../usage.json')

    def test_r2_requests_carry_a_scoped_signature_and_never_the_secret(self):
        config = {'accountId': '0' * 32, 'bucket': 'token-usage', 'accessKeyId': 'a' * 32, 'secretAccessKey': 'b' * 64}
        now = dt.datetime(2026, 9, 16, 12, 0, tzinfo=dt.timezone.utc)
        request = publish_usage.r2_request(config, 'PUT', 'usage.json', b'{}', 'application/json', now)
        auth = request.get_header('Authorization')
        self.assertTrue(auth.startswith('AWS4-HMAC-SHA256 Credential=' + 'a' * 32 + '/20260916/auto/s3/aws4_request, '))
        self.assertIn('SignedHeaders=content-type;host;x-amz-content-sha256;x-amz-date, Signature=', auth)
        self.assertNotIn('b' * 64, json.dumps(dict(request.header_items())))
        # Same inputs, same signature; a different body changes it.
        self.assertEqual(auth, publish_usage.r2_request(config, 'PUT', 'usage.json', b'{}', 'application/json', now).get_header('Authorization'))
        self.assertNotEqual(auth, publish_usage.r2_request(config, 'PUT', 'usage.json', b'[]', 'application/json', now).get_header('Authorization'))
        with self.assertRaises(ValueError):
            publish_usage.r2_request({**config, 'secretAccessKey': 'not-hex'}, 'GET', 'usage.json')

    def test_r2_upload_counts_only_a_confirmed_write(self):
        config = {'accountId': '0' * 32, 'bucket': 'token-usage', 'accessKeyId': 'a' * 32, 'secretAccessKey': 'b' * 64}
        sent = []

        class Response(io.BytesIO):
            def __init__(self, status): super().__init__(b''); self.status = status
            def __enter__(self): return self
            def __exit__(self, *args): return False

        class Opener:
            def __init__(self, status): self.status = status
            def open(self, request, timeout):
                sent.append(request)
                return Response(self.status)

        with mock.patch.object(publish_usage.urllib.request, 'build_opener', return_value=Opener(200)):
            self.assertEqual(publish_usage.put({'days': []}, config), 'r2://token-usage/usage.json')
        self.assertEqual(sent[0].get_method(), 'PUT')
        self.assertEqual(sent[0].full_url, 'https://' + '0' * 32 + '.r2.cloudflarestorage.com/token-usage/usage.json')
        with mock.patch.object(publish_usage.urllib.request, 'build_opener', return_value=Opener(204 + 200)):
            with self.assertRaises(ValueError):
                publish_usage.put({'days': []}, config)


if __name__=='__main__':unittest.main()
