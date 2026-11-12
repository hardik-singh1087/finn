"""classify_announcements.py — put each filing into ONE of the 16 categories + score it.

Two engines:
  --engine anthropic : a CHEAP model (claude-haiku-5-5) classifies in BATCHES. Reports real token
                       usage + cost. Needs ANTHROPIC_API_KEY (in ../.env or the shell).
  --engine rules     : deterministic keyword/subject fallback. Zero cost, no key — keeps the demo
                       runnable and doubles as the cheap pre-filter.
  --engine auto      : anthropic if a key is present, else rules (default).

Caching: every result is cached by announcement id in data/announcements/_classify_cache.json, and
written back into the per-ticker files. A re-run never re-classifies (never re-pays for) a cached id.

Importance (0-100) drives the feed: category weight (config) blended with the model's materiality,
plus a recency bump and a few keyword bumps, so the big, fresh items float to the top.

Outputs: enriches data/announcements/<T>.json (type/summary/importance) and writes
data/announcements/_classify_report.json (engine, model, tokens, cost).

Usage:
    python scripts/classify_announcements.py                 # auto engine, all portfolio
    python scripts/classify_announcements.py --engine rules  # force zero-cost fallback
    python scripts/classify_announcements.py --force RELIANCE # re-classify one ticker, ignore cache

See ../CLAUDE.md (Phase 1).
"""
from __future__ import annotations

import argparse
import glob
import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from config import load_config, DATA_DIR  # noqa: E402

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent.parent.parent / ".env")
except Exception:
    pass

ANN_DIR = DATA_DIR / "announcements"
CACHE_PATH = ANN_DIR / "_classify_cache.json"
REPORT_PATH = ANN_DIR / "_classify_report.json"
BATCH_SIZE = 18
TEXT_SNIPPET = 320

# Claude Haiku 5.5 pricing (USD per 1M tokens, prompts <=100K). Source: claude-api skill, 2026-10.
HAIKU_IN_PER_M = 0.10
HAIKU_OUT_PER_M = 0.50

VALID = {
    "results", "M&A", "fund_raise", "management_change", "litigation", "insider_trading",
    "earnings_call", "investor_meetings", "credit_rating", "dividend", "bonus_split",
    "capex", "press_release", "postal_ballot", "agm_egm", "pledging", "unclassified",
}

# Short definitions — reused in the model prompt.
CATEGORY_DEFS = {
    "results": "quarterly/annual results and the board meeting approving them",
    "M&A": "buying/selling/merging companies or stakes; demerger; JV; scheme of arrangement",
    "fund_raise": "raising money: rights issue, QIP, preferential allotment, buyback, debt",
    "management_change": "CEO/CFO/MD/director/KMP joins, resigns, retires, or is appointed",
    "litigation": "lawsuits, fines, regulator orders, insolvency/CIRP, disputes",
    "insider_trading": "a promoter/insider buying or selling their OWN shares",
    "earnings_call": "the earnings/conference call notice, transcript, or recording",
    "investor_meetings": "meetings with specific investors or attending an investor conference",
    "credit_rating": "a credit rating assigned, upgraded, downgraded, or reaffirmed",
    "dividend": "a cash dividend with a record date",
    "bonus_split": "bonus shares or a stock split",
    "capex": "approving spend on a new plant, facility, or capacity expansion",
    "press_release": "order wins, new products, partnerships, rumour/news denials (if not another type)",
    "postal_ballot": "shareholders voting by postal ballot (notice or result)",
    "agm_egm": "AGM/EGM notice or result",
    "pledging": "a promoter pledging, releasing, or revoking pledge on shares",
    "unclassified": "routine paperwork: ESOP, compliance certificate, trading window, ESG, auditor",
}

# --------------------------------------------------------------- rules engine

# NSE subject -> category when unambiguous.
SUBJECT_MAP = {
    "credit rating": "credit_rating",
    "change in management": "management_change",
    "resignation": "management_change",
    "retirement": "management_change",
    "appointment": "management_change",
    "change in director": "management_change",
    "acquisition": "M&A",
    "amalgamation": "M&A",
    "scheme of arrangement": "M&A",
    "sale or disposal": "M&A",
    "corporate insolvency": "litigation",
    "action(s) taken or orders passed": "litigation",
    "pendency of litigation": "litigation",
    "shareholders meeting": "agm_egm",
    "postal ballot": "postal_ballot",
    "bagging/receiving of orders": "press_release",
    "rumour verification": "press_release",
    "news verification": "press_release",
    "monitoring agency": "fund_raise",
    "trading window": "unclassified",
    "esop": "unclassified",
    "esos": "unclassified",
    "esps": "unclassified",
    "certificate under sebi": "unclassified",
    "options to purchase securities": "unclassified",
}

