"""fetch_prices.py — EOD price & volume for the portfolio.

Downloads ~1 year of daily OHLCV from Yahoo Finance (yfinance) for every configured
ticker and saves it per stock. Re-running is safe (merges by date, never duplicates)
and it won't re-download a ticker twice the same day unless you pass --force.

Outputs
-------
data/prices/<TICKER>.json   -> PriceBar[]  (chronological, newest last)
data/prices/_summary.json   -> { generatedAt, stocks: PriceSummary[] }
                               latestClose, 1-day % change, 20-day average volume, etc.

Usage
-----
    python scripts/fetch_prices.py              # portfolio, ~1y, skip tickers already fetched today
    python scripts/fetch_prices.py --force      # ignore the same-day cache
    python scripts/fetch_prices.py --all        # include the research tickers too
    python scripts/fetch_prices.py --period 2y

See ../CLAUDE.md (Phase 1).
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import yfinance as yf

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from config import load_config, yahoo_symbol, DATA_DIR  # noqa: E402

PRICES_DIR = DATA_DIR / "prices"
SUMMARY_PATH = PRICES_DIR / "_summary.json"
IST = ZoneInfo("Asia/Kolkata")
AVG_VOLUME_WINDOW = 20


def today_ist() -> str:
    return datetime.now(IST).date().isoformat()


def load_bars(ticker: str) -> dict[str, dict]:
    """Existing bars as {date: bar} so a re-run merges instead of duplicating."""
    path = PRICES_DIR / f"{ticker}.json"
    if not path.exists():
        return {}
    try:
        return {b["date"]: b for b in json.loads(path.read_text())}
    except (json.JSONDecodeError, KeyError):
        return {}


def download_bars(symbol: str, period: str) -> list[dict]:
    """Fetch OHLCV from Yahoo. Unadjusted close (what the investor sees). Drops bad rows."""
    df = yf.Ticker(symbol).history(
        period=period, interval="1d", auto_adjust=False, actions=False
    )
    bars: list[dict] = []
    if df is None or df.empty:
        return bars
    for idx, row in df.iterrows():
        close, volume = row.get("Close"), row.get("Volume")
        # Market holidays / missing data show up as NaN — skip them quietly.
        if close is None or volume is None or close != close or volume != volume:
            continue
        bars.append(
            {
                "date": idx.date().isoformat(),
                "open": round(float(row["Open"]), 2),
                "high": round(float(row["High"]), 2),
                "low": round(float(row["Low"]), 2),
                "close": round(float(close), 2),
                "volume": int(volume),
            }
        )
    return bars


def summarise(company: dict, bars: list[dict], fetched_on: str) -> dict:
    """latest close, 1-day % change, 20-day average volume (+ a couple of derived helpers)."""
    latest = bars[-1]
    prev = bars[-2] if len(bars) >= 2 else None
    change_pct = (
        round((latest["close"] - prev["close"]) / prev["close"] * 100, 2)
        if prev and prev["close"]
        else None
    )
    window = bars[-AVG_VOLUME_WINDOW:]
    avg_volume = round(sum(b["volume"] for b in window) / len(window)) if window else 0
    return {
        "ticker": company["ticker"],
        "name": company["name"],
        "sector": company["sector"],
        "latestDate": latest["date"],
        "latestClose": latest["close"],
        "prevClose": prev["close"] if prev else None,
        "changePct1d": change_pct,
        "latestVolume": latest["volume"],
        "avgVolume20d": avg_volume,
        "volumeVsAvg": round(latest["volume"] / avg_volume, 2) if avg_volume else None,
        "bars": len(bars),
        "fetchedOn": fetched_on,
    }


def main() -> None:
    ap = argparse.ArgumentParser(description="Fetch EOD price & volume (yfinance).")
    ap.add_argument("--period", default="1y", help="yfinance period, e.g. 1y, 2y (default 1y)")
    ap.add_argument("--force", action="store_true", help="ignore the same-day cache")
    ap.add_argument("--all", action="store_true", help="include research tickers too")
    args = ap.parse_args()

    cfg = load_config()
    companies = list(cfg["portfolio"])
    if args.all:
        companies += cfg["researchTickers"]

    PRICES_DIR.mkdir(parents=True, exist_ok=True)
    today = today_ist()

    # Keep prior summaries so cache-skipped tickers still appear in the output.
    prior: dict[str, dict] = {}
    if SUMMARY_PATH.exists():
        try:
            prior = {s["ticker"]: s for s in json.loads(SUMMARY_PATH.read_text())["stocks"]}
        except (json.JSONDecodeError, KeyError):
            prior = {}

    summaries: dict[str, dict] = {}
    failures: list[str] = []

    for c in companies:
        ticker, symbol = c["ticker"], yahoo_symbol(c)

        if not args.force and prior.get(ticker, {}).get("fetchedOn") == today:
            summaries[ticker] = prior[ticker]
            print(f"  · {ticker:<12} cached (fetched today) — skip")
            continue

        try:
            fresh = download_bars(symbol, args.period)
        except Exception as e:  # network / symbol issues shouldn't kill the whole run
            failures.append(f"{ticker} ({symbol}): {e}")
            print(f"  ✗ {ticker:<12} {symbol} failed: {e}")
            continue

        if not fresh:
            failures.append(f"{ticker} ({symbol}): no data returned")
            print(f"  ✗ {ticker:<12} {symbol} no data")
            continue

        merged = load_bars(ticker)
        merged.update({b["date"]: b for b in fresh})
        bars = [merged[d] for d in sorted(merged)]

        (PRICES_DIR / f"{ticker}.json").write_text(json.dumps(bars, indent=2) + "\n")
        summaries[ticker] = summarise(c, bars, today)
        s = summaries[ticker]
        print(
            f"  ✓ {ticker:<12} {s['bars']:>3} bars  close ₹{s['latestClose']:<10} "
            f"{s['changePct1d']!s:>7}%  vol x{s['volumeVsAvg']}"
        )

    ordered = [summaries[c["ticker"]] for c in companies if c["ticker"] in summaries]
    SUMMARY_PATH.write_text(
        json.dumps({"generatedAt": datetime.now(IST).isoformat(), "stocks": ordered}, indent=2)
        + "\n"
    )

    print(f"\nDone. {len(ordered)}/{len(companies)} tickers -> {PRICES_DIR}")
    if failures:
        print(f"{len(failures)} failed:")
        for f in failures:
            print("   -", f)


if __name__ == "__main__":
    main()
