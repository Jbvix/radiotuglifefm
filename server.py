#!/usr/bin/env python3
"""
TugLife FM local server + bridge Moonraker (CORS).
Serve o app e expõe /api/print-status para o card de impressão 3D.

Uso:
  python3 server.py
  # /
  # /api/print-status
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent
PRINTER_HOST = os.environ.get("PRINTER_HOST", "0.0.0.0")
MOONRAKER = os.environ.get("MOONRAKER_URL", f"http://{PRINTER_HOST}:7125").rstrip("/")
PORT = int(os.environ.get("PORT", "8787"))


def fetch_print_status() -> dict:
    q = (
        "print_stats&display_status&virtual_sdcard"
        "&heater_bed&extruder&temperature_sensor%20chamber_temp"
    )
    url = f"{MOONRAKER}/printer/objects/query?{q}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "TugLifeFM-PrintBridge/1.0"})
        with urllib.request.urlopen(req, timeout=4) as resp:
            raw = json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        return {
            "online": False,
            "printing": False,
            "error": str(e),
            "printer": PRINTER_HOST,
        }

    st = (raw.get("result") or {}).get("status") or {}
    ps = st.get("print_stats") or {}
    vs = st.get("virtual_sdcard") or {}
    ds = st.get("display_status") or {}
    bed = st.get("heater_bed") or {}
    ext = st.get("extruder") or {}
    chamber = st.get("temperature_sensor chamber_temp") or {}

    state = (ps.get("state") or "unknown").lower()
    progress = vs.get("progress")
    if progress is None:
        progress = ds.get("progress") or 0
    try:
        progress = float(progress)
    except (TypeError, ValueError):
        progress = 0.0

    filename = (ps.get("filename") or "").split("/")[-1]
    layer = vs.get("layer")
    layer_count = vs.get("layer_count")
    print_duration = ps.get("print_duration")
    estimated = None
    try:
        estimated = (
            (vs.get("cur_print_data") or {})
            .get("metadata", {})
            .get("estimated_time")
        )
    except Exception:
        pass

    remaining = None
    if estimated is not None and print_duration is not None:
        try:
            remaining = max(0, float(estimated) - float(print_duration))
        except (TypeError, ValueError):
            remaining = None

    printing = state == "printing"
    online = state in ("printing", "paused", "standby", "complete", "cancelled", "error", "ready") or bool(ps)

    return {
        "online": True,
        "printing": printing,
        "state": state,
        "progress": round(progress * 100, 1),
        "filename": filename,
        "layer": layer,
        "layer_count": layer_count,
        "print_duration": print_duration,
        "remaining": remaining,
        "z_pos": ps.get("z_pos"),
        "nozzle": {
            "temp": ext.get("temperature"),
            "target": ext.get("target"),
        },
        "bed": {
            "temp": bed.get("temperature"),
            "target": bed.get("target"),
        },
        "chamber_temp": chamber.get("temperature"),
        "printer": PRINTER_HOST,
        "printer_name": "Creality K2 Plus",
        "camera_page": f"http://{PRINTER_HOST}:4408/",
        "fluidd": f"http://{PRINTER_HOST}:4408/",
    }


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path in ("/api/print-status", "/api/print-status.json"):
            data = fetch_print_status()
            body = json.dumps(data, ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        return super().do_GET()

    def log_message(self, fmt, *args):
        # quieter
        if args and str(args[0]).startswith("GET /api/"):
            return
        super().log_message(fmt, *args)


def main():
    httpd = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"TugLife FM + print bridge on http://0.0.0.0:{PORT}/")
    print(f"  app:    http://127.0.0.1:{PORT}/")
    print(f"  status: http://127.0.0.1:{PORT}/api/print-status")
    print(f"  moonraker: {MOONRAKER}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nbye")


if __name__ == "__main__":
    main()
