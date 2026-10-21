#!/usr/bin/env python3
"""Encrypted Supabase database and Storage backup. Requires Python 3, Docker and age.

Run as the backup operator with a private JSON configuration. Never prints credentials
or row data. Plain database dumps and downloaded objects are streamed into age.
"""
import argparse
import datetime
import fcntl
import hashlib
import json
import os
import secrets
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import traceback
import urllib.parse
import urllib.request

IMAGE = "supabase/postgres@sha256:b3bfedb107413abb3b8cb0d0874b0414a1dceb3d55bc0c778de6ad22d1f7dc86"
SCHEMAS = ("public", "private", "auth", "storage", "supabase_migrations")


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":")).encode()


def private_file(path):
    path = Path(path)
    if path.stat().st_mode & 0o077:
        raise ValueError("A credential file is accessible by other users")
    return path


def encrypt(config, path, data):
    with path.open("xb") as output:
        subprocess.run([config["age"], "-R", config["recipient_file"]],
                       input=data, stdout=output, stderr=subprocess.PIPE, check=True)


def storage_login(config):
    credentials = config["storage_auth"]
    request = urllib.request.Request("https://" + config["project_ref"] + ".supabase.co/auth/v1/token?grant_type=password",
        data=canonical({"email": credentials["email"], "password": credentials["password"]}),
        headers={"apikey": credentials["publishable_key"], "Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)["access_token"]


def storage_logout(config, token):
    request = urllib.request.Request("https://" + config["project_ref"] + ".supabase.co/auth/v1/logout?scope=global",
        headers={"apikey": config["storage_auth"]["publishable_key"], "Authorization": "Bearer " + token}, method="POST")
    with urllib.request.urlopen(request, timeout=30):
        pass


def storage_request(config, bucket, name, token):
    """GET using the dedicated Auth session; RLS grants this identity SELECT only."""
    encoded = urllib.parse.quote(bucket, safe="") + "/" + urllib.parse.quote(name, safe="/~")
    return urllib.request.Request("https://" + config["project_ref"] + ".supabase.co/storage/v1/object/authenticated/" + encoded + "?backup_nonce=" + secrets.token_hex(16),
        headers={"apikey": config["storage_auth"]["publishable_key"], "Authorization": "Bearer " + token, "Cache-Control": "no-cache"}, method="GET")


def pg_command(config, envfile, binary, *args, interactive=False):
    cmd = ["docker", "run", "--rm", "--network=host", "--read-only", "--cap-drop=ALL",
           "--security-opt=no-new-privileges", "--pids-limit=64", "--memory=512m",
           "--cpus=0.5", "--user=postgres", "--env-file", str(envfile),
           "--mount", "type=bind,source=" + config["ca_bundle"] + ",target=/supabase-ca.crt,readonly",
           "--entrypoint", binary]
    if interactive:
        cmd.append("-i")
    return cmd + [IMAGE, *args]


def query(config, envfile, sql, snapshot=None):
    if snapshot:
        sql = "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SET TRANSACTION SNAPSHOT '" + snapshot + "';" + sql + ";ROLLBACK;"
    sql = "set search_path=pg_catalog;" + sql
    result = subprocess.run(pg_command(config, envfile, "psql", "-XqAt", "-v", "ON_ERROR_STOP=1", "-c", sql),
                            capture_output=True, check=True)
    return json.loads(result.stdout)


def inventory(config, envfile, snapshot=None):
    sql = """select jsonb_build_object(
      'server_version',current_setting('server_version'),
      'database',current_database(),
      'large_objects',(select count(*) from pg_largeobject_metadata),
      'extensions',(select jsonb_agg(jsonb_build_object('name',e.extname,'schema',n.nspname,'version',e.extversion) order by e.extname) from pg_extension e join pg_namespace n on n.oid=e.extnamespace),
      'roles',(select jsonb_agg(jsonb_build_object('name',rolname,'inherit',rolinherit,'bypassrls',rolbypassrls,'superuser',rolsuper,'config',rolconfig,'replication',rolreplication,'connection_limit',rolconnlimit) order by rolname) from pg_roles where rolname !~ '^pg_'),
      'memberships',(select jsonb_agg(jsonb_build_object('role',r.rolname,'member',m.rolname) order by r.rolname,m.rolname) from pg_auth_members a join pg_roles r on r.oid=a.roleid join pg_roles m on m.oid=a.member),
      'tables',(select jsonb_agg(jsonb_build_object('schema',schemaname,'table',tablename) order by schemaname,tablename) from pg_tables where schemaname in ('public','private','auth','storage','supabase_migrations')),
      'storage',(select coalesce(jsonb_agg(to_jsonb(o)-'last_accessed_at' order by o.bucket_id,o.name),'[]'::jsonb) from storage.objects o),
      'buckets',(select coalesce(jsonb_agg(to_jsonb(b) order by b.id),'[]'::jsonb) from storage.buckets b),
      'policies',(select jsonb_agg(to_jsonb(p) order by schemaname,tablename,policyname) from pg_policies p where schemaname in ('public','private','storage')),
      'migrations',(select jsonb_agg(to_jsonb(m) order by version) from supabase_migrations.schema_migrations m)
    );"""
    result = query(config, envfile, sql, snapshot)
    if result["large_objects"]:
        raise ValueError("Large objects require an explicit backup and recovery design")
    hashes = {}
    for table in result["tables"]:
        relation = ".".join('"' + table[k].replace('"', '""') + '"' for k in ("schema", "table"))
        hashes[table["schema"] + "." + table["table"]] = query(config, envfile,
            "select jsonb_build_object('count',count(*),'hash',md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),''))) from " + relation + " t", snapshot)
    result["table_hashes"] = hashes
    return result


def backup(config):
    os.umask(0o077)
    root = Path(config["destination"])
    root.mkdir(mode=0o700, parents=True, exist_ok=True)
    if shutil.disk_usage(root).free < 5 * 1024 ** 3:
        raise RuntimeError("Insufficient free disk space; preserve capacity for the application")
    with (root / ".backup.lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        partial = root / (stamp + ".partial")
        partial.mkdir(mode=0o700)
        runtime = tempfile.TemporaryDirectory(prefix="climagest-backup-", dir=config.get("runtime_directory", "/run"))
        holder = None
        storage_token = None
        try:
            envfile = Path(runtime.name) / "database.env"
            env = {**config["database"], "PGSSLMODE": "verify-full", "PGSSLROOTCERT": "/supabase-ca.crt"}
            if any("\n" in str(v) or "\r" in str(v) for v in env.values()):
                raise ValueError("Invalid database environment")
            envfile.write_text("".join(k + "=" + str(v) + "\n" for k, v in env.items()))
            envfile.chmod(0o600)
            holder = subprocess.Popen(pg_command(config, envfile, "psql", "-XqAt", "-v", "ON_ERROR_STOP=1", interactive=True),
                                      stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            holder.stdin.write(b"BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SELECT pg_export_snapshot();\n")
            holder.stdin.flush()
            snapshot = holder.stdout.readline().decode().strip()
            if not snapshot or any(c not in "0123456789ABCDEFabcdef-" for c in snapshot):
                detail = holder.stderr.readline().decode() if not snapshot else "invalid snapshot identifier"
                raise RuntimeError("Cannot establish a consistent database snapshot: " + detail)
            before = inventory(config, envfile, snapshot)
            dump_file = partial / "database.dump.age"
            with dump_file.open("xb") as output:
                dump = subprocess.Popen(pg_command(config, envfile, "pg_dump", "--format=custom", "--snapshot=" + snapshot,
                                                   "--lock-wait-timeout=15s", "--no-large-objects"),
                                        stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                age = subprocess.Popen([config["age"], "-R", config["recipient_file"]], stdin=dump.stdout, stdout=output, stderr=subprocess.PIPE)
                dump.stdout.close()
                dump.stdout = None
                _, age_error = age.communicate(timeout=600)
                _, dump_error = dump.communicate(timeout=30)
                if dump.returncode or age.returncode:
                    raise RuntimeError("Database export or encryption failed: " + dump_error.decode() + age_error.decode())
            holder.stdin.write(b"ROLLBACK;\n\\q\n")
            holder.stdin.flush()
            holder.communicate(timeout=30)
            holder = None
            objects = []
            storage_token = storage_login(config)
            for index, obj in enumerate(before["storage"]):
                bucket, name = obj["bucket_id"], obj["name"]
                request = storage_request(config, bucket, name, storage_token)
                file = "object-" + str(index).zfill(6) + ".age"
                digest = hashlib.sha256()
                size = 0
                with urllib.request.urlopen(request, timeout=60) as response, (partial / file).open("xb") as output:
                    metadata = obj.get("metadata") or {}
                    expected_etag = metadata.get("eTag", metadata.get("etag"))
                    actual_etag = response.headers.get("ETag")
                    if expected_etag and (not actual_etag or str(expected_etag).strip('"') != actual_etag.strip('"')):
                        raise ValueError("Storage object ETag does not match the database snapshot")
                    process = subprocess.Popen([config["age"], "-R", config["recipient_file"]], stdin=subprocess.PIPE, stdout=output, stderr=subprocess.PIPE)
                    try:
                        while chunk := response.read(1024 * 1024):
                            process.stdin.write(chunk)
                            digest.update(chunk)
                            size += len(chunk)
                        process.stdin.close()
                        process.stdin = None
                        process.communicate(timeout=60)
                        if process.returncode:
                            raise RuntimeError("Storage encryption failed")
                    except BaseException:
                        process.kill()
                        process.wait()
                        raise
                expected_size = obj.get("metadata", {}).get("size")
                if expected_size is not None and size != int(expected_size):
                    raise ValueError("Storage object size changed during backup")
                objects.append({"bucket": bucket, "name": name, "file": file, "sha256": digest.hexdigest(), "size": size})
            current = query(config, envfile, "select jsonb_build_object('storage',(select coalesce(jsonb_agg(to_jsonb(o)-'last_accessed_at' order by o.bucket_id,o.name),'[]'::jsonb) from storage.objects o),'buckets',(select coalesce(jsonb_agg(to_jsonb(b) order by b.id),'[]'::jsonb) from storage.buckets b));")
            if current["storage"] != before["storage"] or current["buckets"] != before["buckets"]:
                raise RuntimeError("Storage changed during backup; rerun for a consistent copy")
            encrypt(config, partial / "inventory.json.age", canonical(before))
            if config.get("configuration_archive"):
                encrypt(config, partial / "configuration.tar.age", private_file(config["configuration_archive"]).read_bytes())
            if config.get("platform_configuration_archive"):
                shutil.copyfile(private_file(config["platform_configuration_archive"]), partial / "platform-configuration.json.age")
            encrypt(config, partial / "operator-configuration.json.age", canonical(config))
            files = [{"file": p.name, "sha256": hashlib.sha256(p.read_bytes()).hexdigest(), "bytes": p.stat().st_size} for p in sorted(partial.iterdir())]
            manifest = {"format": 1, "project_ref": config["project_ref"], "created_at": stamp, "database_image": IMAGE,
                        "objects": objects, "files": files, "scope": "PostgreSQL logical archive and Storage object bytes; platform configuration and Edge secrets require separate custody"}
            encrypt(config, partial / "manifest.json.age", canonical(manifest))
            # This public receipt permits integrity checks without the decryption key.
            # Retention only manages directories with a valid receipt of this format.
            receipt = {"format": 1, "project_ref": config["project_ref"], "created_at": stamp,
                       "files": [{"file": p.name, "sha256": hashlib.sha256(p.read_bytes()).hexdigest(),
                                  "bytes": p.stat().st_size} for p in sorted(partial.iterdir())]}
            (partial / "completed.json").write_bytes(canonical(receipt))
            destination = root / stamp
            partial.rename(destination)
            print(json.dumps({"status": "encrypted_backup_created", "directory": str(destination), "objects": len(objects), "tables": len(before["table_hashes"])}))
        except BaseException:
            # A partial encrypted export is not advertised as a usable backup.
            shutil.rmtree(partial)
            raise
        finally:
            if holder is not None:
                holder.kill()
                holder.communicate()
            if storage_token:
                try:
                    storage_logout(config, storage_token)
                except Exception:
                    print("Warning: the short-lived Storage backup session could not be revoked.", file=sys.stderr)
            runtime.cleanup()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", required=True)
    args = parser.parse_args()
    try:
        backup(json.loads(private_file(args.config).read_text()))
    except Exception as error:
        diagnostic = Path("/run/climagest-backup-error.log")
        if diagnostic.parent.exists():
            diagnostic.write_text(traceback.format_exc())
            diagnostic.chmod(0o600)
        # Do not interpolate exceptions: URLs, credentials or row values may be included.
        print("Backup failed (" + type(error).__name__ + "); no complete backup was published.", file=sys.stderr)
        sys.exit(1)
