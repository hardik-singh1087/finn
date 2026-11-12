"""search_fundamentals.py — cheap keyword search over a company's own document chunks.

search(ticker, question) -> best-matching chunks, each WITH its source (doc type + period + page).

Why keyword (BM25), not embeddings?
  - $0 and offline: no embedding API, no paid calls, no vector DB — the demo always runs and
    stays within the challenge's cost bar. Deterministic, so results are reproducible.
  - Fit: financial questions are keyword-dense ("EBITDA margin", "guidance", "capex", "debt"),
    which BM25 handles well. We add light finance-synonym expansion to bridge vocabulary gaps.
  - If recall ever needs to improve, this is a clean seam to swap in embeddings later — the chunk
    store and the search() signature wouldn't change.

Usage:
  python scripts/search_fundamentals.py DMART "what did management say about store expansion?"
  python scripts/search_fundamentals.py NESTLEIND "gross margin trend" --k 5
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

from rank_bm25 import BM25Okapi

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from config import DATA_DIR  # noqa: E402

FUND_DIR = DATA_DIR / "fundamentals"

STOPWORDS = {
    "the", "a", "an", "of", "to", "in", "on", "for", "and", "or", "is", "are", "was", "were",
    "be", "as", "at", "by", "it", "its", "this", "that", "with", "from", "we", "our", "about",
    "what", "did", "do", "does", "how", "has", "have", "they", "their", "will", "would",
}

# Finance-synonym expansion from the brief's "money words" glossary.
SYNONYMS = {
    "revenue": ["sales", "turnover", "topline"],
    "sales": ["revenue", "turnover"],
    "profit": ["pat", "pbt", "earnings", "bottomline"],
    "pat": ["profit", "net", "earnings"],
    "margin": ["margins", "ebitda", "profitability"],
    "ebitda": ["margin", "operating"],
    "cash": ["cashflow", "operations", "fcf"],
    "debt": ["borrowings", "leverage", "liabilities"],
    "guidance": ["outlook", "guided", "expect", "target", "guide"],
    "capex": ["capacity", "expansion", "capital", "plant"],
    "growth": ["grew", "yoy", "cagr", "increase"],
    "expansion": ["stores", "capacity", "capex", "new"],
    "dividend": ["payout", "distribution"],
}


def tokenize(text: str) -> list[str]:
    toks = re.findall(r"[a-z0-9]+", text.lower())
    return [t for t in toks if len(t) >= 2 and t not in STOPWORDS]


def expand(query_tokens: list[str]) -> list[str]:
    out = list(query_tokens)
    for t in query_tokens:
        out.extend(SYNONYMS.get(t, []))
    return out


def load_chunks(ticker: str) -> list[dict]:
    path = FUND_DIR / ticker.upper() / "chunks.json"
    if not path.exists():
        raise FileNotFoundError(
            f"No chunks for {ticker}. Run: python scripts/fetch_fundamentals.py {ticker}")
    return json.loads(path.read_text())


def search(ticker: str, question: str, k: int = 5) -> list[dict]:
    """Return the top-k chunks for (ticker, question), each with score + source."""
    chunks = load_chunks(ticker)
    corpus = [tokenize(c["text"]) for c in chunks]
    bm25 = BM25Okapi(corpus)
    q = expand(tokenize(question))
    scores = bm25.get_scores(q)
    ranked = sorted(range(len(chunks)), key=lambda i: scores[i], reverse=True)[:k]
    results = []
    for i in ranked:
        c = chunks[i]
        results.append({
            "score": round(float(scores[i]), 3),
            "ticker": c["ticker"], "docType": c["docType"], "period": c["period"],
            "page": c["page"], "source": c["source"], "text": c["text"],
        })
    return results


def _cite(r: dict) -> str:
    dt = "Annual Report" if r["docType"] == "annual_report" else "Concall"
    return f'{dt} · {r["period"]} · p.{r["page"]}'


def main() -> None:
    ap = argparse.ArgumentParser(description="Keyword search over a company's primary docs.")
    ap.add_argument("ticker")
    ap.add_argument("question", nargs="+")
    ap.add_argument("--k", type=int, default=5)
    args = ap.parse_args()
    question = " ".join(args.question)

    results = search(args.ticker, question, args.k)
    print(f'\nQ: "{question}"  ({args.ticker})\n' + "=" * 72)
    for i, r in enumerate(results, 1):
        snippet = re.sub(r"\s+", " ", r["text"])[:280]
        print(f"\n[{i}] score {r['score']}  —  {_cite(r)}")
        print(f"    {snippet}…")
        print(f"    source: {r['source']}")


if __name__ == "__main__":
    main()
