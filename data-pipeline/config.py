"""Shared config loader for the Python pipeline.

Reads the SAME file the Next.js app reads (config/finn.config.json) so the ticker
list and alert thresholds never drift between the data side and the app side.
"""
from __future__ import annotations

import json
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
CONFIG_PATH = REPO_ROOT / "config" / "finn.config.json"
DATA_DIR = REPO_ROOT / "data"


def load_config() -> dict:
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def yahoo_symbol(company: dict) -> str:
    """NSE ticker -> Yahoo symbol (adds .NS, honours per-company overrides)."""
    base = company.get("yahoo", company["ticker"])
    return f"{base}.NS"


def all_companies(cfg: dict) -> list[dict]:
    return cfg["portfolio"] + cfg["researchTickers"]


if __name__ == "__main__":
    cfg = load_config()
    print(f"{cfg['appName']} — {len(cfg['portfolio'])} portfolio, "
          f"{len(cfg['researchTickers'])} research tickers")
    print("Data dir:", DATA_DIR)
