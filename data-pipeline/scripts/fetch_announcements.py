"""fetch_announcements.py — recent corporate filings for the portfolio (NSE primary, BSE best-effort).

Real, generic live fetch from the exchanges' public JSON feeds, with browser-like headers and
polite delays. If the live fetch is blocked/flaky, the committed per-ticker files stay in place,
and a saved snapshot (data-pipeline/seed/announcements_seed.json) can repopulate them so the demo
always runs. Classification is a SEPARATE step (classify_announcements.py) so this stays cheap.

Saves per announcement: company, date/time, title, (exchange subject), type, summary, source link,
raw text, importance. Output: data/announcements/<TICKER>.json  (Announcement[], merged by id).

Usage
-----
    python scripts/fetch_announcements.py                 # live NSE, last 60 days, all portfolio
    python scripts/fetch_announcements.py --days 90 --all # include research tickers
    python scripts/fetch_announcements.py --offline        # no network; just report what's on disk
    python scripts/fetch_announcements.py --restore-seed   # repopulate data/ from the saved snapshot
    python scripts/fetch_announcements.py --snapshot        # after a good run, save the seed snapshot

See ../CLAUDE.md (Phase 1).
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from config import load_config, DATA_DIR  # noqa: E402

ANN_DIR = DATA_DIR / "announcements"
SEED_PATH = Path(__file__).resolve().parent.parent / "seed" / "announcements_seed.json"
IST = ZoneInfo("Asia/Kolkata")
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36")
REQUEST_DELAY_S = 2.0  # be polite to the exchange


def ann_id(ticker: str, when: str, title: str) -> str:
    return hashlib.sha1(f"{ticker}|{when}|{title}".encode()).hexdigest()[:16]


# ---------------------------------------------------------------- NSE

def nse_session() -> requests.Session:
    s = requests.Session()
    s.headers.update({
        "User-Agent": UA,
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Connection": "keep-alive",
    })
    s.get("https://www.nseindia.com", timeout=10)  # prime cookies
    time.sleep(1.0)
    return s


def nse_symbol(company: dict) -> str:
    """NSE trading symbol — equals the Yahoo override when the symbol was renamed
    (ZOMATO->ETERNAL, TATAMOTORS->TMPV), else the config ticker."""
    return company.get("yahoo", company["ticker"])


def nse_fetch(session: requests.Session, symbol: str, ticker: str, days: int) -> list[dict]:
    end = datetime.now(IST).date()
    start = end - timedelta(days=days)
    url = (
        "https://www.nseindia.com/api/corporate-announcements"
        f"?index=equities&symbol={symbol}"
        f"&from_date={start.strftime('%d-%m-%Y')}&to_date={end.strftime('%d-%m-%Y')}"
    )
    ref = {"Referer": f"https://www.nseindia.com/get-quotes/equity?symbol={symbol}"}
    r = session.get(url, headers=ref, timeout=15)
    if r.status_code == 401:  # cookie expired — re-prime once
        session.get("https://www.nseindia.com", timeout=10)
        time.sleep(1.0)
        r = session.get(url, headers=ref, timeout=15)
    r.raise_for_status()
    d = r.json()
    rows = d if isinstance(d, list) else d.get("data", [])
    out: list[dict] = []
    for row in rows:
        subject = (row.get("desc") or "").strip()
        sort_date = (row.get("sort_date") or "").strip()
        if not sort_date:
            continue
        iso = sort_date.replace(" ", "T") + "+05:30"
        out.append({
            "id": ann_id(ticker, sort_date, subject),
            "ticker": ticker,
            "company": (row.get("sm_name") or "").strip(),
            "date": iso,
            "title": subject,
            "exchangeSubject": subject,
            "type": "unclassified",
            "summary": "",
            "importance": 0,
            "source": (row.get("attchmntFile") or "").strip(),
            "rawText": (row.get("attchmntText") or "").strip(),
            "exchange": "NSE",
        })
    return out


# ---------------------------------------------------------------- merge / io

def load_existing(ticker: str) -> dict[str, dict]:
    path = ANN_DIR / f"{ticker}.json"
    if not path.exists():
        return {}
    try:
        return {a["id"]: a for a in json.loads(path.read_text())}
    except (json.JSONDecodeError, KeyError):
        return {}


def save_ticker(ticker: str, items: dict[str, dict]) -> list[dict]:
    ordered = sorted(items.values(), key=lambda a: a["date"], reverse=True)
    (ANN_DIR / f"{ticker}.json").write_text(json.dumps(ordered, indent=2) + "\n")
    return ordered


def merge_keep_enrichment(existing: dict[str, dict], fresh: list[dict]) -> dict[str, dict]:
    """Add new items; for ids we already classified, keep type/summary/importance."""
    for f in fresh:
        prev = existing.get(f["id"])
        if prev and prev.get("type") not in (None, "", "unclassified"):
            f["type"] = prev["type"]
            f["summary"] = prev.get("summary", "")
            f["importance"] = prev.get("importance", 0)
        existing[f["id"]] = f
    return existing


# ---------------------------------------------------------------- modes

def run_live(companies: list[dict], days: int) -> None:
    ANN_DIR.mkdir(parents=True, exist_ok=True)
    try:
        session = nse_session()
    except Exception as e:
        print(f"! Could not reach NSE ({e}). Committed files on disk are unchanged.")
        return
    total, failures = 0, []
    for c in companies:
        ticker = c["ticker"]
        try:
            fresh = nse_fetch(session, nse_symbol(c), ticker, days)
            merged = merge_keep_enrichment(load_existing(ticker), fresh)
            ordered = save_ticker(ticker, merged)
            total += len(fresh)
            print(f"  ✓ {ticker:<12} {len(fresh):>3} fetched  ({len(ordered)} on disk)")
        except Exception as e:
            failures.append(f"{ticker}: {e}")
            print(f"  ✗ {ticker:<12} live fetch failed: {str(e)[:70]} — keeping committed file")
        time.sleep(REQUEST_DELAY_S)
    print(f"\nLive fetch done. {total} rows across {len(companies) - len(failures)} tickers.")
    if failures:
        print(f"{len(failures)} tickers fell back to their committed file:")
        for f in failures:
            print("   -", f)


def run_offline(companies: list[dict]) -> None:
    n = 0
    for c in companies:
        items = load_existing(c["ticker"])
        n += len(items)
        if items:
            print(f"  · {c['ticker']:<12} {len(items)} on disk")
    print(f"\nOffline: {n} announcements already committed across the portfolio.")


def make_snapshot(companies: list[dict]) -> None:
    SEED_PATH.parent.mkdir(parents=True, exist_ok=True)
    allrows = []
    for c in companies:
        allrows.extend(load_existing(c["ticker"]).values())
    SEED_PATH.write_text(json.dumps(
        {"generatedAt": datetime.now(IST).isoformat(), "announcements": allrows}, indent=2) + "\n")
    print(f"Saved snapshot of {len(allrows)} announcements -> {SEED_PATH}")


def restore_seed(companies: list[dict]) -> None:
    if not SEED_PATH.exists():
        print(f"No snapshot at {SEED_PATH}")
        return
    ANN_DIR.mkdir(parents=True, exist_ok=True)
    seed = json.loads(SEED_PATH.read_text())["announcements"]
    by_ticker: dict[str, dict] = {}
    for a in seed:
        by_ticker.setdefault(a["ticker"], {})[a["id"]] = a
    want = {c["ticker"] for c in companies}
    for ticker, items in by_ticker.items():
        if ticker in want:
            merged = merge_keep_enrichment(load_existing(ticker), list(items.values()))
            save_ticker(ticker, merged)
    print(f"Restored {len(seed)} announcements from snapshot for {len(by_ticker)} tickers.")


def main() -> None:
    ap = argparse.ArgumentParser(description="Fetch corporate announcements (NSE primary).")
    ap.add_argument("--days", type=int, default=60, help="look-back window in days (default 60)")
    ap.add_argument("--all", action="store_true", help="include research tickers too")
    ap.add_argument("--offline", action="store_true", help="no network; report what's on disk")
    ap.add_argument("--snapshot", action="store_true", help="save a seed snapshot from current files")
    ap.add_argument("--restore-seed", action="store_true", help="repopulate data/ from the snapshot")
    ap.add_argument("tickers", nargs="*", help="limit to these tickers (default: all)")
    args = ap.parse_args()

    cfg = load_config()
    companies = list(cfg["portfolio"]) + (cfg["researchTickers"] if args.all else [])
    if args.tickers:
        want = {t.upper() for t in args.tickers}
        companies = [c for c in companies if c["ticker"].upper() in want]

    if args.restore_seed:
        restore_seed(companies)
    elif args.offline:
        run_offline(companies)
    else:
        run_live(companies, args.days)
    if args.snapshot:
        make_snapshot(companies)


if __name__ == "__main__":
    main()
