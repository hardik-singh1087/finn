# data-pipeline/

Python scripts that download public data and save it as JSON/text into `../data/`.
This is plumbing — run it occasionally, commit the output, and the app runs offline.

## Setup

```bash
cd data-pipeline
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Model calls (summaries, research) read `ANTHROPIC_API_KEY` from `../.env` — optional, only
needed when you (re)generate the cached outputs.

## Scripts (run in this order)

| Script | Reads | Writes | Model |
|---|---|---|---|
| `scripts/fetch_prices.py` | yfinance | `data/prices/<T>.json` | — |
| `scripts/fetch_announcements.py` | NSE/BSE | `data/announcements/<T>.json` (raw) | — |
| `scripts/classify_announcements.py` | raw announcements | same, `type` + `summary` filled | cheap |
| `scripts/fetch_fundamentals.py` | screener.in | `data/fundamentals/<T>/...` | — |
| `scripts/build_feed.py` | prices + announcements | `data/feed/latest.json` | cheap |
| `scripts/research.py <TICKER>` | `data/fundamentals/<T>` | `data/research/<T>.json` (cached) | mid / strong |

> All scripts are **stubs right now** — contracts documented, logic TODO. We build them in the
> order above once the scaffold is approved (see `../CLAUDE.md`).

## Cost discipline

- Route by difficulty: cheap model for classification + one-line summaries, strong model only
  for the promised-vs-delivered reasoning. Routing table lives in `config/finn.config.json`.
- **Cache everything.** Key by content hash; skip the call if the cached file exists.
