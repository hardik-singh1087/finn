"""enrich.py — push-side 'extra detail' for two announcement types (cheap model, cached).

  1. management_change -> a short background/bio of the person (this is the PUSH side, so
     outside knowledge like LinkedIn/press is allowed — unlike the Pull/research side).
  2. results -> pull Revenue / EBITDA / PBT / PAT from the actual results PDF and compute
     QoQ (vs previous quarter) and YoY (vs same quarter last year).

Engine: Gemini FREE tier (gemini-3.5-flash-lite) — same cheap model as classification.
Cache: data/enrichment.json keyed by announcement id; a cached id is never re-done (never re-paid).

Usage:
  python scripts/enrich.py                 # all mgmt_change + recent results, skip cached
  python scripts/enrich.py --force
  python scripts/enrich.py --kinds results

See ../CLAUDE.md (Phase 2 — push enrichment).
"""
from __future__ import annotations

import argparse
import glob
import io
import json
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path

import requests
from pypdf import PdfReader

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from config import load_config, DATA_DIR  # noqa: E402

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent.parent.parent / ".env")
except Exception:
    pass

ANN_DIR = DATA_DIR / "announcements"
ENRICH_PATH = DATA_DIR / "enrichment.json"
REPORT_PATH = DATA_DIR / "enrichment_report.json"
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36")
RESULTS_PER_TICKER = 2  # only the newest couple of results filings per ticker


# ---------------------------------------------------------------- gemini helper

def _gemini():
    from google import genai
    from google.genai import types
    client = genai.Client(http_options=types.HttpOptions(timeout=30_000))
    return client, types


def gemini_json(client, types, system: str, user: str, model: str):
    from google.genai import errors as genai_errors
    cfg = types.GenerateContentConfig(system_instruction=system,
                                      response_mime_type="application/json", temperature=0)
    for attempt in range(5):
        try:
            r = client.models.generate_content(model=model, contents=user, config=cfg)
            u = r.usage_metadata
            it = (getattr(u, "prompt_token_count", 0) or 0)
            ot = (getattr(u, "candidates_token_count", 0) or 0)
            txt = r.text or ""
            m = re.search(r"\{.*\}", txt, re.S)
            return (json.loads(m.group(0)) if m else {}), it, ot
        except (genai_errors.ClientError, genai_errors.ServerError) as e:
            code = getattr(e, "code", None)
            if code in (429, 500, 503) and attempt < 4:
                time.sleep((15 if code == 429 else 4) * (attempt + 1))
                continue
            raise
    return {}, 0, 0


# ---------------------------------------------------------------- management_change

MGMT_SYSTEM = (
    "You enrich an Indian corporate 'management change' filing for an investor's news feed. "
    "From the filing text identify the person and the change. Then add a SHORT background on that "
    "person (2-3 sentences: prior roles, where they came from, notable experience) — you MAY use "
    "general outside knowledge here. If you don't recognise the person, give background as null "
    "rather than inventing specifics. Respond ONLY as JSON: "
    '{"person": "<name|null>", "role": "<role at this company>", '
    '"direction": "joining|resigning|retiring|reappointed", "background": "<2-3 sentences|null>"}.'
)


def enrich_mgmt(client, types, item, model):
    user = f'Company: {item.get("company","")}\nFiling: {item.get("title","")}\n{item.get("rawText","")[:600]}'
    data, it, ot = gemini_json(client, types, MGMT_SYSTEM, user, model)
    if not data.get("person") and not data.get("role"):
        return None, it, ot
    return {"kind": "management_change", "bio": {
        "person": data.get("person"), "role": data.get("role"),
        "direction": data.get("direction"), "background": data.get("background"),
    }}, it, ot


# ---------------------------------------------------------------- results

RESULTS_SYSTEM = (
    "You extract headline numbers from an Indian quarterly results filing. Find these four metrics "
    "for the THREE reported periods — current quarter, the immediately previous quarter, and the "
    "same quarter a year ago:\n"
    "  revenue = revenue from operations / total income\n"
    "  ebitda  = operating profit before interest, tax, depreciation & amortisation; if not stated, "
    "compute from the P&L; null if not derivable\n"
    "  pbt     = profit before tax\n"
    "  pat     = profit after tax / net profit\n"
    "Give raw numbers in a single consistent unit (prefer INR crore). Use null for anything not in "
    "the document. Also give the quarter label (e.g. 'Q2 FY26'). Respond ONLY as JSON: "
    '{"quarter":"<label>","unit":"INR cr",'
    '"revenue":{"current":n,"prev":n,"yearAgo":n},'
    '"ebitda":{"current":n,"prev":n,"yearAgo":n},'
    '"pbt":{"current":n,"prev":n,"yearAgo":n},'
    '"pat":{"current":n,"prev":n,"yearAgo":n}}.'
)


def _pct(cur, base):
    if cur is None or base in (None, 0):
        return None
    return round((cur - base) / abs(base) * 100, 1)


