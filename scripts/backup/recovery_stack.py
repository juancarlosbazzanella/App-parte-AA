#!/usr/bin/env python3
"""Disposable app-service recovery, reachable only through pinned SSH on loopback.

Images and gateway assets are pinned in recovery-sources.json. All service secrets
are newly generated. No production SMTP settings or signing keys are reused.
"""
import base64
from contextlib import contextmanager
import datetime
import hashlib
import hmac
import io
import json
import mimetypes
from pathlib import Path
import re
import secrets
import shlex
import socketserver
import subprocess
import tarfile
import threading
import time
import urllib.error
import urllib.parse
import urllib.request

from supabase_backup import canonical


def jwt(secret, role):
    encode = lambda value: base64.urlsafe_b64encode(value).rstrip(b"=")
    now = int(time.time())
    body = encode(canonical({"alg": "HS256", "typ": "JWT"})) + b"." + encode(canonical({"role": role, "iss": "supabase", "iat": now, "exp": now + 7200}))
    return (body + b"." + encode(hmac.new(secret.encode(), body, hashlib.sha256).digest())).decode()


class RecoveryStack:
    def __init__(self, remote, psql, decrypt, manifest, container, ssh, control):
        if not re.fullmatch(r"climagest-restore-[0-9a-f]{12}", container):
            raise ValueError("Recovery resources must have an owned random name")
        self.remote, self.psql, self.decrypt = remote, psql, decrypt
        self.manifest, self.container, self.ssh = manifest, container, ssh
        self.network = container + "-net"
        self.directory = "/run/" + container
        self.control = Path(control).resolve()
        self.control.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        if any(self.control.with_suffix(suffix).exists() for suffix in (".ready.json", ".stop.json")):
            raise ValueError("Remove private control files from the previous recovery before starting")
        self.children = []
        self.bridge = None
        self.sources = json.loads(Path(__file__).with_name("recovery-sources.json").read_text())
        self.secret = secrets.token_urlsafe(48)
        self.password = secrets.token_urlsafe(36)
        self.anon, self.service = jwt(self.secret, "anon"), jwt(self.secret, "service_role")
        self.publishable = "sb_publishable_" + secrets.token_urlsafe(24)
        self.url = "http://127.0.0.1:54399"
        self.origin = "http://127.0.0.1:5174"

    def prepare(self):
        for digest in self.sources["images"].values():
            if not re.fullmatch(r"[a-z0-9/.-]+@sha256:[0-9a-f]{64}", digest):
                raise ValueError("An image is not pinned")
            self.remote(["docker", "image", "inspect", digest])
        self.remote(["docker", "network", "create", "--internal", "--label", "climagest.disposable-restore=true", self.network])
        network = json.loads(self.remote(["docker", "network", "inspect", self.network]).stdout)[0]
        if not network["Internal"]:
            raise ValueError("Recovery network must prohibit outbound connections")
        self.remote(["mkdir", "-m", "700", self.directory])

    def upload(self, files):
        archive = io.BytesIO()
        with tarfile.open(fileobj=archive, mode="w") as tar:
            for name, content in files.items():
                if Path(name).is_absolute() or ".." in Path(name).parts:
                    raise ValueError("Invalid recovery asset path")
                info = tarfile.TarInfo(name)
                info.size, info.mode = len(content), 0o644
                tar.addfile(info, io.BytesIO(content))
        self.remote(["tar", "-x", "-C", self.directory], archive.getvalue())

    def start_service(self, service, image, env, args=(), mounts=(), memory="256m", extra=()):
        name = self.container + "-" + service
        # Environment files are private on /run; only drill credentials are used.
        data = "".join(k + "=" + str(v) + "\n" for k, v in env.items())
        if any("\n" in str(v) or "\r" in str(v) for v in env.values()):
            raise ValueError("Invalid recovery environment")
        self.remote(["sh", "-c", "umask 077; cat > " + shlex.quote(self.directory + "/" + service + ".env")], data.encode())
        command = ["docker", "run", "-d", "--name", name, "--label", "climagest.disposable-restore=true",
                   "--network", self.network, "--network-alias", service, "--read-only", "--cap-drop=ALL",
                   "--security-opt=no-new-privileges", "--pids-limit=192", "--memory=" + memory,
                   "--cpus=0.5", "--tmpfs", "/tmp:rw,size=67108864", "--env-file", self.directory + "/" + service + ".env"]
        for source, target in mounts:
            command += ["--mount", "type=bind,source=" + self.directory + "/" + source + ",target=" + target + ",readonly"]
        command += list(extra) + [self.sources["images"][image], *args]
        self.remote(command)
        self.children.append(name)

    def start_bridge(self):
        address = json.loads(self.remote(["docker", "inspect", self.container + "-api-gw"]).stdout)[0]["NetworkSettings"]["Networks"][self.network]["IPAddress"]
        # Stdio forwarding uses the already-authorized command channel. The SSH
        # credential keeps its forwarding restrictions; no server port is opened.
        bridge_code = """import os,select,socket,sys
s=socket.create_connection((%r,8000),10)
while True:
 readable,_,_=select.select([s,sys.stdin.buffer],[],[],60)
 if not readable: break
 for source in readable:
  data=s.recv(65536) if source is s else os.read(0,65536)
  if not data: sys.exit(0)
  if source is s: sys.stdout.buffer.write(data); sys.stdout.buffer.flush()
  else: s.sendall(data)
""" % address
        ssh = self.ssh
        class Handler(socketserver.BaseRequestHandler):
            def handle(self):
                process = subprocess.Popen(ssh + [shlex.join(["python3", "-u", "-c", bridge_code])], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
                def upstream():
                    try:
                        while chunk := self.request.recv(65536):
                            process.stdin.write(chunk)
                            process.stdin.flush()
                    except (OSError, ValueError):
                        pass
                    finally:
                        process.terminate()
                threading.Thread(target=upstream, daemon=True).start()
                try:
                    while chunk := process.stdout.read1(65536):
                        self.request.sendall(chunk)
                except OSError:
                    pass
                finally:
                    process.terminate()
                    process.wait(timeout=10)
        class Server(socketserver.ThreadingTCPServer):
            daemon_threads = True
            allow_reuse_address = True
        self.bridge = Server(("127.0.0.1", 54399), Handler)
        threading.Thread(target=self.bridge.serve_forever, daemon=True).start()

    def request(self, path, method="GET", data=None, token=None, headers=None, raw=False):
        options = {"apikey": self.publishable, **(headers or {})}
        if token:
            options["Authorization"] = "Bearer " + token
        if data is not None and not isinstance(data, bytes):
            data = canonical(data)
            options["Content-Type"] = "application/json"
        request = urllib.request.Request(self.url + path, method=method, data=data, headers=options)
        with urllib.request.urlopen(request, timeout=20) as response:
            result = response.read()
        return result if raw or not result else json.loads(result)

    def mail(self, path):
        address = json.loads(self.remote(["docker", "inspect", self.container + "-mailpit"]).stdout)[0]["NetworkSettings"]["Networks"][self.network]["IPAddress"]
        code = "import urllib.request,sys; sys.stdout.buffer.write(urllib.request.urlopen(%r,timeout=10).read())" % ("http://" + address + ":8025" + path)
        return json.loads(self.remote(["python3", "-c", code]).stdout)

    @contextmanager
    def legacy_storage_import(self, inventory):
        """Import verified historic formats only in this disposable database."""
        quote = lambda value: "'" + value.replace("'", "''") + "'"
        changed = []
        try:
            for bucket in inventory["buckets"]:
                original = bucket.get("allowed_mime_types")
                if original is None:
                    continue
                needed = {row.get("metadata", {}).get("mimetype") or mimetypes.guess_type(row["name"])[0] or "application/octet-stream"
                          for row in inventory["storage"] if row["bucket_id"] == bucket["id"]}
                missing = sorted(needed.difference(original))
                if missing:
                    changed.append((bucket["id"], original))
                    values = quote(json.dumps(original + missing))
                    self.psql("update storage.buckets set allowed_mime_types=array(select jsonb_array_elements_text(" + values + "::jsonb)) where id=" + quote(bucket["id"]) + ";")
            yield len(changed)
        finally:
            for bucket_id, original in reversed(changed):
                values = quote(json.dumps(original))
                self.psql("update storage.buckets set allowed_mime_types=array(select jsonb_array_elements_text(" + values + "::jsonb)) where id=" + quote(bucket_id) + ";")
                actual = json.loads(self.psql("select to_json(allowed_mime_types) from storage.buckets where id=" + quote(bucket_id) + ";"))
                if actual != original:
                    raise ValueError("Recovered bucket MIME restrictions were not restored")

    def start(self):
        platform = json.loads(self.decrypt("platform-configuration.json.age"))
        source = next(f["content"] for f in platform["edge_function"]["files"] if f["name"].endswith("index.ts"))
        source_path = self.control.with_suffix(".function.ts")
        source_path.write_text(source)
        source_path.chmod(0o600)
        bundle_path = self.control.with_suffix(".function.js")
        subprocess.run(["corepack", "pnpm", "exec", "esbuild", str(source_path), "--bundle", "--platform=browser", "--format=esm", "--target=es2022", "--external:node:*", "--outfile=" + str(bundle_path)], capture_output=True, check=True)
        files = {"functions/main/index.ts": Path(__file__).with_name("recovery-edge-main.js").read_bytes(),
                 "functions/climagest-invite/index.ts": bundle_path.read_bytes()}
        variables = {"ANON_KEY": self.anon, "SERVICE_ROLE_KEY": self.service,
                     "ANON_KEY_ASYMMETRIC": self.anon, "SERVICE_ROLE_KEY_ASYMMETRIC": self.service,
                     "SUPABASE_PUBLISHABLE_KEY": self.publishable, "SUPABASE_SECRET_KEY": "sb_secret_" + secrets.token_urlsafe(24),
                     "SUPABASE_PUBLIC_URL": self.url, "DASHBOARD_BASIC_AUTH": "unused:{SHA}" + base64.b64encode(hashlib.sha1(secrets.token_bytes(32)).digest()).decode()}
        for asset in self.sources["files"]:
            if "/api/envoy/" not in asset["path"] or asset["path"].endswith("docker-entrypoint.sh"):
                continue
            with urllib.request.urlopen(asset["url"], timeout=30) as response:
                content = response.read()
            if hashlib.sha256(content).hexdigest() != asset["sha256"]:
                raise ValueError("Official gateway asset integrity check failed")
            name = Path(asset["path"]).name
            if name == "lds.template.yaml":
                text = content.decode()
                for key, value in variables.items():
                    text = text.replace("${" + key + "}", value)
                content, name = text.encode(), "lds.yaml"
            files["gateway/" + name] = content
        self.upload(files)
        for role in ("authenticator", "supabase_auth_admin", "supabase_storage_admin", "supabase_admin"):
            self.psql("alter role " + role + " login password '" + self.password + "';")
        self.psql("create schema if not exists _realtime authorization supabase_admin; delete from auth.sessions; delete from auth.refresh_tokens; update auth.users set banned_until='infinity';")
        hba = b"local all all trust\nhost all all 0.0.0.0/0 scram-sha-256\nhost replication supabase_admin 0.0.0.0/0 scram-sha-256\n"
        self.remote(["docker", "exec", "-i", self.container, "sh", "-c", "cat > /tmp/pg/pg_hba.conf"], hba)
        self.psql("select pg_reload_conf();")
        db = "postgres://{role}:" + self.password + "@db:5432/postgres"
        self.start_service("mailpit", "axllent/mailpit:v1.29.1", {"MP_MAX_MESSAGES": "20", "MP_DATABASE": "/tmp/mailpit.db"}, memory="64m")
        self.start_service("auth", "supabase/gotrue:v2.197.0", {
            "GOTRUE_API_HOST": "0.0.0.0", "GOTRUE_API_PORT": "9999", "API_EXTERNAL_URL": self.url,
            "GOTRUE_DB_DRIVER": "postgres", "GOTRUE_DB_DATABASE_URL": db.format(role="supabase_auth_admin"), "GOTRUE_DB_MAX_POOL_SIZE": "5",
            "GOTRUE_SITE_URL": self.origin, "GOTRUE_URI_ALLOW_LIST": self.origin + "/?auth=setup," + self.origin + "/?auth=reset",
            "GOTRUE_DISABLE_SIGNUP": "true", "GOTRUE_EXTERNAL_EMAIL_ENABLED": "true", "GOTRUE_EXTERNAL_ANONYMOUS_USERS_ENABLED": "false",
            "GOTRUE_JWT_SECRET": self.secret, "GOTRUE_JWT_EXP": "900", "GOTRUE_JWT_AUD": "authenticated", "GOTRUE_JWT_ADMIN_ROLES": "service_role", "GOTRUE_JWT_DEFAULT_GROUP_NAME": "authenticated",
            "GOTRUE_SMTP_HOST": "mailpit", "GOTRUE_SMTP_PORT": "1025", "GOTRUE_SMTP_ADMIN_EMAIL": "drill@recovery.invalid",
            "GOTRUE_SMTP_SENDER_NAME": "Recovery drill", "GOTRUE_SMTP_MAX_FREQUENCY": "1s", "GOTRUE_MAILER_AUTOCONFIRM": "false",
            "GOTRUE_MAILER_URLPATHS_INVITE": "/auth/v1/verify", "GOTRUE_MAILER_URLPATHS_CONFIRMATION": "/auth/v1/verify", "GOTRUE_MAILER_URLPATHS_RECOVERY": "/auth/v1/verify",
            "GOTRUE_PASSWORD_MIN_LENGTH": "15", "GOTRUE_MAILER_SECURE_EMAIL_CHANGE_ENABLED": "true"})
        self.start_service("rest", "postgrest/postgrest:v14.18", {
            "PGRST_DB_URI": db.format(role="authenticator"), "PGRST_DB_SCHEMAS": "public", "PGRST_DB_EXTRA_SEARCH_PATH": "public,extensions",
            "PGRST_DB_ANON_ROLE": "anon", "PGRST_JWT_SECRET": self.secret, "PGRST_DB_POOL": "5"}, memory="128m")
        self.start_service("storage", "supabase/storage-api:v1.81.0", {
            "ANON_KEY": self.anon, "SERVICE_KEY": self.service, "AUTH_JWT_SECRET": self.secret, "POSTGREST_URL": "http://rest:3000",
            "DATABASE_URL": db.format(role="supabase_storage_admin"), "DATABASE_POOL_SIZE": "5", "STORAGE_BACKEND": "file", "FILE_STORAGE_BACKEND_PATH": "/var/lib/storage",
            "GLOBAL_S3_BUCKET": "drill", "TENANT_ID": "drill", "REGION": "local", "ENABLE_IMAGE_TRANSFORMATION": "false", "FILE_SIZE_LIMIT": "52428800"},
            extra=("--tmpfs", "/var/lib/storage:rw,size=268435456,mode=1777"))
        self.start_service("realtime", "supabase/realtime:v2.143.3", {
            "PORT": "4000", "DB_HOST": "db", "DB_PORT": "5432", "DB_USER": "supabase_admin", "DB_PASSWORD": self.password,
            "DB_NAME": "postgres", "DB_AFTER_CONNECT_QUERY": "SET search_path TO _realtime", "DB_ENC_KEY": secrets.token_hex(8), "DB_POOL_SIZE": "3",
            "API_JWT_SECRET": self.secret, "METRICS_JWT_SECRET": self.secret, "SECRET_KEY_BASE": secrets.token_hex(48), "RELEASE_COOKIE": secrets.token_hex(16),
            "DNS_NODES": "''", "APP_NAME": "realtime", "SEED_SELF_HOST": "true", "RUN_JANITOR": "true", "DISABLE_HEALTHCHECK_LOGGING": "true", "ERL_FLAGS": "+S 2:2 +A 2"}, memory="512m",
            extra=("--network-alias", "realtime-dev.supabase-realtime"))
        self.start_service("functions", "supabase/edge-runtime:v1.77.4", {
            "JWT_SECRET": self.secret, "SUPABASE_ANON_KEY": self.anon, "SUPABASE_SERVICE_ROLE_KEY": self.service,
            # An alias inside the isolated Docker network exercises the original
            # production branch without reaching the real cloud project.
            "SUPABASE_URL": "http://" + self.manifest["project_ref"] + ".supabase.co:8000", "CLIMAGEST_APP_ORIGIN": self.origin},
            args=("start", "--main-service", "/home/deno/functions/main"), mounts=(("functions", "/home/deno/functions"),), memory="384m")
        self.start_service("api-gw", "envoyproxy/envoy:v1.39.1", {},
            args=("-c", "/etc/envoy/envoy.yaml", "--concurrency", "2"), mounts=(("gateway", "/etc/envoy"),),
            extra=("--network-alias", self.manifest["project_ref"] + ".supabase.co", "--entrypoint", "envoy"))
        self.start_bridge()
        for _ in range(40):
            try:
                self.request("/auth/v1/health")
                break
            except (OSError, ValueError):
                time.sleep(1)
        else:
            raise RuntimeError("Recovered Auth service did not become healthy")
        report = self.exercise()
        inspect = json.loads(self.remote(["docker", "inspect", self.container, *self.children]).stdout)
        if any(item["HostConfig"]["PortBindings"] for item in inspect):
            raise ValueError("A recovery service published a host port")
        report.update(network_internal=True, published_ports=0, outbound_email="captured in isolated Mailpit", signing_keys="fresh drill keys", images=self.sources["images"])
        return report

    def exercise(self):
        users = {}
        organization = json.loads(self.psql("select to_jsonb(o) from public.organizations o limit 1;"))["id"]
        for role in ("admin", "technician"):
            email, password = "recovery-" + role + "@drill.climagest.invalid", "Aa9!" + secrets.token_urlsafe(30)
            user = self.request("/auth/v1/admin/users", "POST", {"email": email, "password": password, "email_confirm": True, "user_metadata": {"full_name": "Recovery " + role}}, self.service)
            self.psql("insert into public.profiles(id,full_name) values ('" + user["id"] + "','Recovery " + role + "') on conflict (id) do nothing;")
            self.psql("insert into public.organization_members(organization_id,user_id,role,is_active) values ('" + organization + "','" + user["id"] + "','" + role + "',true);")
            session = self.request("/auth/v1/token?grant_type=password", "POST", {"email": email, "password": password})
            if session["expires_in"] != 900:
                raise ValueError("Unexpected recovered session lifetime")
            users[role] = {"email": email, "password": password, "token": session["access_token"], "id": user["id"]}
        token = users["admin"]["token"]
        clients = self.request("/rest/v1/clients?select=id", token=token)
        orders = self.request("/rest/v1/work_orders?select=id", token=token)
        try:
            anonymous = self.request("/rest/v1/clients?select=id")
            if anonymous:
                raise ValueError("Anonymous access leaked restored data")
        except urllib.error.HTTPError as error:
            if error.code not in (401, 403):
                raise
        inventory = json.loads(self.decrypt("inventory.json.age"))
        with self.legacy_storage_import(inventory) as legacy_buckets:
            for obj in self.manifest["objects"]:
                path = urllib.parse.quote(obj["bucket"], safe="") + "/" + urllib.parse.quote(obj["name"], safe="/")
                data = self.decrypt(obj["file"])
                metadata = next(row.get("metadata", {}) for row in inventory["storage"] if row["bucket_id"] == obj["bucket"] and row["name"] == obj["name"])
                mime = metadata.get("mimetype") or mimetypes.guess_type(obj["name"])[0] or "application/octet-stream"
                self.request("/storage/v1/object/" + path, "POST", data, self.service, {"Content-Type": mime, "x-upsert": "true"})
                actual = self.request("/storage/v1/object/authenticated/" + path, token=token, raw=True)
                if hashlib.sha256(actual).hexdigest() != obj["sha256"]:
                    raise ValueError("Recovered Storage API returned different bytes")
        # The original deployed Edge source is used; its SMTP reaches only Mailpit.
        invitation = {"organizationId": organization, "email": "invited@drill.climagest.invalid", "name": "Recovery invitation", "role": "office"}
        self.request("/functions/v1/climagest-invite", "POST", invitation, token, {"Origin": self.origin})
        for _ in range(10):
            mail = self.mail("/api/v1/messages")
            if mail.get("messages"):
                break
            time.sleep(1)
        if not mail.get("messages"):
            raise ValueError("Recovered invitation was not captured by the isolated SMTP server")
        try:
            self.request("/functions/v1/climagest-invite", "POST", invitation, users["technician"]["token"], {"Origin": self.origin})
            raise ValueError("Technician was able to send an administrative invitation")
        except urllib.error.HTTPError as error:
            if error.code != 403:
                raise
        machine = json.loads(self.psql("select to_jsonb(m) from public.machines m join public.clients c on c.id=m.client_id where m.archived_at is null and c.archived_at is null limit 1;"))
        work_order = {"p_organization_id": organization, "p_client_id": machine["client_id"], "p_machine_id": machine["id"],
                      "p_technician_user_id": users["technician"]["id"], "p_scheduled_date": datetime.date.today().isoformat(),
                      "p_scheduled_time": None, "p_source": "urgent", "p_type": "breakdown", "p_request": "Simulacro de recuperación",
                      "p_work_done": None, "p_hours": None, "p_materials": None, "p_observations": None}
        # A new technician cannot access arbitrary restored machines. Assign an
        # office job through the original RPC before exercising their urgent job.
        assigned = self.request("/rest/v1/rpc/create_work_order", "POST", {**work_order, "p_source": "office"}, token)
        realtime = subprocess.run(["node", str(Path(__file__).with_name("recovery-realtime-check.mjs"))],
            input=canonical({"url": self.url, "publishableKey": self.publishable, "accessToken": users["technician"]["token"], "workOrder": work_order}),
            capture_output=True, timeout=70)
        if realtime.returncode:
            log = self.control.with_suffix(".realtime-error.txt")
            log.write_bytes(realtime.stderr)
            log.chmod(0o600)
            raise RuntimeError("Recovered Realtime check failed; see its private log")
        realtime_proof = json.loads(realtime.stdout)
        self.browser_users = users
        ready = {"url": self.url, "frontend_origin": self.origin, "publishable_key": self.publishable, "users": users}
        self.control.with_suffix(".ready.json").write_bytes(canonical(ready))
        self.control.with_suffix(".ready.json").chmod(0o600)
        return {"auth_roles_verified": list(users), "jwt_seconds": 900, "clients_read": len(clients), "work_orders_read": len(orders),
                "storage_objects_recovered_via_api": len(self.manifest["objects"]), "edge_invitation": "passed", "technician_invitation_denied": True,
                "legacy_import_buckets_restored": legacy_buckets,
                "office_assignment_verified": bool(assigned["id"]),
                "smtp_messages_captured": len(mail["messages"]), "realtime": realtime_proof}

    def hold(self):
        print(json.dumps({"status": "recovery_stack_ready", "private_state": str(self.control.with_suffix(".ready.json"))}), flush=True)
        stop = self.control.with_suffix(".stop.json")
        for _ in range(1200):
            if stop.exists():
                result = json.loads(stop.read_text())
                if not isinstance(result, dict) or result.get("status") != "passed":
                    raise ValueError("Recovery browser verification did not pass")
                return result
            time.sleep(1)
        raise TimeoutError("Recovery browser verification did not finish within twenty minutes")

    def close(self):
        if self.bridge:
            self.bridge.shutdown()
            self.bridge.server_close()
        for name in reversed(self.children):
            logs = self.remote(["docker", "logs", "--tail", "150", name], check=False)
            file = self.control.parent / (name + ".log")
            file.write_bytes(logs.stdout + logs.stderr)
            file.chmod(0o600)
            self.remote(["docker", "rm", "-f", name], check=False)
        self.remote(["docker", "rm", "-f", self.container], check=False)
        self.remote(["docker", "network", "rm", self.network], check=False)
        if self.directory.startswith("/run/climagest-restore-"):
            self.remote(["rm", "-rf", self.directory], check=False)
