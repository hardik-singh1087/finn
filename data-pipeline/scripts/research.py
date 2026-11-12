"""research.py — on-demand Pull analysis for one company, grounded in primary sources.

Contract
--------
Reads  : data/fundamentals/<TICKER>/ (annual report + concall transcripts ONLY)
Writes : data/research/<TICKER>.json -> ResearchDoc (cached by content hash)
Model  : MID for snapshots/extraction, STRONG only for promised_vs_delivered
Cache  : if the cached section's source fingerprint + model match, reuse — never re-pay

Sections (a menu — build incrementally):
  business_snapshot, financial_snapshot, trajectory, balance_sheet, cash_quality,
  narrative_vs_numbers, guidance, bull_vs_bear, promised_vs_delivered (the star).

Run: python scripts/research.py <TICKER> [--section promised_vs_delivered]

STUB — not implemented yet. See ../CLAUDE.md build order.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from config import load_config  # noqa: E402


def main(ticker: str) -> None:
    cfg = load_config()
    strong = cfg["models"]["strong"]
    raise NotImplementedError(
        f"TODO: research {ticker} from fundamentals only; promised-vs-delivered via {strong}; cache output"
    )


if __name__ == "__main__":
    if len(sys.argv) < 2:
        raise SystemExit("usage: python scripts/research.py <TICKER>")
    main(sys.argv[1])
