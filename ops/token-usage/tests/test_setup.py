"""Validate private deployment inputs without SSH access or scheduler changes."""
import argparse
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import subprocess

from claude_ingest import device_id
from install_claude import load_inventory, remote


class SetupTests(unittest.TestCase):
    """Keep malformed identities out of SSH commands and reject ambiguous inventories."""

    def test_private_inventory_preserves_opaque_device_ids(self):
        inventory = {"server": "receiver-alias", "devices": [
            {"id": "sender-a", "host": None, "scheduler": "launchd"},
            {"id": "sender-b", "host": "sender-alias", "scheduler": "systemd"},
        ]}
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "devices.json"
            path.write_text(json.dumps(inventory))
            self.assertEqual(load_inventory(path), inventory)
            for device in inventory["devices"]:
                self.assertEqual(device_id(device["id"]), device["id"])

    def test_unsafe_device_id_cannot_enter_forced_command(self):
        for identity in ['sender;id', 'sender"', '../sender', 'sender\nother', 'a' * 65]:
            with self.subTest(identity=identity), self.assertRaises(argparse.ArgumentTypeError):
                device_id(identity)

    def test_invalid_inventory_fails_before_provisioning(self):
        valid = {"server": "receiver-alias", "devices": [
            {"id": "sender-a", "host": None, "scheduler": "launchd"},
        ]}
        cases = [
            {**valid, "server": "-oProxyCommand=command"},
            {**valid, "devices": []},
            {**valid, "devices": valid["devices"] * 2},
            {**valid, "devices": [{**valid["devices"][0], "id": "sender;id"}]},
            {**valid, "devices": [{**valid["devices"][0], "host": "-option"}]},
            {**valid, "devices": [{**valid["devices"][0], "scheduler": "unknown"}]},
        ]
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "devices.json"
            for inventory in cases:
                with self.subTest(inventory=inventory), self.assertRaises(ValueError):
                    path.write_text(json.dumps(inventory))
                    load_inventory(path)


    def test_setup_requires_host_verification_without_forwarding_agent(self):
        with patch('install_claude.subprocess.run', return_value=subprocess.CompletedProcess([], 0, '{"ok": true}')) as run:
            self.assertEqual(remote('receiver-alias', 'pass', {'example': 'private-value'}), {'ok': True})
        args, kwargs = run.call_args
        command = args[0]
        self.assertIn('StrictHostKeyChecking=yes', command)
        self.assertIn('ForwardAgent=no', command)
        self.assertNotIn('private-value', ' '.join(command))
        self.assertEqual(json.loads(kwargs['input']), {'example': 'private-value'})
