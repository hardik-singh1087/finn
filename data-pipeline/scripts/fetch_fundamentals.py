"""fetch_fundamentals.py — primary sources for the Pull/research side.

Contract
--------
Source : screener.in (annual report + concall transcript links) / company IR site
Output : data/fundamentals/<TICKER>/
           annual-report-<FY>.txt, concall-<Q>-<FY>.txt, meta.json (source urls + dates)
Model  : none (raw text extraction only — pdfplumber for PDFs)

PRIMARY DATA ONLY. No news, no broker notes, no research reports.

Run: python scripts/fetch_fundamentals.py <TICKER> [<TICKER> ...]

STUB — not implemented yet. See ../CLAUDE.md build order.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from config import load_config, DATA_DIR  # noqa: E402


def main(tickers: list[str]) -> None:
    load_config()
    raise NotImplementedError(
        f"TODO: pull AR + transcripts for {tickers or 'research set'} -> {DATA_DIR / 'fundamentals'}"
    )


if __name__ == "__main__":
    main(sys.argv[1:])
