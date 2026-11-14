"""promised_vs_delivered.py — the star feature. Judges management, not just summarises it.

For the last ~4 quarters it reads the company's OWN earnings-call transcripts and annual report and
builds a quarter-by-quarter comparison:

  PROMISED  — the guidance / forward-looking commitments management made ON each call
              (revenue-growth guidance, margin band, capex, deal wins, expansion).
  DELIVERED — what they actually reported that quarter (revenue, margin, PAT, with QoQ/YoY).

Then a verdict per quarter (did delivery honour the promise?) and a handful of "tracked promises" —
one commitment followed call-over-call so the gap is obvious at a glance (e.g. a revenue-growth
guidance that was cut twice while the margin guidance held).

HARD RULE (same as the rest of the Pull side): every promise, number and verdict is grounded in a
numbered document excerpt and cites it. No news, no broker notes, no model memory. If the excerpts
don't support something, it is left out.

Model: the stronger free-tier model (gemini-3.5-flash, thinking off) — this is a reasoning task.
ONE call per company. Cached at data/research/<TICKER>.pvd.json so it is instant and never re-paid.

Usage:
  python scripts/promised_vs_delivered.py INFY
  python scripts/promised_vs_delivered.py INFY TCS --force
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from datetime import datetime
from pathlib import Path

from rank_bm25 import BM25Okapi

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from config import load_config, DATA_DIR  # noqa: E402
sys.path.insert(0, str(Path(__file__).resolve().parent))
from search_fundamentals import load_chunks, tokenize, expand  # noqa: E402
from research import _gemini, gemini_json  # noqa: E402  (reuse the client + JSON caller)

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent.parent.parent / ".env")
except Exception:
    pass

RESEARCH_DIR = DATA_DIR / "research"
FUND_DIR = DATA_DIR / "fundamentals"

MONTHS = {m: i for i, m in enumerate(
    ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], start=1)}

# What management PROMISED (forward-looking) and what they DELIVERED (reported) — two retrieval
# angles, run per concall so every quarter is represented in the context.
PROMISE_Q = ("guidance outlook revenue growth margin constant currency we expect full year "
             "going forward target raising lowering narrowing capex expansion deal wins pipeline")
DELIVERED_Q = ("revenue was profit after tax operating margin EBIT grew quarter year on year "
               "reported this quarter sequential crore dollars net profit EPS free cash flow")

SYSTEM = (
    "You are a disciplined, skeptical equity-research analyst. You judge whether management did what "
    "it said — promised vs delivered — using ONLY the numbered excerpts from a single company's own "
    "earnings-call transcripts and annual report. Never use outside knowledge or memory. Every "
    "promise, number and verdict must trace to an excerpt; cite it with its number in an \"n\" field. "
    "If the excerpts don't support a claim, leave it out. Be concrete and quote the actual figures.\n\n"
    "Return ONLY JSON of this exact shape:\n"
    "{\n"
    '  "notFound": <true only if the excerpts contain no usable guidance or results>,\n'
    '  "verdict": "<2-3 sentence overall judgment of management credibility>",\n'
    '  "scorecard": {"kept": <int>, "missed": <int>, "mixed": <int>},\n'
    '  "trackedPromises": [\n'
    '    {"topic": "<a specific commitment, e.g. FY revenue-growth guidance>",\n'
    '     "trail": [{"call": "<e.g. Jul 2026>", "value": "<the figure stated then>", "n": <excerpt>}],\n'
    '     "verdict": "match|miss|mixed|na", "note": "<one line>"}\n'
    "  ],\n"
    '  "quarters": [\n'
    '    {"label": "<e.g. Q2 FY26 — infer from the transcript>", "call": "<e.g. Oct 2026>",\n'
    '     "promised": [{"text": "<a guidance/commitment made on this call>", "n": <excerpt>}],\n'
    '     "delivered": [{"metric": "Revenue", "value": "<as reported>", "change": "<+/-% YoY or QoQ>", "n": <excerpt>}],\n'
    '     "verdict": "match|miss|mixed|na", "note": "<did delivery honour the promise? one line>"}\n'
    "  ]\n"
    "}\n"
    "Order quarters most-recent first. Pick 2-4 trackedPromises that best expose where management hit "
    "or missed. A quarter verdict compares that quarter's actuals against what was promised on this or "
    "an earlier call. Use \"na\" only when a quarter has guidance but no comparable later delivery yet."
)


def period_key(period: str) -> tuple[int, int]:
    m = re.match(r"([A-Za-z]{3})\s+(\d{4})", period or "")
    if not m:
        return (0, 0)
    return (int(m.group(2)), MONTHS.get(m.group(1)[:3].title(), 0))


def retrieve_for_period(chunks: list[dict], period: str, query: str, k: int) -> list[dict]:
    """BM25 over just this concall's chunks."""
    sub = [c for c in chunks if c["docType"] == "concall_transcript" and c["period"] == period]
    if not sub:
        return []
    corpus = [tokenize(c["text"]) for c in sub]
    bm25 = BM25Okapi(corpus)
    scores = bm25.get_scores(expand(tokenize(query)))
    order = sorted(range(len(sub)), key=lambda i: scores[i], reverse=True)[:k]
    return [sub[i] for i in order if scores[i] > 0]


