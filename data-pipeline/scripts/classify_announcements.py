"""classify_announcements.py — put each filing into exactly one of the 16 categories.

Contract
--------
Reads  : data/announcements/<TICKER>.json (raw)
Writes : same files, with `type` (one of the 17 ids) + one-line `summary` + `importance`
Model  : CHEAP (claude-haiku-5-5) — bulk classification + short summary
Cache  : skip any announcement whose id already has type != "unclassified"

Run: python scripts/classify_announcements.py

STUB — not implemented yet. See ../CLAUDE.md build order.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from config import load_config  # noqa: E402


def main() -> None:
    cfg = load_config()
    model = cfg["models"]["cheap"]
    raise NotImplementedError(
        f"TODO: classify filings into 16 categories using {model}; weight via config.categories"
    )


if __name__ == "__main__":
    main()
