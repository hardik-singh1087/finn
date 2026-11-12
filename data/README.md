# data/ — the committed demo store

The Python pipeline writes plain JSON here; the Next.js app reads it. These files are
**committed to the repo on purpose** so the demo always runs with no API calls and no setup.

> Why JSON over SQLite: git-diffable, inspectable, zero native deps on Vercel. (SQLite is an
> easy swap later if we need queries — the store layer in `src/lib/store.ts` would be the only
> thing to change.)

## Layout

```
data/
  prices/<TICKER>.json           # PriceBar[]  — EOD OHLCV, newest last
  announcements/<TICKER>.json    # Announcement[] — classified filings
  fundamentals/<TICKER>/         # raw primary sources (NOT model output)
    annual-report-<FY>.txt       #   extracted annual-report text
    concall-<Q>-<FY>.txt         #   earnings-call transcript text
    meta.json                    #   source urls + fetch dates
  research/<TICKER>.json         # ResearchDoc — CACHED model output (by content hash)
  feed/latest.json               # FeedItem[] — precomputed digest, important first
```

Shapes are defined once in [`src/types/finn.ts`](../src/types/finn.ts).

## Rules

- **Pull/research uses `fundamentals/` only** — annual reports + concall transcripts. No news,
  no broker notes, no model memory. (Push-side enrichment like a person's bio may use outside
  sources — that's the one allowed exception.)
- **`research/` is a cache.** Key every model answer by a hash of (ticker + section + source
  fingerprint + model). If the file exists, never pay for the call again.
- Keep committed demo data small and real enough to be convincing.
