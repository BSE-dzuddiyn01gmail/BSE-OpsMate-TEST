#!/usr/bin/env python3
"""Refresh the derived SISMARP transport cache from the public DOA service.

Authority remains SISMARP / Jabatan Pertanian Malaysia. The cache is derived
transport state only; consumers must enforce `freshness_days` and fail closed.
"""
from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.request import Request, urlopen

SOURCE = "http://www.portal.doa.gov.my/sismarp/"
WILDCARD_URL = SOURCE + "welcome/searchtanaman?search=%25"
USER_AGENT = "OpsMate-BSE-SISMARP-Cache/1.0 (+public DOA data; weekly refresh)"


class RowParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.in_tr = False
        self.in_td = False
        self.cells: list[str] = []
        self.cell: list[str] = []
        self.hrefs: list[str] = []
        self.rows: list[tuple[list[str], list[str]]] = []

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        if tag == "tr":
            self.in_tr = True
            self.cells = []
            self.hrefs = []
        elif tag == "td" and self.in_tr:
            self.in_td = True
            self.cell = []
        elif tag == "a" and self.in_tr:
            href = dict(attrs).get("href", "")
            if href:
                self.hrefs.append(href)

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag == "td" and self.in_td:
            self.in_td = False
            self.cells.append(re.sub(r"\s+", " ", " ".join(self.cell)).strip())
        elif tag == "tr" and self.in_tr:
            self.in_tr = False
            if len(self.cells) >= 6 and self.cells[0].isdigit():
                self.rows.append((list(self.cells), list(self.hrefs)))

    def handle_data(self, data):
        if self.in_td:
            self.cell.append(data)


def fetch() -> str:
    req = Request(WILDCARD_URL, headers={"User-Agent": USER_AGENT})
    with urlopen(req, timeout=90) as response:
        if response.status != 200:
            raise RuntimeError(f"SISMARP HTTP {response.status}")
        return response.read().decode("utf-8", errors="replace")


def parse(text: str) -> list[dict]:
    parser = RowParser()
    parser.feed(text)
    by_id: dict[str, dict] = {}
    for cells, hrefs in parser.rows:
        detail_id = ""
        for href in hrefs:
            m = re.search(r"/detail/(\d+)", href)
            if m:
                detail_id = m.group(1)
                break
        if not detail_id:
            continue
        by_id[detail_id] = {
            "i": detail_id,
            "c": cells[1],
            "s": cells[2],
            "p": cells[3],
            "t": cells[4],
            "a": cells[5],
        }
    return sorted(by_id.values(), key=lambda row: int(row["i"]))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--output", required=True)
    args = ap.parse_args()
    rows = parse(fetch())
    if len(rows) < 20000:
        raise RuntimeError(f"Unexpectedly small SISMARP cache: {len(rows)} records")
    now = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    data = {
        "v": 1,
        "authority": "SISMARP — Jabatan Pertanian Malaysia",
        "source": SOURCE,
        "refreshed_at": now,
        "freshness_days": 14,
        "record_count": len(rows),
        "fields": {"i": "detail_id", "c": "crop", "s": "pest_scientific", "p": "pest_common", "t": "trade_name", "a": "active_ingredient"},
        "rows": rows,
    }
    path = Path(args.output)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(json.dumps({"refreshed_at": now, "record_count": len(rows), "output": str(path)}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
