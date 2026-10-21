#!/usr/bin/env python3
"""Restore a local encrypted backup into a disposable, network-isolated VPS container.

The recovery key stays on this computer. Plaintext is streamed over pinned SSH;
Postgres data lives in container tmpfs and is removed when the test completes.
"""
import argparse
import hashlib
import json
import io
import re
from pathlib import Path
import shlex
import subprocess
import time
import tarfile
import uuid

from supabase_backup import IMAGE, SCHEMAS, private_file


def role_settings_sql(role):
    name = '"' + role["name"].replace('"', '""') + '"'
    literal = lambda value: "'" + value.replace("'", "''") + "'"
    result = []
    for raw in role.get("config") or []:
        setting, value = raw.split("=", 1)
        if re.fullmatch(r"search_path|(statement|lock|idle_in_transaction_session)_timeout|default_transaction_read_only|pgrst\.db_(schemas|extra_search_path|max_rows|pre_request)", setting):
            result.append("begin read write; select pg_catalog.set_config(" + literal(setting) + "," + literal(value) + ",false); alter role " + name + " set \"" + setting + "\" from current; commit;")
    return result


def verify(args):
    directory = Path(args.backup).resolve()
    recovery_key = private_file(args.recovery_key).resolve()
    ssh = ["ssh", "-i", args.identity, "-o", "IdentitiesOnly=yes", "-o", "BatchMode=yes",
           "-o", "StrictHostKeyChecking=yes", "-o", "UserKnownHostsFile=" + json.dumps(str(Path(args.known_hosts).resolve())),
           "-o", "ConnectTimeout=15", args.ssh_host]

    def remote(command, data=None, check=True):
        return subprocess.run(ssh + [shlex.join(command)], input=data, capture_output=True, check=check)

    def decrypt(file):
        return subprocess.run([args.age, "-d", "-i", str(recovery_key), str(directory / file)], capture_output=True, check=True).stdout

    manifest = json.loads(decrypt("manifest.json.age"))
    if manifest["format"] != 1 or manifest["database_image"] != IMAGE:
        raise ValueError("Unknown backup format or database image")
    for entry in manifest["files"]:
        file = directory / entry["file"]
        if file.parent != directory or file.stat().st_size != entry["bytes"]:
            raise ValueError("Missing or invalid encrypted backup file")
        if hashlib.sha256(file.read_bytes()).hexdigest() != entry["sha256"]:
            raise ValueError("Encrypted backup integrity check failed")
    for entry in manifest["objects"]:
        content = decrypt(entry["file"])
        if len(content) != entry["size"] or hashlib.sha256(content).hexdigest() != entry["sha256"]:
            raise ValueError("Storage recovery integrity check failed")
    inventory = json.loads(decrypt("inventory.json.age"))
    names = {entry["file"] for entry in manifest["files"]}
    platform_configuration = "platform-configuration.json.age" in names
    if platform_configuration:
        platform = json.loads(decrypt("platform-configuration.json.age"))
        if platform["project_ref"] != manifest["project_ref"]:
            raise ValueError("Platform configuration belongs to another project")
    operator_configuration = "operator-configuration.json.age" in names
    if operator_configuration and json.loads(decrypt("operator-configuration.json.age"))["project_ref"] != manifest["project_ref"]:
        raise ValueError("Operator configuration belongs to another project")
    if "configuration.tar.age" in names:
        with tarfile.open(fileobj=io.BytesIO(decrypt("configuration.tar.age"))) as archive:
            for member in archive.getmembers():
                if Path(member.name).is_absolute() or ".." in Path(member.name).parts:
                    raise ValueError("Unsafe path in configuration archive")
    container = "climagest-restore-" + uuid.uuid4().hex[:12]
    started = time.monotonic()
    stack = None

    def psql(sql):
        sql = "set search_path=pg_catalog;\n" + sql
        result = remote(["docker", "exec", "-i", container, "psql", "-h", "/tmp", "-U", "postgres", "-d", "postgres", "-XqAt", "-v", "ON_ERROR_STOP=1"], sql.encode(), check=False)
        if result.returncode:
            error = Path(args.report + ".sql-error.txt")
            error.write_bytes(result.stderr)
            error.chmod(0o600)
            raise RuntimeError("Recovery SQL failed; see the private SQL error report")
        return result.stdout

    try:
        if getattr(args, "full_stack", False):
            from recovery_stack import RecoveryStack
            if not args.stack_control:
                raise ValueError("A private stack control path is required")
            stack = RecoveryStack(remote, psql, decrypt, manifest, container, ssh, args.stack_control)
            stack.prepare()
        remote(["docker", "run", "-d", "--name", container, "--label", "climagest.disposable-restore=true",
                "--network=" + (stack.network if stack else "none"), *(["--network-alias=db"] if stack else []), "--read-only", "--user=100:101", "--cap-drop=ALL",
                "--security-opt=no-new-privileges", "--pids-limit=128", "--memory=1536m", "--cpus=1",
                "--tmpfs", "/tmp:rw,size=1073741824,uid=100,gid=101,mode=0700",
                "--entrypoint", "/bin/sh", IMAGE, "-c",
                "initdb -D /tmp/pg -U postgres --auth-local=trust --auth-host=reject --encoding=UTF8 --locale=C >/tmp/init.log 2>&1 && exec postgres -D /tmp/pg -c listen_addresses='*' -c unix_socket_directories=/tmp -c max_connections=60 -c shared_buffers=64MB -c wal_level=logical"])
        for _ in range(30):
            if remote(["docker", "exec", container, "pg_isready", "-h", "/tmp", "-U", "postgres"], check=False).returncode == 0:
                break
            time.sleep(1)
        else:
            raise RuntimeError("Isolated database did not become ready")
        for role in inventory["roles"]:
            if role["name"] == "postgres":
                continue
            name = '"' + role["name"].replace('"', '""') + '"'
            psql("create role " + name + " nologin " + ("superuser " if role["superuser"] else "nosuperuser ") + ("inherit" if role["inherit"] else "noinherit") + (" bypassrls" if role["bypassrls"] else " nobypassrls") + ";")
            for statement in role_settings_sql(role):
                psql(statement)
        for membership in inventory["memberships"] or []:
            names = ['"' + membership[k].replace('"', '""') + '"' for k in ("role", "member")]
            psql("grant " + names[0] + " to " + names[1] + ";")
        # Stage only in the container's tmpfs. Check the transferred archive before
        # pg_restore, so a truncated stdin transport cannot masquerade as SQL damage.
        process = subprocess.Popen([args.age, "-d", "-i", str(recovery_key), str(directory / "database.dump.age")], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        transfer = subprocess.Popen(ssh + [shlex.join(["docker", "exec", "-i", container, "sh", "-c", "umask 077; cat > /tmp/recovery.dump"])],
                                    stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        archive_hash = hashlib.sha256()
        archive_bytes = 0
        try:
            while chunk := process.stdout.read(1024 * 1024):
                transfer.stdin.write(chunk)
                archive_hash.update(chunk)
                archive_bytes += len(chunk)
            transfer.stdin.close()
            transfer.stdin = None
            _, transfer_errors = transfer.communicate(timeout=60)
            process.stdout.close()
            process.stdout = None
            _, age_errors = process.communicate(timeout=30)
        except BaseException:
            transfer.kill()
            process.kill()
            transfer.wait()
            process.wait()
            raise
        if transfer.returncode or process.returncode or archive_bytes < 5:
            Path(args.report + ".error.txt").write_bytes(transfer_errors + age_errors)
            Path(args.report + ".error.txt").chmod(0o600)
            raise RuntimeError("Archive transfer failed; see private error report")
        actual = remote(["docker", "exec", container, "sha256sum", "/tmp/recovery.dump"]).stdout.decode().split()[0]
        if actual != archive_hash.hexdigest():
            raise ValueError("Transferred database archive failed its integrity check")
        restore = remote(["docker", "exec", container, "pg_restore", "-h", "/tmp", "-U", "postgres", "-d", "postgres", "--exit-on-error", "/tmp/recovery.dump"], check=False)
        remote(["docker", "exec", container, "rm", "/tmp/recovery.dump"], check=False)
        if restore.returncode:
            # SQL errors contain schema details; retain privately for diagnosis.
            Path(args.report + ".error.txt").write_bytes(restore.stderr)
            Path(args.report + ".error.txt").chmod(0o600)
            raise RuntimeError("Isolated restore failed; see private error report")
        for relation, expected in inventory["table_hashes"].items():
            schema, table = relation.split(".", 1)
            qualified = ".".join('"' + s.replace('"', '""') + '"' for s in (schema, table))
            sql = "select jsonb_build_object('count',count(*),'hash',md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),''))) from " + qualified + " t;"
            actual = json.loads(psql(sql))
            if actual != expected:
                raise ValueError("Restored table does not match its snapshot: " + relation)
        policies = json.loads(psql("select jsonb_agg(to_jsonb(p) order by schemaname,tablename,policyname) from pg_policies p where schemaname in ('public','private','storage');"))
        if policies != inventory["policies"]:
            raise ValueError("Restored RLS policies differ")
        psql(Path(args.permission_suite).read_text())
        report = {"status": "passed", "backup": directory.name, "project_ref": manifest["project_ref"],
                  "tables_verified": len(inventory["table_hashes"]), "storage_objects_verified": len(manifest["objects"]),
                  "rls_policies_verified": len(policies), "permission_suite": "passed",
                  "network": "none", "published_ports": 0, "database_storage": "tmpfs",
                  "recovery_key_location": "local only", "seconds": round(time.monotonic() - started)}
        report["platform_configuration_verified"] = platform_configuration
        report["operator_configuration_verified"] = operator_configuration
        if stack:
            report["services"] = stack.start()
            report["frontend"] = stack.hold()
            report["network"] = "internal Docker network; local access over pinned SSH"
        report["seconds"] = round(time.monotonic() - started)
        Path(args.report).write_text(json.dumps(report, indent=2) + "\n")
        Path(args.report).chmod(0o600)
        Path(args.report + ".error.txt").unlink(missing_ok=True)
        print(json.dumps(report))
    finally:
        if stack:
            stack.close()
        # Remove only the uniquely named container created by this invocation.
        remote(["docker", "rm", "-f", container], check=False)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    for arg in ("backup", "recovery-key", "age", "identity", "known-hosts", "ssh-host", "report", "permission-suite"):
        parser.add_argument("--" + arg, required=True)
    parser.add_argument("--full-stack", action="store_true")
    parser.add_argument("--stack-control")
    verify(parser.parse_args())