def ar_numbers(chunks: list[dict], k: int) -> list[dict]:
    """A couple of annual-report chunks for full-year actuals / context."""
    sub = [c for c in chunks if c["docType"] == "annual_report"]
    if not sub:
        return []
    corpus = [tokenize(c["text"]) for c in sub]
    bm25 = BM25Okapi(corpus)
    q = expand(tokenize("total revenue from operations profit after tax for the year financial highlights "
                        "operating margin earnings per share guidance outlook"))
    scores = bm25.get_scores(q)
    order = sorted(range(len(sub)), key=lambda i: scores[i], reverse=True)[:k]
    return [sub[i] for i in order if scores[i] > 0]


def cite_label(r: dict) -> str:
    dt = "Annual Report" if r["docType"] == "annual_report" else "Concall"
    return f'{dt} · {r["period"]} · p.{r["page"]}'


def build_context(ticker: str, chunks: list[dict], periods: list[str]):
    """Group excerpts by call (newest first) so the model sees the quarter structure. Returns the
    context string and the ordered chunk list so citation numbers line up."""
    ordered: list[dict] = []
    blocks: list[str] = []
    seen: set[tuple] = set()

    def add(r: dict) -> int:
        key = (r["docType"], r["period"], r["page"], r["text"][:40])
        if key in seen:
            return 0
        seen.add(key)
        ordered.append(r)
        return len(ordered)

    for p in periods:
        rows = []
        for r in retrieve_for_period(chunks, p, PROMISE_Q, 5) + retrieve_for_period(chunks, p, DELIVERED_Q, 5):
            n = add(r)
            if n:
                snippet = re.sub(r"\s+", " ", r["text"]).strip()[:850]
                rows.append(f"[{n}] ({cite_label(r)})\n{snippet}")
        if rows:
            blocks.append(f"===== {p} earnings call =====\n" + "\n\n".join(rows))

    ar_rows = []
    for r in ar_numbers(chunks, 3):
        n = add(r)
        if n:
            snippet = re.sub(r"\s+", " ", r["text"]).strip()[:850]
            ar_rows.append(f"[{n}] ({cite_label(r)})\n{snippet}")
    if ar_rows:
        blocks.append("===== Annual report (full-year context) =====\n" + "\n\n".join(ar_rows))

    return "\n\n".join(blocks), ordered


def collect_citations(data: dict, ordered: list[dict]) -> list[dict]:
    used: set[int] = set()

    def grab(obj):
        if isinstance(obj, dict):
            n = obj.get("n")
            if isinstance(n, int):
                used.add(n)
            for v in obj.values():
                grab(v)
        elif isinstance(obj, list):
            for v in obj:
                grab(v)

    grab(data.get("quarters"))
    grab(data.get("trackedPromises"))
    cites = []
    for n in sorted(used):
        if 1 <= n <= len(ordered):
            r = ordered[n - 1]
            cites.append({"n": n, "docType": r["docType"], "period": r["period"], "page": r["page"],
                          "source": r["source"], "snippet": re.sub(r"\s+", " ", r["text"]).strip()[:240]})
    return cites


