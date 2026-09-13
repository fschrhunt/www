"""Exercise recovery and deduplication without accessing real sessions or the network."""
from contextlib import closing
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from claude_records import connect, extract, extract_e, extract_pi, merge, snapshot
from claude_local import scan, upload
from claude_ingest import ingest


def line(output=3, identity='msg_test'):
    """Make a synthetic assistant response with deliberately private content."""
    return (json.dumps({'type': 'assistant', 'timestamp': '2026-09-08T01:00:00Z',
        'message': {'id': identity, 'model': 'claude-opus-4-8', 'content': 'PRIVATE CONTENT',
                    'usage': {'input_tokens': 5, 'output_tokens': output}}})+'\n').encode()


class ClaudeCollectionTests(unittest.TestCase):
    def test_cache_duration_counters_are_distinct(self):
        row = json.loads(line())
        row['message']['usage'].update({'cache_creation_input_tokens': 30,
            'cache_creation': {'ephemeral_5m_input_tokens': 10, 'ephemeral_1h_input_tokens': 20}})
        self.assertEqual(extract(row)[-2:], [10, 20])

    def test_incremental_partial_append_and_truncation(self):
        with tempfile.TemporaryDirectory() as folder, closing(connect(':memory:')) as db:
            p = Path(folder)/'log.jsonl'
            p.write_bytes(line()+line(9)[:-3])
            scan(db, Path(folder))
            self.assertEqual(db.execute('SELECT output_tokens FROM records').fetchone()[0], 3)
            with p.open('ab') as f:
                f.write(line(9)[-3:])
            scan(db, Path(folder))
            self.assertEqual(db.execute('SELECT output_tokens FROM records').fetchone()[0], 9)
            self.assertEqual(scan(db, Path(folder)), (0, 0))
            p.write_bytes(line()+line(8))
            scan(db, Path(folder))
            self.assertEqual(db.execute('SELECT output_tokens FROM records').fetchone()[0], 9)
            p.write_bytes(line(2))
            scan(db, Path(folder))
            self.assertEqual(db.execute('SELECT count(*),sum(output_tokens) FROM records').fetchone(), (1, 9))

    def test_budget_resumes_without_missing_records(self):
        with tempfile.TemporaryDirectory() as folder, closing(connect(':memory:')) as db:
            p = Path(folder)/'log.jsonl'
            p.write_bytes(b''.join(line(identity='msg_'+str(i)) for i in range(5)))
            for _ in range(5):
                scan(db, Path(folder), budget=1)
            self.assertEqual(db.execute('SELECT count(*) FROM records').fetchone()[0], 5)

    def test_offline_queue_and_lost_ack_retry_across_devices(self):
        with tempfile.TemporaryDirectory() as folder, closing(connect(':memory:')) as db:
            p = Path(folder)
            (p/'log.jsonl').write_bytes(line())
            scan(db, p)
            with patch('claude_local.subprocess.run', side_effect=TimeoutError):
                with self.assertRaises(TimeoutError):
                    upload(db, {'host': 'unused'}, p)
            self.assertEqual(db.execute('SELECT dirty FROM records').fetchone()[0], 1)
            rows = [list(r[:7]) for r in db.execute('SELECT * FROM records')]
            raw = json.dumps({'version': 1, 'records': rows}).encode()
            for device in ['sender-a', 'sender-a', 'sender-b']:
                reply = ingest(p, device, raw)
                self.assertEqual(reply['ack'], hashlib.sha256(raw).hexdigest())
            with closing(connect(p/'claude.sqlite')) as receiver:
                self.assertEqual(receiver.execute('SELECT count(*),sum(output_tokens) FROM records').fetchone(), (1, 3))
            self.assertNotIn('PRIVATE', (p/'claude-snapshot.json').read_text())

    def test_invalid_batch_does_not_partially_commit(self):
        with tempfile.TemporaryDirectory() as folder:
            p = Path(folder)
            good = ['a'*64,'2026-09-08','claude-opus-4-8',1,2,3,4]
            with self.assertRaises(ValueError):
                ingest(p, 'sender-a', json.dumps({'version':1,'records':[good,good+['secret']]}).encode())
            self.assertFalse((p/'claude.sqlite').exists())

    def test_offline_device_history_is_preserved(self):
        with tempfile.TemporaryDirectory() as folder:
            p = Path(folder)
            for device, key in [('sender-a','a'),('sender-b','b')]:
                ingest(p, device, json.dumps({'version':1,'records':[[key*64,'2026-09-08','claude-opus-4-8',1,2,3,4]]}).encode())
            ingest(p, 'sender-b', json.dumps({'version':1,'records':[]}).encode())
            result = json.loads((p/'claude-snapshot.json').read_text())
            self.assertEqual(result['days'][0]['models'][0]['tokens']['output_tokens'],4)
            self.assertEqual(len(result['devices']),2)