KEYWORDS = [  # (regex, category) — checked against subject + rawText, first match wins
    (r"\b(q[1-4]|quarter|half[- ]year|annual) ?(result|financial)|financial results|un-?audited", "results"),
    (r"\bbuy[- ]?back|rights issue|\bqip\b|qualified institution|preferential (issue|allotment)|debentures|commercial paper", "fund_raise"),
    (r"\bmerger|amalgamat|demerger|acqui|joint venture|\bstake\b|slump sale|scheme of arrangement", "M&A"),
    (r"\bcredit rating|rating (agency|action)|\bcrisil|icra|care ratings|india ratings", "credit_rating"),
    (r"resign|retire|appoint|cessation|\bceo\b|\bcfo\b|managing director|\bkmp\b|director", "management_change"),
    (r"insolvency|\bnclt\b|\bsat\b|penalty|show cause|\bfine\b|litigation|dispute|order passed", "litigation"),
    (r"\bdividend\b", "dividend"),
    (r"bonus (issue|share)|stock split|sub-?division of shares", "bonus_split"),
    (r"pledge|invoc|encumbr", "pledging"),
    (r"new plant|capacity expansion|\bcapex\b|greenfield|brownfield|commission.*(plant|facility)", "capex"),
    (r"\bagm\b|\begm\b|annual general|extraordinary general", "agm_egm"),
    (r"postal ballot", "postal_ballot"),
    (r"earnings call|con(ference|\.)? call|\bconcall\b|transcript|audio recording", "earnings_call"),
    (r"investor (meet|conference|presentation|day)|analyst meet|road ?show", "investor_meetings"),
    (r"order win|bagg|received an order|letter of (award|intent)|new product|partnership|collaborat", "press_release"),
    (r"allotment of (securities|shares|equity)", "fund_raise"),
]


def rules_classify(subject: str, text: str) -> str:
    s = subject.lower()
    for key, cat in SUBJECT_MAP.items():
        if key in s:
            return cat
    blob = f"{subject}\n{text}".lower()
    # The combined "Investor Meet/Con. Call" subject is usually a meeting intimation, not an
    # actual earnings call — only treat it as earnings_call when the text really says so.
    if "investor meet" in s or "institutional investor" in s:
        if re.search(r"transcript|audio recording|earnings call|results.*con|con.*call.*(q[1-4]|result)", blob):
            return "earnings_call"
        return "investor_meetings"
    for pat, cat in KEYWORDS:
        if re.search(pat, blob):
            return cat
    if "board meeting" in s:
        return "results" if re.search(r"result|financial", blob) else "unclassified"
    return "unclassified"


def rules_summary(subject: str, text: str) -> str:
    snippet = (text or subject).strip().split("\n")[0]
    return (snippet[:90] + "…") if len(snippet) > 90 else snippet


# --------------------------------------------------------------- importance

def score(cat: str, when_iso: str, weights: dict, model_imp: int | None) -> int:
    base = weights.get(cat, 5)
    if model_imp is not None:
        base = round(0.65 * base + 0.35 * max(0, min(100, model_imp)))
    try:
        when = datetime.fromisoformat(when_iso)
        days_old = (datetime.now(timezone.utc) - when.astimezone(timezone.utc)).days
        recency = max(0.0, 10.0 - days_old / 3.0)
    except Exception:
        recency = 0.0
    return max(1, min(100, round(base + recency)))


# --------------------------------------------------------------- anthropic engine

SYSTEM = (
    "You classify Indian (NSE/BSE) corporate filings. For each item pick EXACTLY ONE category "
    "from this list and nothing else:\n"
    + "\n".join(f"- {k}: {v}" for k, v in CATEGORY_DEFS.items())
    + "\nAlso write a <=12 word plain-English summary for an investor, and an importance 0-100 "
    "(how much it should move the stock / earn attention). Respond with ONLY a JSON array, one "
    'object per item: {"id": "<id>", "type": "<category>", "summary": "<text>", "importance": <int>}.'
)


def build_user_msg(batch: list[dict]) -> str:
    lines = []
    for a in batch:
        text = (a.get("rawText") or "").replace("\n", " ")[:TEXT_SNIPPET]
        lines.append(f'id={a["id"]} | SUBJECT: {a.get("title","")} | TEXT: {text}')
    return "Classify these filings:\n\n" + "\n\n".join(lines)


