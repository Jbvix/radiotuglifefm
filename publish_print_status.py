#!/usr/bin/env python3
"""Atualiza print-status.json e faz commit+push para o Netlify (via GitHub) enxergar a impressão."""
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
INTERVAL = int(os.environ.get("PUBLISH_INTERVAL", "60"))
PUSH = os.environ.get("PUBLISH_PUSH", "1") == "1"


def status() -> dict:
    q = "print_stats&display_status&virtual_sdcard&heater_bed&extruder&temperature_sensor%20chamber_temp"
    url = f"{MOON}/printer/objects/query?{q}"
    try:
        with urllib.request.urlopen(url, timeout=5) as r:
            raw = json.loads(r.read().decode())
        st = raw["result"]["status"]
        ps, vs, ds = st["print_stats"], st["virtual_sdcard"], st["display_status"]
        bed, ext = st.get("heater_bed", {}), st.get("extruder", {})
        chamber = st.get("temperature_sensor chamber_temp", {})
        state = (ps.get("state") or "").lower()
        progress = float(vs.get("progress") if vs.get("progress") is not None else (ds.get("progress") or 0))
        estimated = None
        try:
            estimated = (vs.get("cur_print_data") or {}).get("metadata", {}).get("estimated_time")
        except Exception:
            pass
        remaining = None
        if estimated is not None and ps.get("print_duration") is not None:
            remaining = max(0, float(estimated) - float(ps["print_duration"]))
        return {
            "online": True,
            "printing": state == "printing",
            "state": state,
            "progress": round(progress * 100, 1),
            "filename": (ps.get("filename") or "").split("/")[-1],
            "layer": vs.get("layer"),
            "layer_count": vs.get("layer_count"),
            "print_duration": ps.get("print_duration"),
            "remaining": remaining,
            "z_pos": ps.get("z_pos"),
            "nozzle": {"temp": ext.get("temperature"), "target": ext.get("target")},
            "bed": {"temp": bed.get("temperature"), "target": bed.get("target")},
            "chamber_temp": chamber.get("temperature"),
            "printer": PRINTER,
            "printer_name": "Creality K2 Plus",
            "camera_page": f"http://{PRINTER}:4408/",
            "fluidd": f"http://{PRINTER}:4408/",
            "updated_at": time.time(),
        }
    except Exception as e:
        return {"online": False, "printing": False, "error": str(e), "printer": PRINTER, "updated_at": time.time()}


def publish_once() -> None:
    data = status()
    path = ROOT / "print-status.json"
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(time.strftime("%H:%M:%S"), "printing=", data.get("printing"), "progress=", data.get("progress"), flush=True)
    if not PUSH:
        return
    subprocess.run(["git", "add", "print-status.json"], cwd=ROOT, check=False)
    # only commit if changed
    diff = subprocess.run(["git", "diff", "--cached", "--quiet"], cwd=ROOT)
    if diff.returncode == 0:
        return
    msg = f"chore: print-status {data.get('state')} {data.get('progress')}%"
    subprocess.run(["git", "commit", "-m", msg], cwd=ROOT, check=False)
    subprocess.run(["git", "push", "origin", "main"], cwd=ROOT, check=False)


if __name__ == "__main__":
    once = os.environ.get("ONCE", "0") == "1"
    if once:
        publish_once()
    else:
        while True:
            try:
                publish_once()
            except Exception as e:
                print("err", e, flush=True)
            time.sleep(INTERVAL)
