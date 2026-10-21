#!/usr/bin/env python3
"""Conservative retention and private, deduplicated operational notifications."""
import argparse
import datetime as dt
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import sys
import traceback
import urllib.request

from supabase_backup import canonical, private_file

UTC = dt.timezone.utc
STAMP = re.compile(r"\d{8}T\d{6}Z")


def completed_backups(root, project_ref, now, only=None):
    if root.is_symlink() or not root.is_dir():
        raise ValueError("Backup root must be a real directory")
    result = []
    for directory in ([root / only] if only else sorted(root.iterdir())):
        if not STAMP.fullmatch(directory.name) or directory.is_symlink() or not directory.is_dir():
            continue
        receipt_file = directory / "completed.json"
        # Legacy/unknown directories are never deleted automatically.
        if not receipt_file.exists():
            continue
        if receipt_file.is_symlink():
            raise ValueError("A backup receipt is a symbolic link")
        receipt = json.loads(receipt_file.read_text())
        created = dt.datetime.strptime(directory.name, "%Y%m%dT%H%M%SZ").replace(tzinfo=UTC)
        if receipt.get("format") != 1 or receipt.get("project_ref") != project_ref or receipt.get("created_at") != directory.name:
            raise ValueError("Backup receipt does not match its destination")
        if created > now + dt.timedelta(minutes=5):
            raise ValueError("Backup timestamp is in the future")
        names = set()
        for entry in receipt["files"]:
            name = entry["file"]
            if Path(name).name != name or not name.endswith(".age") or name in names:
                raise ValueError("Invalid encrypted file name")
            names.add(name)
            file = directory / name
            if file.is_symlink() or not file.is_file() or file.stat().st_size != entry["bytes"]:
                raise ValueError("Backup ciphertext is missing or truncated")
            if hashlib.sha256(file.read_bytes()).hexdigest() != entry["sha256"]:
                raise ValueError("Backup ciphertext failed its integrity check")
        if not {"database.dump.age", "manifest.json.age", "inventory.json.age"} <= names:
            raise ValueError("Backup receipt is incomplete")
        if any(p.is_symlink() or p.is_dir() or p.name not in names | {"completed.json", "restore-verification.json"} for p in directory.iterdir()):
            raise ValueError("Unexpected contents in a managed backup")
        verified = False
        report = directory / "restore-verification.json"
        if report.exists():
            proof = json.loads(report.read_text())
            verified = proof.get("status") == "passed" and proof.get("project_ref") == project_ref and proof.get("backup") == directory.name
        result.append({"path": directory, "created": created, "verified": verified})
    return result


def retention_plan(backups, now):
    verified = [b for b in backups if b["verified"]]
    if len(backups) < 3 or not verified:
        raise ValueError("Retention requires three complete copies and a verified restoration")
    keep = {b["path"] for b in backups[-3:]}
    keep.add(verified[-1]["path"])
    keep.update(b["path"] for b in backups if now - b["created"] < dt.timedelta(days=7))
    # Calendar buckets, selecting the newest copy in each bucket.
    buckets = {"daily": {}, "weekly": {}, "monthly": {}}
    for backup in backups:
        date = backup["created"].date()
        buckets["daily"][date] = backup
        buckets["weekly"][date.isocalendar()[:2]] = backup
        buckets["monthly"][(date.year, date.month)] = backup
    for kind, count in (("daily", 30), ("weekly", 8), ("monthly", 12)):
        keep.update(b["path"] for b in list(buckets[kind].values())[-count:])
    return [b["path"] for b in backups if b["path"] not in keep]


def prune(root, project_ref, now, apply=False):
    backups = completed_backups(root, project_ref, now)
    # Before enough history exists, simply retain everything.
    if len(backups) < 3:
        return {"retained": len(backups), "removed": [], "reason": "insufficient history"}
    plan = retention_plan(backups, now)
    if apply:
        for directory in plan:
            # Re-check the target immediately before deleting it. The complete set
            # was checked before planning; avoid rereading every archive per deletion.
            completed_backups(root, project_ref, now, only=directory.name)
            shutil.rmtree(directory)
    return {"retained": len(backups) - len(plan), "removed": [p.name for p in plan], "applied": apply}