def anthropic_classify(batches, model):
    import anthropic
    client = anthropic.Anthropic()
    results: dict[str, dict] = {}
    in_tok = out_tok = 0
    for bi, batch in enumerate(batches, 1):
        resp = client.messages.create(
            model=model, max_tokens=1600, system=SYSTEM,
            messages=[{"role": "user", "content": build_user_msg(batch)}],
        )
        in_tok += resp.usage.input_tokens
        out_tok += resp.usage.output_tokens
        txt = resp.content[0].text if resp.content else ""
        m = re.search(r"\[.*\]", txt, re.S)
        parsed = json.loads(m.group(0)) if m else []
        got = {o["id"]: o for o in parsed if isinstance(o, dict) and "id" in o}
        for a in batch:
            o = got.get(a["id"])
            cat = o.get("type") if o else None
            if cat not in VALID:  # per-item fallback keeps the run robust
                cat = rules_classify(a.get("title", ""), a.get("rawText", ""))
                o = None
            results[a["id"]] = {
                "type": cat,
                "summary": (o.get("summary") if o else rules_summary(a.get("title", ""), a.get("rawText", ""))),
                "_model_imp": (o.get("importance") if o else None),
            }
        print(f"  batch {bi}/{len(batches)}: {len(batch)} items  (in {in_tok} / out {out_tok} tok)")
    return results, in_tok, out_tok


# --------------------------------------------------------------- gemini engine (free tier)

def _assign(batch: list[dict], parsed: list, results: dict) -> None:
    """Map a model's JSON array back onto the batch; fall back to rules per item."""
    got = {o["id"]: o for o in parsed if isinstance(o, dict) and "id" in o}
    for a in batch:
        o = got.get(a["id"])
        cat = o.get("type") if o else None
        if cat not in VALID:
            cat = rules_classify(a.get("title", ""), a.get("rawText", ""))
            o = None
        results[a["id"]] = {
            "type": cat,
            "summary": (o.get("summary") if o else rules_summary(a.get("title", ""), a.get("rawText", ""))),
            "_model_imp": (o.get("importance") if o else None),
        }


def gemini_classify(batches, model, delay: float = 2.0):
    """Classify with Gemini (gemini-2.0-flash) on the FREE tier. Reads GEMINI_API_KEY.
    Forces JSON output, reports real token usage, and paces requests under the free RPM."""
    from google import genai
    from google.genai import types
    from google.genai import errors as genai_errors

    # 30s per-request cap so a stuck call fails fast instead of hanging on SDK retries.
    client = genai.Client(http_options=types.HttpOptions(timeout=30_000))
    gcfg = types.GenerateContentConfig(
        system_instruction=SYSTEM,
        response_mime_type="application/json",
        temperature=0,
    )
    results: dict[str, dict] = {}
    in_tok = out_tok = 0
    MAX_TRIES = 5
    for bi, batch in enumerate(batches, 1):
        txt = ""
        for attempt in range(MAX_TRIES):
            try:
                resp = client.models.generate_content(
                    model=model, contents=build_user_msg(batch), config=gcfg)
                u = resp.usage_metadata
                in_tok += (getattr(u, "prompt_token_count", 0) or 0)
                out_tok += (getattr(u, "candidates_token_count", 0) or 0)
                txt = resp.text or ""
                break
            except (genai_errors.ClientError, genai_errors.ServerError) as e:
                code = getattr(e, "code", None)
                # 429 = free-tier rate limit (long backoff); 500/503 = transient overload (short).
                retriable = code in (429, 500, 503)
                if retriable and attempt < MAX_TRIES - 1:
                    wait = (15 if code == 429 else 4) * (attempt + 1)
                    print(f"    batch {bi}: {code}, retry in {wait}s…")
                    time.sleep(wait)
                    continue
                print(f"    batch {bi}: giving up on model ({code}) — rules fallback for these {len(batch)} items")
                txt = ""  # _assign will rules-classify every item in this batch
                break
        m = re.search(r"\[.*\]", txt, re.S)
        parsed = json.loads(m.group(0)) if m else []
        _assign(batch, parsed, results)
        print(f"  batch {bi}/{len(batches)}: {len(batch)} items  (in {in_tok} / out {out_tok} tok)")
        if bi < len(batches):
            time.sleep(delay)  # pace requests under the free-tier limit
    return results, in_tok, out_tok


# --------------------------------------------------------------- driver

def load_cache() -> dict:
    if CACHE_PATH.exists():
        try:
            return json.loads(CACHE_PATH.read_text())
        except json.JSONDecodeError:
            return {}
    return {}


