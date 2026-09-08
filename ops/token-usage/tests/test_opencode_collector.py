"""Protect cost aggregation, strict console parsing, and safe repeated imports."""
from contextlib import closing
import tempfile
from pathlib import Path
import unittest
from unittest.mock import patch
from types import SimpleNamespace
import json
import opencode_collector as c


def response(rows):
    """Wrap synthetic data in the observed console serialization."""
    return 'usage:$R[1]=[' + ','.join('$R['+str(i+2)+']={'+r+'}' for i, r in enumerate(rows)) + '],keys:$R[20]=[]'


class OpenCodeTests(unittest.TestCase):
    def test_sum_keys_and_plans_without_rounding(self):
        rows = c.parse_usage(response([
            'date:"2026-09-01",model:"glm-5.3",totalCost:100000001,keyId:"one",plan:"lite"',
            'date:"2026-09-01",model:"glm-5.3",totalCost:2,keyId:"two",plan:null']), '2026-09')
        with closing(c.connect(':memory:')) as db:
            c.store(db, {'2026-09': rows}, 'test', 'now')
            self.assertEqual(c.snapshot(db)['days'][0]['models'][0]['usageCostUsd'], '1.00000003')

    def test_reject_partial_or_executable_data(self):
        for row in ['date:"2026-09-01",model:"glm",totalCost:1,keyId:null,plan:null,extra:1',
                    'date:"2026-09-01",model:"glm",totalCost:evil(),keyId:null,plan:null',
                    'date:"2026-08-01",model:"glm",totalCost:1,keyId:null,plan:null']:
            with self.assertRaises(c.PollError):
                c.parse_usage(response([row]), '2026-09')

    def test_replay_correction_and_empty_month(self):
        with closing(c.connect(':memory:')) as db:
            month = {'2026-09': {('2026-09-01', 'glm'): 10}}
            for _ in range(2):
                c.store(db, month, 'test', 'now')
            self.assertEqual(db.execute('SELECT count(*),sum(cost_units) FROM model_usage').fetchone(), (1, 10))
            c.store(db, {'2026-09': {}}, 'test', 'later')
            self.assertEqual(c.snapshot(db)['days'], [])
            with self.assertRaises(c.PollError):
                c.store(db, month, 'different', 'later')

    def test_auth_failure_preserves_last_snapshot(self):
        with tempfile.TemporaryDirectory() as folder:
            p = Path(folder)
            (p/'config').write_text('{}')
            (p/'auth').write_text('synthetic-cookie')
            (p/'opencode-snapshot.json').write_text('last good')
            args = SimpleNamespace(data=folder, config=str(p/'config'), auth=str(p/'auth'), start=None)
            with patch.object(c, 'fetch', side_effect=c.PollError('opencode_login_or_access_rejected')):
                self.assertEqual(c.run(args), 1)
            self.assertEqual((p/'opencode-snapshot.json').read_text(), 'last good')
            self.assertIn('retryAfter', json.loads((p/'opencode-status.json').read_text()))


if __name__ == '__main__':
    unittest.main()
