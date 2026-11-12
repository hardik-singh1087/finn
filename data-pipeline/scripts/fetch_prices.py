"""fetch_prices.py — EOD price & volume for every configured ticker.

Contract
--------
Source : yfinance (Yahoo Finance), symbol = <ticker>.NS (see config.yahoo_symbol)
Output : data/prices/<TICKER>.json  ->  PriceBar[] (newest last)
Model  : none

Run: python scripts/fetch_prices.py [--years 2]

STUB — not implemented yet. See ../CLAUDE.md build order.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from config import load_config, all_companies, yahoo_symbol, DATA_DIR  # noqa: E402


def main() -> None:
    cfg = load_config()
    raise NotImplementedError(
        f"TODO: yfinance download for {len(all_companies(cfg))} tickers -> {DATA_DIR / 'prices'}"
    )


if __name__ == "__main__":
    main()
