"""Exercise recovery and deduplication without accessing real sessions or the network."""
from contextlib import closing
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from claude_records import connect, snapshot, extract
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
            for device in ['mac', 'mac', 'mini']:
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
                ingest(p, 'mac', json.dumps({'version':1,'records':[good,good+['secret']]}).encode())
            self.assertFalse((p/'claude.sqlite').exists())

    def test_offline_device_history_is_preserved(self):
        with tempfile.TemporaryDirectory() as folder:
            p = Path(folder)
            for device, key in [('mac','a'),('mini','b')]:
                ingest(p, device, json.dumps({'version':1,'records':[[key*64,'2026-09-08','claude-opus-4-8',1,2,3,4]]}).encode())
            ingest(p, 'mini', json.dumps({'version':1,'records':[]}).encode())
            result = json.loads((p/'claude-snapshot.json').read_text())
            self.assertEqual(result['days'][0]['models'][0]['tokens']['output_tokens'],4)
            self.assertEqual(len(result['devices']),2)


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