def notify(config, state, event, now):
    messages = {
        "test": ("Avisos de backup activados", "Este mensaje comprueba el canal de avisos de ClimaGest. No comunica un fallo real."),
        "failure": ("Fallo del backup", "El operador de backup requiere atención. Revisa los servicios climagest-backup y climagest-backup-health en Hostinger y comprueba la última copia completa."),
        "stale": ("Backup sin copia reciente", "No se encuentra una copia completa de las últimas 36 horas. Revisa el temporizador y el servicio en Hostinger."),
        "recovered": ("Backup recuperado", "Se ha creado y comprobado una nueva copia cifrada después de una incidencia."),
    }
    if event not in messages:
        raise ValueError("Unknown notification event")
    previous = state.get("notifications", {}).get(event)
    if previous and now - dt.datetime.fromisoformat(previous["sent_at"]) < dt.timedelta(hours=24):
        return False
    alert = config["alerts"]
    subject, body = messages[event]
    request = urllib.request.Request("https://api.resend.com/emails", method="POST",
        data=canonical({"from": alert["sender"], "to": [alert["recipient"]],
                        "subject": "[ClimaGest] " + subject,
                        "text": body + "\n\nFecha UTC: " + now.date().isoformat() + "\nNo respondas con contraseñas ni adjuntes copias de datos."}),
        headers={"Authorization": "Bearer " + alert["api_key"], "Content-Type": "application/json",
                 "User-Agent": "ClimaGest-Backup-Operations", "Idempotency-Key": "climagest-" + event + "-" + now.strftime("%Y%m%d")})
    with urllib.request.urlopen(request, timeout=30) as response:
        acknowledgement = json.load(response)
    if not acknowledgement.get("id"):
        raise RuntimeError("Mail provider did not acknowledge the notification")
    state.setdefault("notifications", {})[event] = {"sent_at": now.isoformat(), "message_id": acknowledgement["id"]}
    if event != "test":
        state["incident"] = event != "recovered"
    return True


def operate(config, event, apply_retention=False):
    root = Path(config["destination"])
    now = dt.datetime.now(UTC)
    state_file = root / "operations-state.json"
    with (root / ".operations.lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        state = json.loads(state_file.read_text()) if state_file.exists() else {}
        output = {"event": event}
        if event == "after-success":
            output["retention"] = prune(root, config["project_ref"], now, apply=apply_retention)
            state["last_success"] = now.isoformat()
            if state.get("incident"):
                output["mail_sent"] = notify(config, state, "recovered", now)
        elif event == "health":
            copies = completed_backups(root, config["project_ref"], now)
            if not copies or now - copies[-1]["created"] > dt.timedelta(hours=36):
                output["mail_sent"] = notify(config, state, "stale", now)
        else:
            output["mail_sent"] = notify(config, state, event, now)
        temporary = state_file.with_suffix(".tmp")
        temporary.write_bytes(canonical(state))
        temporary.chmod(0o600)
        temporary.replace(state_file)
        print(json.dumps(output))


if __name__ == "__main__":
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", required=True)
    parser.add_argument("--event", choices=("after-success", "health", "failure", "test"), required=True)
    parser.add_argument("--apply-retention", action="store_true")
    args = parser.parse_args()
    try:
        operate(json.loads(private_file(args.config).read_text()), args.event, args.apply_retention)
    except Exception as error:
        log = Path("/run/climagest-operations-error.log")
        log.write_text(traceback.format_exc())
        log.chmod(0o600)
        print("Backup operations failed (" + type(error).__name__ + "). See private operator log.", file=sys.stderr)
        sys.exit(1)
