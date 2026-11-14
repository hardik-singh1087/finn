"""research.py — the Pull/research engine. Answers ONLY from the company's own documents.

For any NSE ticker with fundamentals (annual report + concall transcripts, from
fetch_fundamentals.py), this builds grounded research sections:
  business_snapshot, financial_snapshot, trajectory, balance_sheet, cash_quality,
  guidance, bull_vs_bear.

HARD RULE: every section is answered only from retrieved document chunks and cites them. If the
chunks don't contain the answer, the section says "Not found in the documents." No news, no broker
notes, no model memory.

Models (both Gemini free tier): cheap (gemini-3.5-flash-lite) pulls numbers; stronger
(gemini-3.5-flash, thinking off) does the synthesis. Cached per (ticker, section) in
data/research/<TICKER>.json so re-opening is instant and never re-paid.

Usage:
  python scripts/research.py DMART
  python scripts/research.py DMART NESTLEIND --force

See ../CLAUDE.md (Phase 3). The star feature (promised vs delivered) is a later step.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from config import load_config, DATA_DIR  # noqa: E402
sys.path.insert(0, str(Path(__file__).resolve().parent))
from search_fundamentals import search, load_chunks  # noqa: E402

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent.parent.parent / ".env")
except Exception:
    pass

RESEARCH_DIR = DATA_DIR / "research"
FUND_DIR = DATA_DIR / "fundamentals"
TOP_K = 10

# section id -> (title, model tier, retrieval queries, instruction)
SECTIONS = [
    ("business_snapshot", "Business snapshot", "strong",
     ["what the company does business segments products services revenue mix operations stores brands"],
     "Describe what the company does — its business, main segments, and revenue mix — in 3-5 sentences."),
    ("financial_snapshot", "Financial snapshot", "cheap",
     ["revenue from operations was total sales of INR crore for the year profit after tax net profit",
      "standalone and consolidated total revenue grew to crore PAT profit grew EBITDA margin percent",
      "return on equity return on capital employed ROCE ROE earnings per share financial highlights"],
     'Extract the most recent reported headline numbers (full-year, or the latest quarter if that is '
     'what the excerpts state). Return content as a JSON array of '
     '{"metric":"Revenue","value":"<as stated, with unit>","n":<excerpt number>} covering as many as '
     "are present: Revenue/Sales, EBITDA or operating margin, PAT / net profit, EPS, ROE/ROCE. Use any "
     "figure explicitly stated in the excerpts (annual report OR concall). Only set notFound if NONE "
     "of these numbers appear."),
    ("trajectory", "Trajectory", "strong",
     ["revenue growth year on year multi year growth CAGR increase decline trend over the years store additions"],
     "What is the multi-year direction — what is growing and what is compressing? 3-5 sentences."),
    ("balance_sheet", "Balance sheet", "strong",
     ["borrowings debt equity net worth working capital inventory trade receivables payables leverage debt to equity"],
     "Summarise the balance sheet: debt / leverage and the working-capital picture. 3-4 sentences."),
    ("cash_quality", "Cash quality", "strong",
     ["cash flow from operations operating cash flow free cash flow capital expenditure cash conversion"],
     "Does profit convert into cash? Comment on operating cash flow vs. profit and free cash flow. 3-4 sentences."),
    ("guidance", "Guidance", "strong",
     ["guidance outlook expect target going forward next year management commentary plan growth margin capex expansion"],
     "What has management explicitly guided or committed to (growth, margins, capex, store/capacity "
     "expansion)? Prefer the concall transcripts. If there is no explicit guidance, say so. 3-5 short points."),
    ("bull_vs_bear", "Bull vs bear", "strong",
     ["growth drivers strengths competitive advantage opportunities expansion margins",
      "risks challenges weaknesses headwinds competition margin pressure debt regulatory"],
     "Give a tight BULL case and a tight BEAR case (2-3 points each), grounded only in the excerpts. "
     'Return content as {"bull": ["point [n]", ...], "bear": ["point [n]", ...]}.'),
]

SYSTEM = (
    "You are a disciplined equity-research assistant. You answer ONLY from the numbered document "
    "excerpts provided — a single company's own annual report and earnings-call transcripts. Cite the "
    "excerpt number(s) you use in square brackets like [2]. Do NOT use any outside knowledge or memory. "
    "If the excerpts do not contain the answer, set notFound true and leave content empty. "
    'Respond ONLY as JSON: {"notFound": <bool>, "used": [<excerpt numbers you cited>], "content": <see instruction>}.'
)


def _gemini():
    from google import genai
    from google.genai import types
    return genai.Client(http_options=types.HttpOptions(timeout=45_000)), types


def gemini_json(client, types, user, model, strong, system=SYSTEM, max_tokens=1200):
    from google.genai import errors as genai_errors
    cfg = types.GenerateContentConfig(
        system_instruction=system, response_mime_type="application/json", temperature=0,
        max_output_tokens=max_tokens,
        # strong model is a thinking model — turn thinking off to keep it fast + free.
        thinking_config=types.ThinkingConfig(thinking_budget=0) if strong else None,
    )
    for attempt in range(5):
        try:
            r = client.models.generate_content(model=model, contents=user, config=cfg)
            u = r.usage_metadata
            it = getattr(u, "prompt_token_count", 0) or 0
            ot = getattr(u, "candidates_token_count", 0) or 0
            m = re.search(r"\{.*\}", r.text or "", re.S)
            return (json.loads(m.group(0)) if m else {}), it, ot
        except (genai_errors.ClientError, genai_errors.ServerError) as e:
            code = getattr(e, "code", None)
            if code in (500, 503, 504) and attempt < 4:  # transient — back off and retry
                time.sleep(5 * (attempt + 1))
                continue
            raise  # 429 (quota) etc. -> caller decides (fall back to the cheap model)
    return {}, 0, 0


def retrieve(ticker, queries, k):
    """Merge BM25 hits across queries; keep the best score per chunk; return top-k."""
    best = {}
    for qi, q in enumerate(queries):
        for r in search(ticker, q, k):
            key = (r["docType"], r["period"], r["page"], r["text"][:40])
            if key not in best or r["score"] > best[key]["score"]:
                best[key] = r
    ranked = sorted(best.values(), key=lambda r: r["score"], reverse=True)[:k]
    return ranked


def cite_label(r):
    dt = "Annual Report" if r["docType"] == "annual_report" else "Concall"
    return f'{dt} · {r["period"]} · p.{r["page"]}'


def build_context(chunks):
    lines = []
    for i, r in enumerate(chunks, 1):
        snippet = re.sub(r"\s+", " ", r["text"]).strip()[:700]
        lines.append(f"[{i}] ({cite_label(r)})\n{snippet}")
    return "\n\n".join(lines)


def run_section(client, types, ticker, sec, models):
    sid, title, tier, queries, instruction = sec
    chunks = retrieve(ticker, queries, TOP_K)
    if not chunks:
        return {"title": title, "model": None, "notFound": True, "content": None, "citations": []}, 0, 0
    user = (f"{instruction}\n\nDocument excerpts for {ticker} (cite by number):\n\n"
            f"{build_context(chunks)}")
    empty = ({"title": title, "model": None, "notFound": True, "content": None, "citations": []}, 0, 0)
    model = models[tier]
    try:
        data, it, ot = gemini_json(client, types, user, model, strong=(tier == "strong"))
    except Exception as e:
        # Strong model free-tier quota exhausted (429) -> fall back to the cheap model.
        if tier == "strong":
            print(f"      {sid}: strong failed ({str(e)[:45]}) -> flash-lite fallback")
            try:
                model = models["cheap"]
                data, it, ot = gemini_json(client, types, user, model, strong=False)
            except Exception:
                return empty
        else:
            return empty
    used = list(data.get("used") or [])
    # structured (financial) content carries its source per metric in "n" — collect those too
    if isinstance(data.get("content"), list):
        for item in data["content"]:
            if isinstance(item, dict) and isinstance(item.get("n"), int):
                used.append(item["n"])
    if not used:
        used = list(range(1, len(chunks) + 1))
    citations = []
    seen = set()
    for n in used:
        if isinstance(n, int) and 1 <= n <= len(chunks) and n not in seen:
            seen.add(n)
            r = chunks[n - 1]
            citations.append({"n": n, "docType": r["docType"], "period": r["period"],
                              "page": r["page"], "source": r["source"],
                              "snippet": re.sub(r"\s+", " ", r["text"]).strip()[:240]})
    return ({"title": title, "model": model, "notFound": bool(data.get("notFound")),
             "content": data.get("content"), "citations": citations}, it, ot)


def process(ticker, force):
    ticker = ticker.upper()
    try:
        load_chunks(ticker)
    except FileNotFoundError:
        print(f"  ✗ {ticker}: no fundamentals — run fetch_fundamentals.py {ticker} first")
        return
    cfg = load_config()
    models = {"cheap": cfg["models"]["gemini"], "strong": cfg["models"]["geminiStrong"]}
    meta_path = FUND_DIR / ticker / "meta.json"
    meta = json.loads(meta_path.read_text()) if meta_path.exists() else {}

    out_path = RESEARCH_DIR / f"{ticker}.json"
    doc = {}
    if out_path.exists() and not force:
        try:
            doc = json.loads(out_path.read_text())
        except json.JSONDecodeError:
            doc = {}
    sections = doc.get("sections", {})

    RESEARCH_DIR.mkdir(parents=True, exist_ok=True)
    client, types = _gemini()
    in_tok = out_tok = 0
    print(f"{ticker}: researching ({sum(1 for s,*_ in SECTIONS if s not in sections)} new sections)")
    for sec in SECTIONS:
        sid = sec[0]
        if sid in sections and not force:
            print(f"  · {sid:<20} cached")
            continue
        rec, it, ot = run_section(client, types, ticker, sec, models)
        in_tok += it; out_tok += ot
        sections[sid] = rec
        flag = "not found" if rec["notFound"] else f'{len(rec["citations"])} cites'
        print(f"  ✓ {sid:<20} {flag}  (in {in_tok} / out {out_tok})")
        time.sleep(1.0)

    doc = {
        "ticker": ticker, "name": meta.get("ticker", ticker),
        "generatedAt": datetime.now().astimezone().isoformat(),
        "docsUsed": [{"docType": d["docType"], "period": d["period"], "source": d["source"]}
                     for d in meta.get("docs", [])],
        "models": models, "sections": sections,
        "tokens": {"input": in_tok, "output": out_tok}, "costUSD": 0.0,
    }
    out_path.write_text(json.dumps(doc, indent=2) + "\n")
    print(f"  -> {out_path}  | tokens {in_tok+out_tok:,}  | $0.00 (Gemini free tier)\n")


def main():
    ap = argparse.ArgumentParser(description="Build grounded research sections (primary docs only).")
    ap.add_argument("tickers", nargs="+")
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()
    import os
    if not os.environ.get("GEMINI_API_KEY"):
        print("No GEMINI_API_KEY in ../.env — cannot run research.")
        sys.exit(1)
    for t in args.tickers:
        try:
            process(t, args.force)
        except Exception as e:
            print(f"  ✗ {t}: {str(e)[:90]}")


if __name__ == "__main__":
    main()