def _metric(d, unit):
    if not isinstance(d, dict):
        return None
    cur = d.get("current")
    return {"current": cur, "qoq": _pct(cur, d.get("prev")),
            "yoy": _pct(cur, d.get("yearAgo")), "unit": unit}


def fetch_pdf_text(url, session):
    try:
        ref = "https://www.nseindia.com/" if "nseindia" in url else "https://www.bseindia.com/"
        r = session.get(url, headers={"Referer": ref}, timeout=40)
        if r.status_code != 200 or r.content[:4] != b"%PDF":
            return ""
        rd = PdfReader(io.BytesIO(r.content))
        return "\n".join((p.extract_text() or "") for p in rd.pages[:8])
    except Exception:
        return ""


def enrich_results(client, types, item, model, session):
    text = fetch_pdf_text(item.get("source", ""), session)
    if len(text) < 1500 or not re.search(r"revenue|total income|profit|tax", text, re.I):
        return None, 0, 0  # intimation / ad, not the actual numbers
    data, it, ot = gemini_json(client, types, RESULTS_SYSTEM, text[:9000], model)
    unit = data.get("unit", "INR cr")
    rev = _metric(data.get("revenue"), unit)
    if not rev or rev.get("current") is None:
        return None, it, ot  # model found no usable numbers
    return {"kind": "results", "results": {
        "quarter": data.get("quarter"), "unit": unit,
        "revenue": rev, "ebitda": _metric(data.get("ebitda"), unit),
        "pbt": _metric(data.get("pbt"), unit), "pat": _metric(data.get("pat"), unit),
    }}, it, ot


# ---------------------------------------------------------------- driver

def main():
    ap = argparse.ArgumentParser(description="Enrich mgmt_change + results announcements (Gemini).")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--kinds", nargs="*", default=["management_change", "results"])
    args = ap.parse_args()

    if not os.environ.get("GEMINI_API_KEY"):
        print("No GEMINI_API_KEY in ../.env — cannot run enrichment. Set it and retry.")
        sys.exit(1)

    cfg = load_config()
    model = cfg["models"]["gemini"]

    store = {}
    if ENRICH_PATH.exists() and not args.force:
        try:
            store = json.loads(ENRICH_PATH.read_text())
        except json.JSONDecodeError:
            store = {}

    # collect targets
    mgmt, results = [], {}
    for f in sorted(glob.glob(str(ANN_DIR / "*.json"))):
        if Path(f).name.startswith("_"):
            continue
        for a in json.loads(Path(f).read_text()):
            if a["type"] == "management_change" and "management_change" in args.kinds:
                mgmt.append(a)
            elif a["type"] == "results" and a.get("source", "").endswith(".pdf") and "results" in args.kinds:
                results.setdefault(a["ticker"], []).append(a)
    # newest N results per ticker
    results_items = []
    for t, items in results.items():
        items.sort(key=lambda x: x["date"], reverse=True)
        results_items.extend(items[:RESULTS_PER_TICKER])

    targets = [("management_change", a) for a in mgmt] + [("results", a) for a in results_items]
    todo = [(k, a) for k, a in targets if args.force or a["id"] not in store]
    print(f"Enrichment (gemini {model}): {len(todo)} to do "
          f"({len(mgmt)} mgmt, {len(results_items)} results), {len(targets) - len(todo)} cached.\n")

    client, types = _gemini()
    session = requests.Session(); session.headers.update({"User-Agent": UA})
    in_tok = out_tok = n_ok = 0
    for i, (kind, a) in enumerate(todo, 1):
        try:
            if kind == "management_change":
                rec, it, ot = enrich_mgmt(client, types, a, model)
            else:
                rec, it, ot = enrich_results(client, types, a, model, session)
        except Exception as e:
            print(f"  ! {a['ticker']:<11} {kind:<17} error: {str(e)[:50]}")
            continue
        in_tok += it; out_tok += ot
        if rec:
            rec.update({"id": a["id"], "ticker": a["ticker"], "model": model})
            store[a["id"]] = rec
            n_ok += 1
            tag = rec.get("bio", {}).get("person") or rec.get("results", {}).get("quarter") or ""
            print(f"  ✓ {a['ticker']:<11} {kind:<17} {tag}")
        else:
            print(f"  · {a['ticker']:<11} {kind:<17} (no usable detail)")
        time.sleep(1.5)

    ENRICH_PATH.write_text(json.dumps(store, indent=2) + "\n")
    REPORT_PATH.write_text(json.dumps({
        "generatedAt": datetime.now().astimezone().isoformat(), "engine": "gemini", "model": model,
        "tier": "free", "enrichedNow": n_ok, "inputTokens": in_tok, "outputTokens": out_tok,
        "totalTokens": in_tok + out_tok, "costUSD": 0.0,
    }, indent=2) + "\n")
    print(f"\nDone. {n_ok} enriched this run, {len(store)} total.")
    print(f"Tokens: in {in_tok:,} + out {out_tok:,} = {in_tok+out_tok:,}  |  cost $0.00 (Gemini free tier)")
    print(f"Store -> {ENRICH_PATH}")


if __name__ == "__main__":
    main()
