"""build_feed.py — assemble the Push digest, important first.

Contract
--------
Reads  : data/announcements/<T>.json (classified) + data/prices/<T>.json (unusual moves)
Writes : data/feed/latest.json -> FeedItem[] sorted by importance desc
Model  : CHEAP for the per-item `reason` line; results get a `results_headline_extract` (mid)
Logic  : importance = category.weight boosted by unusual price/volume per config.alerts

Run: python scripts/build_feed.py [--window-hours 24]

STUB — not implemented yet. See ../CLAUDE.md build order.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from config import load_config, DATA_DIR  # noqa: E402


def main() -> None:
    cfg = load_config()
    window = cfg["alerts"]["digestWindowHours"]
    raise NotImplementedError(
        f"TODO: build {window}h digest -> {DATA_DIR / 'feed' / 'latest.json'} (sort by importance)"
    )


if __name__ == "__main__":
    main()