class PiCollectionTests(unittest.TestCase):
    def test_openai_response_uses_reported_cache_counters(self):
        context = {}
        extract_pi({'type':'session','id':'pi-session'}, context)
        extract_pi({'type':'model_change','provider':'openai-codex','modelId':'gpt-6-astra'}, context)
        row = {'type':'message','id':'entry-a','parentId':None,'timestamp':'2026-09-09T01:00:00Z',
               'message':{'role':'assistant','provider':'openai-codex','model':'gpt-6-astra',
                          'responseId':'response-a','usage':{'input':20,'output':5,'cacheRead':80,
                                                           'cacheWrite':0}}}
        record = extract_pi(row, context)
        self.assertEqual(record[1:7], ['2026-09-09','gpt-6-astra',20,5,80,0])
        self.assertEqual(record[0], extract_pi(row, {})[0])

    def test_anthropic_summary_splits_one_hour_cache_writes(self):
        context = {'session':'pi-session','provider':'anthropic','model':'claude-opus-5'}
        row = {'type':'compaction','id':'entry-b','parentId':'entry-a',
               'timestamp':'2026-09-09T02:00:00+00:00',
               'usage':{'input':7,'output':3,'cacheRead':11,'cacheWrite':30,'cacheWrite1h':20}}
        record = extract_pi(row, context)
        self.assertEqual(record[3:], [7,3,11,30,10,20])

    def test_subagent_tool_usage_uses_its_reported_model_and_call_identity(self):
        row = {'type':'message','id':'entry-tool','timestamp':'2026-09-09T03:00:00Z',
               'message':{'role':'toolResult','toolCallId':'call-a','toolName':'subagent',
                          'details':{'model':'gpt-5.6-terra'},
                          'usage':{'input':14,'output':4,'cacheRead':50,'cacheWrite':0}}}
        copied = {**row, 'id':'copied-entry'}
        self.assertEqual(extract_pi(row, {})[2:], ['gpt-5.6-terra',14,4,50,0,0,0])
        self.assertEqual(extract_pi(row, {})[0], extract_pi(copied, {})[0])

    def test_opencode_session_usage_is_left_to_the_account_collector(self):
        row = {'type':'message','id':'entry-c','timestamp':'2026-09-09T01:00:00Z',
               'message':{'role':'assistant','provider':'opencode-go','model':'glm-5.3-flash',
                          'usage':{'input':10,'output':2,'cacheRead':0,'cacheWrite':0}}}
        self.assertIsNone(extract_pi(row, {}))

    def test_models_route_to_their_existing_provider_snapshots(self):
        with closing(connect(':memory:')) as db:
            for identity, model in (('a'*64, 'claude-sonnet-5'), ('b'*64, 'gpt-6-astra')):
                merge(db, [identity, '2026-09-09', model, 1, 2, 3, 0, 0, 0])
            self.assertEqual([m['modelId'] for m in snapshot(db)['days'][0]['models']],
                             ['claude-sonnet-5'])
            self.assertEqual([m['modelId'] for m in snapshot(db, 'codex')['days'][0]['models']],
                             ['gpt-6-astra'])

    def test_incremental_pi_context_survives_between_scans(self):
        with tempfile.TemporaryDirectory() as folder, closing(connect(':memory:')) as db:
            path = Path(folder)/'session.jsonl'
            header = {'type':'session','id':'pi-session'}
            model = {'type':'model_change','provider':'openai-codex','modelId':'gpt-6-astra'}
            path.write_text(json.dumps(header)+'\n'+json.dumps(model)+'\n')
            scan(db, Path(folder), provider='pi')
            summary = {'type':'compaction','id':'entry-d','parentId':None,
                       'timestamp':'2026-09-09T02:00:00Z',
                       'usage':{'input':10,'output':2,'cacheRead':0,'cacheWrite':0}}
            with path.open('a') as stream:
                stream.write(json.dumps(summary)+'\n')
            scan(db, Path(folder), provider='pi')
            self.assertEqual(db.execute('SELECT model,input_tokens FROM records').fetchone(),
                             ('gpt-6-astra',10))


class ECollectionTests(unittest.TestCase):
    def test_openai_usage_subtracts_cached_input(self):
        context = {}
        extract_e({'type':'session','id':'e-session','model':'openai-codex/gpt-6-astra'}, context)
        row = {'type':'message','id':'018f-entry','timestamp':1788951146329,
               'message':{'role':'assistant','content':'PRIVATE CONTENT',
                          'usage':{'input':100,'output':9,'cache_read':80}}}
        record = extract_e(row, context)
        self.assertEqual(record[2:], ['gpt-6-astra',20,9,80,0,0,0])

    def test_opencode_and_incomplete_anthropic_records_are_not_duplicated_or_guessed(self):
        row = {'type':'message','id':'018f-entry','timestamp':1788951146329,
               'message':{'role':'assistant','usage':{'input':100,'output':9,'cache_read':80}}}
        for model in ('opencode-go/glm-5.3-flash', 'anthropic/claude-opus-5'):
            self.assertIsNone(extract_e(row, {'model':model}))


class CodexCollectionTests(unittest.TestCase):
    def test_codex_cached_input_and_repeated_checkpoints(self):
        from claude_records import extract_codex
        context = {}
        extract_codex({'type':'session_meta','payload':{'id':'test-session'}}, context)
        extract_codex({'type':'turn_context','payload':{'model':'gpt-5.5'}}, context)
        usage = {'input_tokens':100,'cached_input_tokens':80,'output_tokens':10,'total_tokens':110}
        row = {'type':'event_msg','timestamp':'2026-09-08T00:00:00Z',
               'payload':{'type':'token_count','info':{'last_token_usage':usage,'total_token_usage':usage}}}
        record = extract_codex(row, context)
        self.assertEqual(record[3:7], [20,10,80,0])
        self.assertIsNone(extract_codex(row, context))
        copy_context = {'session':'test-session','model':'gpt-5.5'}
        self.assertEqual(extract_codex(row, copy_context)[0], record[0])

    def test_codex_and_claude_snapshots_remain_separate(self):
        from claude_records import merge, snapshot
        with closing(connect(':memory:')) as db:
            merge(db, ['a'*64,'2026-09-08','gpt-5.5',1,2,3,0,0,0])
            merge(db, ['b'*64,'2026-09-08','claude-opus-4-8',1,2,3,0,0,0])
            self.assertEqual(snapshot(db)['days'][0]['models'][0]['modelId'],'claude-opus-4-8')
            self.assertEqual(snapshot(db,'codex')['days'][0]['models'][0]['modelId'],'gpt-5.5')


if __name__ == '__main__':
    unittest.main()
