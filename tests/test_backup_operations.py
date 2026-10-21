"""Destructive retention gates and notification failure behavior, without network."""
import datetime as dt
import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts/backup"))
import backup_operations as operations


class BackupOperationsTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.now = dt.datetime(2026, 10, 21, 12, tzinfo=dt.timezone.utc)

    def tearDown(self):
        self.temp.cleanup()

    def copy(self, days, verified=False):
        stamp = (self.now - dt.timedelta(days=days)).strftime("%Y%m%dT%H%M%SZ")
        directory = self.root / stamp
        directory.mkdir()
        receipt = {"format": 1, "project_ref": "fixture", "created_at": stamp, "files": []}
        for name in ("database.dump.age", "manifest.json.age", "inventory.json.age"):
            data = b"encrypted fixture"
            (directory / name).write_bytes(data)
            receipt["files"].append({"file": name, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()})
        (directory / "completed.json").write_text(json.dumps(receipt))
        if verified:
            (directory / "restore-verification.json").write_text(json.dumps({"status": "passed", "project_ref": "fixture", "backup": stamp}))
        return directory

    def test_latest_verified_restoration_survives_all_retention_windows(self):
        baseline = self.copy(900, verified=True)
        for day in range(500):
            self.copy(day)
        result = operations.prune(self.root, "fixture", self.now, apply=True)
        self.assertGreater(len(result["removed"]), 300)
        self.assertTrue(baseline.is_dir())
        for day in (0, 1, 2, 6, 29):
            self.assertTrue((self.root / (self.now - dt.timedelta(days=day)).strftime("%Y%m%dT%H%M%SZ")).is_dir())

    def test_no_deletion_without_verified_restore(self):
        for day in range(60):
            self.copy(day)
        with self.assertRaisesRegex(ValueError, "verified"):
            operations.prune(self.root, "fixture", self.now, apply=True)
        self.assertEqual(len(list(self.root.iterdir())), 60)

    def test_corrupted_copy_prevents_every_deletion(self):
        for day in range(60):
            file = self.copy(day, verified=day == 59)
        (file / "database.dump.age").write_bytes(b"altered")
        with self.assertRaisesRegex(ValueError, "truncated|integrity"):
            operations.prune(self.root, "fixture", self.now, apply=True)
        self.assertEqual(len(list(self.root.iterdir())), 60)

    def test_unknown_directory_and_symlink_are_never_removed(self):
        legacy = self.root / "20200101T000000Z"
        legacy.mkdir()
        outside = self.root / "outside"
        outside.mkdir()
        (self.root / "20200102T000000Z").symlink_to(outside, target_is_directory=True)
        for day in range(60):
            self.copy(day, verified=day == 1)
        operations.prune(self.root, "fixture", self.now, apply=True)
        self.assertTrue(legacy.is_dir())
        self.assertTrue(outside.is_dir())
        self.assertTrue((self.root / "20200102T000000Z").is_symlink())

    def test_wrong_project_receipt_blocks_deletion(self):
        self.copy(0, verified=True)
        with self.assertRaisesRegex(ValueError, "destination"):
            operations.prune(self.root, "another-project", self.now, apply=True)

    def test_mail_failure_does_not_mark_notification_as_sent(self):
        state = {}
        config = {"alerts": {"sender": "sender@example.invalid", "recipient": "owner@example.invalid", "api_key": "fixture-key"}}
        with patch.object(operations.urllib.request, "urlopen", side_effect=TimeoutError):
            with self.assertRaises(TimeoutError):
                operations.notify(config, state, "failure", self.now)
        self.assertEqual(state, {})

    def test_repeated_failure_is_deduplicated_without_network(self):
        state = {"notifications": {"failure": {"sent_at": self.now.isoformat()}}}
        with patch.object(operations.urllib.request, "urlopen", side_effect=AssertionError("Network forbidden")):
            self.assertFalse(operations.notify({}, state, "failure", self.now + dt.timedelta(hours=1)))


if __name__ == "__main__":
    unittest.main()
