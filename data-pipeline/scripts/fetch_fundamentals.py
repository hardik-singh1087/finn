"""fetch_fundamentals.py — PRIMARY documents for the Pull/research side.

For any NSE stock, find + download its OWN documents from screener.in:
  - the latest Annual Report (PDF)
  - the last ~4 earnings-call Transcripts (PDF)
...turn them into clean text, chunk them with page numbers, and save. PRIMARY SOURCES ONLY —
no news, no broker notes. The search layer (search_fundamentals.py) runs over these chunks.

Caching: raw PDFs cached under data/fundamentals/<T>/raw/ (gitignored); extracted chunks +
meta committed. Nothing is downloaded or re-parsed twice unless --force.

Output per ticker (data/fundamentals/<T>/):
  meta.json    -> {ticker, screener, fetchedAt, docs:[{docType, period, source, pages, file}]}
  chunks.json  -> ResearchChunk[]  {id, ticker, docType, period, source, page, text}

Usage:
  python scripts/fetch_fundamentals.py                 # the demo set (research + a few mains)
  python scripts/fetch_fundamentals.py RELIANCE TCS    # specific tickers (any NSE symbol)
  python scripts/fetch_fundamentals.py --transcripts 4 --force

See ../CLAUDE.md (Phase 1 step 4 / Phase 3).
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import re
import sys
import time
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import requests
from bs4 import BeautifulSoup
from pypdf import PdfReader

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from config import load_config, DATA_DIR  # noqa: E402

FUND_DIR = DATA_DIR / "fundamentals"
IST = ZoneInfo("Asia/Kolkata")
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36")
CHUNK_CHARS = 1000
CHUNK_OVERLAP = 150

# Default demo set: the 5 research tickers + a few mains, so the demo is instant.
DEMO_MAINS = ["RELIANCE", "TCS", "INFY"]


def screener_slug(company: dict) -> str:
    return company.get("screener", company["ticker"])


# ---------------------------------------------------------------- screener scrape

def fetch_screener(slug: str, session: requests.Session) -> BeautifulSoup | None:
    for path in (f"{slug}/consolidated/", f"{slug}/"):
        r = session.get(f"https://www.screener.in/company/{path}", timeout=25)
        if r.status_code == 200 and "Annual Report" in r.text:
            return BeautifulSoup(r.text, "lxml")
    return None


def parse_docs(soup: BeautifulSoup, n_transcripts: int) -> dict:
    """Return {'annual_report': (period, url) | None, 'transcripts': [(period, url), ...]}."""
    # Annual reports: latest year wins.
    ars: list[tuple[int, str]] = []
    for a in soup.find_all("a"):
        m = re.search(r"Annual Report\s+(\d{4})", a.get_text(" ", strip=True))
        if m and a.get("href", "").lower().endswith(".pdf"):
            ars.append((int(m.group(1)), a["href"]))
    latest_ar = None
    if ars:
        yr, url = max(ars, key=lambda x: x[0])
        latest_ar = (f"FY{yr}", url)

    # Concall transcripts: rows with a "Transcript" link, newest first.
    transcripts: list[tuple[str, str]] = []
    concalls = soup.select_one(".concalls")
    if concalls:
        for li in concalls.find_all("li"):
            label = re.search(r"([A-Z][a-z]{2}\s+\d{4})", li.get_text(" ", strip=True))
            tlink = next((a for a in li.find_all("a")
                          if a.get_text(strip=True).lower() == "transcript"
                          and a.get("href", "").lower().endswith(".pdf")), None)
            if label and tlink:
                transcripts.append((label.group(1), tlink["href"]))
    return {"annual_report": latest_ar, "transcripts": transcripts[:n_transcripts]}


# ---------------------------------------------------------------- download + extract

def download_pdf(url: str, dest: Path, session: requests.Session) -> bool:
    """Cached download. Returns True if a valid PDF is on disk."""
    if dest.exists() and dest.stat().st_size > 1000:
        return True
    try:
        r = session.get(url, headers={"Referer": "https://www.bseindia.com/"}, timeout=40)
        if r.status_code == 200 and r.content[:4] == b"%PDF":
            dest.write_bytes(r.content)
            return True
        print(f"      ! not a PDF ({r.status_code}) {url[:70]}")
    except Exception as e:
        print(f"      ! download failed: {str(e)[:70]}")
    return False


def extract_pages(pdf_path: Path) -> list[tuple[int, str]]:
    """(page_number, text) per page. pypdf first; pdfplumber fallback for empty pages."""
    out: list[tuple[int, str]] = []
    try:
        reader = PdfReader(str(pdf_path))
    except Exception as e:
        print(f"      ! unreadable PDF: {str(e)[:60]}")
        return out
    empties = []
    for i, page in enumerate(reader.pages, 1):
        try:
            txt = page.extract_text() or ""
        except Exception:
            txt = ""
        if txt.strip():
            out.append((i, txt))
        else:
            empties.append(i)
    if empties and len(empties) > len(reader.pages) * 0.5:
        out = _pdfplumber_pages(pdf_path) or out  # likely scanned — try the heavier extractor
    return out


def _pdfplumber_pages(pdf_path: Path) -> list[tuple[int, str]]:
    try:
        import pdfplumber
    except Exception:
        return []
    out = []
    try:
        with pdfplumber.open(str(pdf_path)) as pdf:
            for i, page in enumerate(pdf.pages, 1):
                txt = page.extract_text() or ""
                if txt.strip():
                    out.append((i, txt))
    except Exception:
        return []
    return out


def chunk_pages(pages: list[tuple[int, str]], ticker: str, doc_type: str, period: str,
                source: str) -> list[dict]:
    chunks = []
    for page_no, text in pages:
        clean = re.sub(r"[ \t]+", " ", re.sub(r"\n{2,}", "\n", text)).strip()
        start = 0
        while start < len(clean):
            piece = clean[start:start + CHUNK_CHARS].strip()
            if len(piece) >= 60:  # skip tiny fragments
                cid = hashlib.sha1(f"{ticker}|{doc_type}|{period}|{page_no}|{start}".encode()).hexdigest()[:16]
                chunks.append({
                    "id": cid, "ticker": ticker, "docType": doc_type, "period": period,
                    "source": source, "page": page_no, "text": piece,
                })
            start += CHUNK_CHARS - CHUNK_OVERLAP
    return chunks


# ---------------------------------------------------------------- per ticker

def process_ticker(company: dict, n_transcripts: int, session: requests.Session,
                   force: bool) -> None:
    ticker = company["ticker"]
    slug = screener_slug(company)
    out_dir = FUND_DIR / ticker
    raw_dir = out_dir / "raw"
    chunks_path = out_dir / "chunks.json"

    if chunks_path.exists() and not force:
        n = len(json.loads(chunks_path.read_text()))
        print(f"  · {ticker:<12} cached ({n} chunks) — skip")
        return

    soup = fetch_screener(slug, session)
    if not soup:
        print(f"  ✗ {ticker:<12} screener page not found (slug={slug})")
        return
    docs = parse_docs(soup, n_transcripts)
    raw_dir.mkdir(parents=True, exist_ok=True)

    todo: list[tuple[str, str, str]] = []  # (docType, period, url)
    if docs["annual_report"]:
        todo.append(("annual_report", docs["annual_report"][0], docs["annual_report"][1]))
    for period, url in docs["transcripts"]:
        todo.append(("concall_transcript", period, url))

    all_chunks: list[dict] = []
    meta_docs: list[dict] = []
    for doc_type, period, url in todo:
        fname = f"{doc_type}_{period.replace(' ', '')}.pdf"
        dest = raw_dir / fname
        if not download_pdf(url, dest, session):
            continue
        pages = extract_pages(dest)
        chunks = chunk_pages(pages, ticker, doc_type, period, url)
        all_chunks.extend(chunks)
        meta_docs.append({"docType": doc_type, "period": period, "source": url,
                          "pages": len(pages), "chunks": len(chunks), "file": f"raw/{fname}"})
        print(f"      {doc_type:<18} {period:<9} {len(pages):>4} pages -> {len(chunks)} chunks")
        time.sleep(1.0)

    if not all_chunks:
        print(f"  ✗ {ticker:<12} no documents extracted")
        return

    # Compact JSON — this is generated data; keeps the committed store small.
    chunks_path.write_text(json.dumps(all_chunks, separators=(",", ":")))
    (out_dir / "meta.json").write_text(json.dumps({
        "ticker": ticker, "screener": slug, "fetchedAt": datetime.now(IST).isoformat(),
        "docs": meta_docs, "totalChunks": len(all_chunks),
    }, indent=2) + "\n")
    print(f"  ✓ {ticker:<12} {len(meta_docs)} docs, {len(all_chunks)} chunks -> {out_dir}")


def main() -> None:
    ap = argparse.ArgumentParser(description="Fetch primary research docs (screener.in).")
    ap.add_argument("tickers", nargs="*", help="NSE tickers (default: the demo set)")
    ap.add_argument("--transcripts", type=int, default=4, help="how many recent transcripts (default 4)")
    ap.add_argument("--force", action="store_true", help="re-download + re-parse")
    args = ap.parse_args()

    cfg = load_config()
    by_ticker = {c["ticker"]: c for c in cfg["portfolio"] + cfg["researchTickers"]}

    if args.tickers:
        wanted = [t.upper() for t in args.tickers]
    else:  # demo set: the 5 research tickers + a few mains
        wanted = [c["ticker"] for c in cfg["researchTickers"]] + DEMO_MAINS

    FUND_DIR.mkdir(parents=True, exist_ok=True)
    session = requests.Session()
    session.headers.update({"User-Agent": UA, "Accept-Language": "en-US,en;q=0.9"})

    print(f"Fetching fundamentals for {len(wanted)} tickers (latest AR + {args.transcripts} transcripts)\n")
    for t in wanted:
        company = by_ticker.get(t, {"ticker": t})  # unknown ticker still works (generic)
        try:
            process_ticker(company, args.transcripts, session, args.force)
        except Exception as e:
            print(f"  ✗ {t:<12} error: {str(e)[:80]}")
        time.sleep(1.5)


if __name__ == "__main__":
    main()
