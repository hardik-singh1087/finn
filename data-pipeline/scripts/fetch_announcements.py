"""fetch_announcements.py — corporate filings for every portfolio ticker.

Contract
--------
Source : NSE/BSE announcement feeds (public)
Output : data/announcements/<TICKER>.json -> Announcement[] with type="unclassified" (raw)
Model  : none (classification happens in classify_announcements.py)

Run: python scripts/fetch_announcements.py [--since 2026-09-01]

STUB — not implemented yet. See ../CLAUDE.md build order.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from config import load_config, DATA_DIR  # noqa: E402


def main() -> None:
    load_config()
    raise NotImplementedError(
        f"TODO: fetch NSE/BSE filings -> {DATA_DIR / 'announcements'} (type left as 'unclassified')"
    )


if __name__ == "__main__":
    main()
