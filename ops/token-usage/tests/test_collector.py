"""Protect unit handling, response validation, account isolation, and replay semantics."""
import argparse
import contextlib
import io
import json
from pathlib import Path
import tempfile
from unittest.mock import patch
import unittest
import collector as c


class CollectorTests(unittest.TestCase):
    """Use synthetic data only; never require credentials or provider calls."""
    def payload(self, credits=2):
        return {'balance_unit': 'credit', 'group_by': 'day', 'data': [
            {'date': '2026-09-08', 'models': [{'model': 'gpt-5.5', 'credits': credits}],
             'totals': {'text_total_tokens': 100}}]}

    def test_repoll_replaces_corrected_totals(self):
        db = c.connect(':memory:')
        self.addCleanup(db.close)
        for credits in [2, 3, 3]:
            c.store(db, c.normalize(self.payload(credits), '2026-09-08', '2026-09-08'), 'account-a', 'now')
        result = c.snapshot(db)
        self.assertEqual(result['days'][0]['models'], [{'modelId': 'gpt-5.5', 'credits': '3'}])
        self.assertEqual(result['days'][0]['tokens']['text_total_tokens'], 100)
        self.assertNotIn('account-a', str(result))

    def test_rejects_percent_as_credits(self):
        payload = self.payload()
        payload['balance_unit'] = 'percent'
        with self.assertRaises(c.PollError):
            c.normalize(payload, '2026-09-08', '2026-09-08')

    def test_rejects_partial_malformed_response_before_write(self):
        payload = self.payload()
        payload['data'].append({'date': '2026-09-09', 'models': [{'model': 'gpt-5.5', 'credits': float('nan')}]})
        with self.assertRaises(c.PollError):
            c.normalize(payload, '2026-09-08', '2026-09-09')

    def test_account_change_cannot_mix_ledgers(self):
        db = c.connect(':memory:')
        self.addCleanup(db.close)
        rows = c.normalize(self.payload(), '2026-09-08', '2026-09-08')
        c.store(db, rows, 'account-a', 'now')
        with self.assertRaises(c.PollError):
            c.store(db, rows, 'account-b', 'later')
        self.assertEqual(db.execute('SELECT count(*) FROM model_usage').fetchone()[0], 1)

    def test_zero_day_clears_previous_models_without_inventing_tokens(self):
        db = c.connect(':memory:')
        self.addCleanup(db.close)
        c.store(db, c.normalize(self.payload(), '2026-09-08', '2026-09-08'), 'a', 'now')
        empty = {'balance_unit': 'credit', 'group_by': 'day', 'data': [{'date': '2026-09-08'}]}
        c.store(db, c.normalize(empty, '2026-09-08', '2026-09-08'), 'a', 'later')
        self.assertEqual(c.snapshot(db)['days'][0]['models'], [])
        self.assertIsNone(c.snapshot(db)['days'][0]['tokens']['text_total_tokens'])

    def test_auth_failure_preserves_snapshot_and_records_backoff(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'auth.json').write_text('{}')
            (root / 'config.json').write_text('{}')
            (root / 'snapshot.json').write_text('last good data')
            args = argparse.Namespace(data=directory, auth=str(root / 'auth.json'),
                                      config=str(root / 'config.json'), start=None)
            with patch.object(c, 'fetch', side_effect=c.PollError('codex_login_expired')):
                with contextlib.redirect_stderr(io.StringIO()):
                    self.assertEqual(c.run(args), 1)
            self.assertEqual((root / 'snapshot.json').read_text(), 'last good data')
            status = json.loads((root / 'status.json').read_text())
            self.assertEqual(status['reason'], 'codex_login_expired')
            self.assertGreater(status['retryAfter'], status['lastAttempt'])


if __name__ == '__main__':
    unittest.main()