def process(ticker: str, force: bool) -> None:
    ticker = ticker.upper()
    try:
        chunks = load_chunks(ticker)
    except FileNotFoundError:
        print(f"  ✗ {ticker}: no fundamentals — run fetch_fundamentals.py {ticker} first")
        return

    out_path = RESEARCH_DIR / f"{ticker}.pvd.json"
    if out_path.exists() and not force:
        print(f"{ticker}: cached ({out_path.name}) — use --force to rebuild")
        return

    cfg = load_config()
    strong = cfg["models"]["geminiStrong"]
    meta_path = FUND_DIR / ticker / "meta.json"
    meta = json.loads(meta_path.read_text()) if meta_path.exists() else {}

    # last ~4 quarterly calls, newest first
    periods = sorted(
        {c["period"] for c in chunks if c["docType"] == "concall_transcript"},
        key=period_key, reverse=True)[:4]
    if not periods:
        print(f"  ✗ {ticker}: no concall transcripts — promised-vs-delivered needs them")
        return
    print(f"{ticker}: promised vs delivered over {len(periods)} quarters: {', '.join(periods)}")

    context, ordered = build_context(ticker, chunks, periods)
    if not ordered:
        print(f"  ✗ {ticker}: no usable excerpts")
        return

    user = (f"Company: {ticker}. Build the promised-vs-delivered comparison for the last "
            f"{len(periods)} quarters from these excerpts (cite by number):\n\n{context}")

    client, types = _gemini()
    try:
        data, it, ot = gemini_json(client, types, user, strong, strong=True, system=SYSTEM, max_tokens=4000)
    except Exception as e:
        print(f"  ✗ {ticker}: strong model failed ({str(e)[:60]}); not written")
        return

    tracked = data.get("trackedPromises") or []
    # Derive the scorecard from the tracked-promise verdicts so the headline always matches the rows
    # the user sees (the model's own count is inconsistent).
    scorecard = {
        "kept": sum(1 for t in tracked if t.get("verdict") == "match"),
        "missed": sum(1 for t in tracked if t.get("verdict") == "miss"),
        "mixed": sum(1 for t in tracked if t.get("verdict") == "mixed"),
    }
    doc = {
        "ticker": ticker,
        "name": meta.get("ticker", ticker),
        "generatedAt": datetime.now().astimezone().isoformat(),
        "model": strong,
        "notFound": bool(data.get("notFound")),
        "verdict": data.get("verdict") or "",
        "scorecard": scorecard,
        "trackedPromises": tracked,
        "quarters": data.get("quarters") or [],
        "citations": collect_citations(data, ordered),
        "docsUsed": [{"docType": d["docType"], "period": d["period"], "source": d["source"]}
                     for d in meta.get("docs", []) if d["docType"] == "concall_transcript"][:4],
        "tokens": {"input": it, "output": ot},
        "costUSD": 0.0,
    }
    RESEARCH_DIR.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(doc, indent=2) + "\n")
    nq = len(doc["quarters"])
    nt = len(doc["trackedPromises"])
    sc = doc["scorecard"]
    print(f"  ✓ {nq} quarters, {nt} tracked promises, {len(doc['citations'])} cites  "
          f"(kept {sc.get('kept',0)} / missed {sc.get('missed',0)} / mixed {sc.get('mixed',0)})")
    print(f"  -> {out_path}  | tokens {it+ot:,}  | $0.00 (Gemini free tier)\n")


def main() -> None:
    ap = argparse.ArgumentParser(description="Promised vs delivered (primary docs only).")
    ap.add_argument("tickers", nargs="+")
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()
    if not os.environ.get("GEMINI_API_KEY"):
        print("No GEMINI_API_KEY in ../.env — cannot run.")
        sys.exit(1)
    for t in args.tickers:
        try:
            process(t, args.force)
        except Exception as e:
            print(f"  ✗ {t}: {str(e)[:90]}")


if __name__ == "__main__":
    main()