def main() -> None:
    ap = argparse.ArgumentParser(description="Classify announcements into the 16 categories.")
    ap.add_argument("--engine", choices=["auto", "gemini", "anthropic", "rules"], default="auto")
    ap.add_argument("--force", action="store_true", help="ignore cache, re-classify")
    ap.add_argument("tickers", nargs="*", help="limit to these tickers")
    args = ap.parse_args()

    cfg = load_config()
    weights = {c["id"]: c["weight"] for c in cfg["categories"]}

    have = {
        "gemini": bool(os.environ.get("GEMINI_API_KEY")),
        "anthropic": bool(os.environ.get("ANTHROPIC_API_KEY")),
    }
    engine = args.engine
    if engine == "auto":  # default bulk engine comes from config (gemini)
        engine = cfg["models"].get("bulkEngine", "gemini")
    if engine in have and not have[engine]:  # chosen engine has no key — degrade gracefully
        key = "GEMINI_API_KEY" if engine == "gemini" else "ANTHROPIC_API_KEY"
        alt = "anthropic" if engine == "gemini" else "gemini"
        if have.get(alt):
            print(f"No {key} in ../.env — using the {alt} engine instead.")
            engine = alt
        else:
            print(f"No {key} in ../.env — falling back to the zero-cost rules engine.")
            engine = "rules"

    is_model = engine in ("gemini", "anthropic")
    model = {"gemini": cfg["models"]["gemini"], "anthropic": cfg["models"]["cheap"]}.get(engine)

    files = sorted(glob.glob(str(ANN_DIR / "*.json")))
    files = [f for f in files if not Path(f).name.startswith("_")]
    if args.tickers:
        want = {t.upper() for t in args.tickers}
        files = [f for f in files if Path(f).stem.upper() in want]

    per_file = {f: json.loads(Path(f).read_text()) for f in files}
    cache = {} if args.force else load_cache()

    todo = [a for items in per_file.values() for a in items
            if args.force or a["id"] not in cache]
    total = sum(len(v) for v in per_file.values())
    print(f"Engine: {engine} ({model or 'no model'}) | "
          f"{len(todo)} to classify, {total - len(todo)} cached.\n")

    in_tok = out_tok = 0
    fresh: dict[str, dict] = {}
    if todo:
        if is_model:
            batches = [todo[i:i + BATCH_SIZE] for i in range(0, len(todo), BATCH_SIZE)]
            if engine == "gemini":
                fresh, in_tok, out_tok = gemini_classify(batches, model)
            else:
                fresh, in_tok, out_tok = anthropic_classify(batches, model)
        else:
            for a in todo:
                cat = rules_classify(a.get("title", ""), a.get("rawText", ""))
                fresh[a["id"]] = {"type": cat,
                                  "summary": rules_summary(a.get("title", ""), a.get("rawText", "")),
                                  "_model_imp": None}

    # merge fresh into cache, then write enrichment back into the per-ticker files
    for aid, r in fresh.items():
        cache[aid] = {"type": r["type"], "summary": r["summary"], "engine": engine, "model": model}

    for f, items in per_file.items():
        for a in items:
            c = cache.get(a["id"])
            if not c:
                continue
            a["type"] = c["type"]
            a["summary"] = c["summary"]
            model_imp = fresh.get(a["id"], {}).get("_model_imp")
            a["importance"] = score(c["type"], a["date"], weights, model_imp)
        items.sort(key=lambda x: (x.get("importance", 0), x["date"]), reverse=True)
        Path(f).write_text(json.dumps(items, indent=2) + "\n")

    CACHE_PATH.write_text(json.dumps(cache, indent=2) + "\n")

    if engine == "anthropic":
        cost = round(in_tok / 1e6 * HAIKU_IN_PER_M + out_tok / 1e6 * HAIKU_OUT_PER_M, 4)
        price, tier = {"input": HAIKU_IN_PER_M, "output": HAIKU_OUT_PER_M}, "paid"
    elif engine == "gemini":
        cost, price, tier = 0.0, {"input": 0.0, "output": 0.0}, "free"
    else:
        cost, price, tier = 0.0, None, "none"

    report = {
        "generatedAt": datetime.now().astimezone().isoformat(),
        "engine": engine,
        "model": model,
        "tier": tier,
        "classifiedNow": len(fresh),
        "cachedSkipped": total - len(todo),
        "batches": ((len(todo) + BATCH_SIZE - 1) // BATCH_SIZE) if (is_model and todo) else 0,
        "inputTokens": in_tok,
        "outputTokens": out_tok,
        "totalTokens": in_tok + out_tok,
        "pricePer1M": price,
        "costUSD": cost,
    }
    REPORT_PATH.write_text(json.dumps(report, indent=2) + "\n")
    print(f"\nDone. classified {len(fresh)} now, {report['cachedSkipped']} cached.")
    if is_model:
        unit = "$0.00 (Gemini free tier)" if engine == "gemini" else f"${cost}"
        print(f"Tokens: in {in_tok:,} + out {out_tok:,} = {in_tok + out_tok:,}  |  cost {unit}")
    print(f"Report -> {REPORT_PATH}")


if __name__ == "__main__":
    main()
