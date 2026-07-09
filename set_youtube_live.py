#!/usr/bin/env python3
"""Define o link da live do YouTube para o app público.

Uso:
  python3 set_youtube_live.py "https://www.youtube.com/watch?v=XXXX"
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def main() -> None:
    if len(sys.argv) < 2:
        print('Uso: python3 set_youtube_live.py "https://www.youtube.com/watch?v=XXXX"')
        sys.exit(1)

    url = sys.argv[1].strip()
    m = re.search(
        r"(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/live/|youtube\.com/embed/)([a-zA-Z0-9_-]{6,})",
        url,
    )
    if not m:
        print("URL inválida:", url)
        sys.exit(1)

    vid = m.group(1)
    cfg = {
        "enabled": True,
        "watchUrl": f"https://www.youtube.com/watch?v={vid}",
        "embedUrl": (
            f"https://www.youtube.com/embed/{vid}"
            f"?autoplay=1&mute=1&playsinline=1&rel=0"
        ),
    }
    (ROOT / "youtube-live.json").write_text(
        json.dumps(cfg, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print("Salvo youtube-live.json")
    print("  watch:", cfg["watchUrl"])
    print("  embed:", cfg["embedUrl"])

    os.environ["ONCE"] = "1"
    subprocess.run(
        [sys.executable, str(ROOT / "publish_print_status.py")],
        cwd=str(ROOT),
        check=False,
    )


if __name__ == "__main__":
    main()
