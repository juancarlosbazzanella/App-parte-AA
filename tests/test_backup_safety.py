"""Failure gates that must run before any disposable database is started."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import urllib.parse
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts/backup"))
import supabase_backup as backup
import verify_restore
from recovery_stack import RecoveryStack


class BackupSafetyTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.directory = Path(self.temp.name)
        self.key = self.directory / "recovery.key"
        self.key.write_text("test fixture")
        self.key.chmod(0o600)
        self.args = argparse.Namespace(backup=str(self.directory), recovery_key=str(self.key), age="fixture-age",
                                       identity="unused", known_hosts="unused", ssh_host="unused",
                                       report=str(self.directory / "report.json"), permission_suite="unused")

    def tearDown(self):
        self.temp.cleanup()

    def reject_before_ssh(self, manifest, message):
        def run(command, **kwargs):
            self.assertEqual(command[0], "fixture-age", "No SSH/Docker operation is allowed for an invalid backup")
            self.assertTrue(command[-1].endswith("manifest.json.age"))
            return subprocess.CompletedProcess(command, 0, stdout=json.dumps(manifest).encode())
        with patch.object(verify_restore.subprocess, "run", side_effect=run):
            with self.assertRaisesRegex(ValueError, message):
                verify_restore.verify(self.args)

    def test_modified_ciphertext_cannot_start_restore(self):
        file = self.directory / "database.dump.age"
        original = b"encrypted snapshot"
        file.write_bytes(b"tampered snapshot!")
        self.reject_before_ssh({"format": 1, "database_image": backup.IMAGE,
                               "files": [{"file": file.name, "bytes": len(original), "sha256": hashlib.sha256(original).hexdigest()}]}, "integrity|invalid")

    def test_truncated_archive_cannot_start_restore(self):
        (self.directory / "database.dump.age").write_bytes(b"short")
        self.reject_before_ssh({"format": 1, "database_image": backup.IMAGE,
                               "files": [{"file": "database.dump.age", "bytes": 100, "sha256": "unused"}]}, "invalid")

    def test_manifest_cannot_read_outside_backup_directory(self):
        self.reject_before_ssh({"format": 1, "database_image": backup.IMAGE,
                               "files": [{"file": "../outside.age", "bytes": 0, "sha256": "unused"}]}, "invalid")

    def test_unknown_database_image_cannot_start_restore(self):
        self.reject_before_ssh({"format": 1, "database_image": "untrusted/image", "files": []}, "Unknown")

    def test_world_readable_credentials_are_rejected(self):
        self.key.chmod(0o644)
        with self.assertRaisesRegex(ValueError, "accessible"):
            backup.private_file(self.key)

    def test_role_search_path_is_restored_without_reusing_a_credential_variable(self):
        statements = verify_restore.role_settings_sql({"name": "supabase_auth_admin", "config": ["search_path=auth", "log_statement=all"]})
        self.assertEqual(len(statements), 1)
        self.assertIn("set_config('search_path','auth',false)", statements[0])
        self.assertIn('alter role "supabase_auth_admin" set "search_path" from current', statements[0])

    def test_role_read_only_default_keeps_restore_transaction_writable(self):
        sql = verify_restore.role_settings_sql({"name": "reader", "config": ["default_transaction_read_only=on"]})[0]
        self.assertTrue(sql.startswith("begin read write;"))
        self.assertTrue(sql.endswith("commit;"))

    def test_role_settings_never_restore_source_signing_secrets_or_preload_hooks(self):
        self.assertEqual(verify_restore.role_settings_sql({"name": "authenticator", "config": ["pgrst.jwt_secret=source-key", "session_preload_libraries=source-hook"]}), [])

    def test_legacy_storage_import_restores_restrictions_after_upload_failure(self):
        stack = object.__new__(RecoveryStack)
        queries = []
        original = ["image/png", "image/jpeg"]
        def psql(sql):
            queries.append(sql)
            return json.dumps(original) if sql.startswith("select") else ""
        stack.psql = psql
        inventory = {"buckets": [{"id": "signatures", "allowed_mime_types": original}],
                     "storage": [{"bucket_id": "signatures", "name": "old.svg", "metadata": {"mimetype": "image/svg+xml"}}]}
        with self.assertRaisesRegex(RuntimeError, "upload failed"):
            with stack.legacy_storage_import(inventory) as count:
                self.assertEqual(count, 1)
                self.assertIn("image/svg+xml", queries[-1])
                raise RuntimeError("upload failed")
        self.assertEqual(len(queries), 3)
        self.assertNotIn("image/svg+xml", queries[1])
        self.assertEqual(original, ["image/png", "image/jpeg"])

    def test_unrestricted_or_current_storage_formats_require_no_change(self):
        stack = object.__new__(RecoveryStack)
        def reject(sql):
            self.fail("Current bucket restrictions must remain untouched")
        stack.psql = reject
        inventory = {"buckets": [{"id": "files", "allowed_mime_types": None}, {"id": "photos", "allowed_mime_types": ["image/png"]}],
                     "storage": [{"bucket_id": "photos", "name": "photo.png", "metadata": {"mimetype": "image/png"}}]}
        with stack.legacy_storage_import(inventory) as count:
            self.assertEqual(count, 0)

    def test_previous_browser_result_cannot_complete_another_recovery(self):
        control = self.directory / "drill"
        control.with_suffix(".stop.json").write_text('{"status":"passed"}')
        with self.assertRaisesRegex(ValueError, "previous recovery"):
            RecoveryStack(None, None, None, {}, "climagest-restore-123456789abc", [], control)

    def test_failed_browser_result_cannot_be_reported_as_passed(self):
        stack = object.__new__(RecoveryStack)
        stack.control = self.directory / "drill"
        stack.control.with_suffix(".stop.json").write_text('{"status":"failed"}')
        with self.assertRaisesRegex(ValueError, "did not pass"):
            stack.hold()

    def test_storage_download_keeps_password_out_of_request(self):
        config = {"project_ref": "fixture", "storage_auth": {"email": "backup@example.invalid", "password": "fixture-secret", "publishable_key": "fixture-public"}}
        request = backup.storage_request(config, "private bucket", "folder/photo #1.png", "fixture-session")
        self.assertEqual(request.get_method(), "GET")
        parsed = urllib.parse.urlsplit(request.full_url)
        self.assertEqual(parsed.path, "/storage/v1/object/authenticated/private%20bucket/folder/photo%20%231.png")
        self.assertRegex(urllib.parse.parse_qs(parsed.query)["backup_nonce"][0], r"^[0-9a-f]{32}$")
        self.assertNotEqual(request.full_url, backup.storage_request(config, "private bucket", "folder/photo #1.png", "fixture-session").full_url)
        self.assertNotIn("fixture-secret", str(request.headers) + request.full_url)
        self.assertEqual(request.headers["Authorization"], "Bearer fixture-session")


if __name__ == "__main__":
    unittest.main()
