#!/usr/bin/env python3
"""Publica status SANITIZADO (sem IPs/URLs locais) para o Netlify via GitHub."""
from __future__ import annotations

import json
import os
import subprocess
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PRINTER = os.environ.get("PRINTER_HOST", "0.0.0.0")
MOON = os.environ.get("MOONRAKER_URL", f"http://{PRINTER}:7125").rstrip("/")
INTERVAL = int(os.environ.get("PUBLISH_INTERVAL", "90"))
PUSH = os.environ.get("PUBLISH_PUSH", "1") == "1"


def fetch_raw() -> dict:
    q = (
        "print_stats&display_status&virtual_sdcard"
        "&heater_bed&extruder&temperature_sensor%20chamber_temp"
    )
    url = f"{MOON}/printer/objects/query?{q}"
    with urllib.request.urlopen(url, timeout=5) as r:
        return json.loads(r.read().decode())["result"]["status"]


def to_public(st: dict | None, err: str | None = None) -> dict:
    """Payload seguro para internet — sem IPs, Fluidd, hosts ou nomes de arquivo."""
    if err or not st:
        return {
            "online": False,
            "printing": False,
            "state": "offline",
            "title": "Impressão 3D",
            "updated_at": time.time(),
        }
    ps = st.get("print_stats") or {}
    vs = st.get("virtual_sdcard") or {}
    ds = st.get("display_status") or {}
    bed = st.get("heater_bed") or {}
    ext = st.get("extruder") or {}
    state = (ps.get("state") or "unknown").lower()
    progress = vs.get("progress")
    if progress is None:
        progress = ds.get("progress") or 0
    try:
        progress = float(progress)
    except (TypeError, ValueError):
        progress = 0.0
    estimated = None
    try:
        estimated = (vs.get("cur_print_data") or {}).get("metadata", {}).get("estimated_time")
    except Exception:
        pass
    remaining = None
    if estimated is not None and ps.get("print_duration") is not None:
        try:
            remaining = max(0, float(estimated) - float(ps["print_duration"]))
        except (TypeError, ValueError):
            remaining = None
    out = {
        "online": True,
        "printing": state == "printing",
        "state": state
        if state in ("printing", "paused", "complete", "standby", "cancelled", "error")
        else "online",
        "progress": round(progress * 100, 1),
        "layer": vs.get("layer"),
        "layer_count": vs.get("layer_count"),
        "print_duration": ps.get("print_duration"),
        "remaining": remaining,
        "title": "Tugboat · Impressão 3D ao vivo",
        "updated_at": time.time(),
    }
    if ext.get("temperature") is not None:
        out["nozzle_temp"] = round(float(ext["temperature"]), 0)
    if bed.get("temperature") is not None:
        out["bed_temp"] = round(float(bed["temperature"]), 0)
    return out


def publish_once() -> None:
    try:
        data = to_public(fetch_raw())
    except Exception as e:
        data = to_public(None, str(e))
    path = ROOT / "print-status.json"
    text = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    if path.exists() and path.read_text(encoding="utf-8") == text:
        print(
            time.strftime("%H:%M:%S"),
            "unchanged",
            data.get("state"),
            data.get("progress"),
            flush=True,
        )
        return
    path.write_text(text, encoding="utf-8")
    print(
        time.strftime("%H:%M:%S"),
        "write",
        data.get("state"),
        data.get("progress"),
        flush=True,
    )
    if not PUSH:
        return
    subprocess.run(["git", "add", "print-status.json"], cwd=ROOT, check=False)
    if subprocess.run(["git", "diff", "--cached", "--quiet"], cwd=ROOT).returncode == 0:
        return
    msg = f"chore: print-status {data.get('state')} {data.get('progress')}%"
    subprocess.run(["git", "commit", "-m", msg], cwd=ROOT, check=False)
    subprocess.run(["git", "push", "origin", "main"], cwd=ROOT, check=False)


if __name__ == "__main__":
    if os.environ.get("ONCE", "0") == "1":
        publish_once()
    else:
        while True:
            try:
                publish_once()
            except Exception as e:
                print("err", e, flush=True)
            time.sleep(INTERVAL)
