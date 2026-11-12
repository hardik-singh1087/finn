# FINN — build guide (read me first)

FINN is a **phone-first app for an Indian-equities investor**. There is too much news every day;
FINN shows only the few things that matter. Built for the ENAM "AI Engineer Build Challenge."

**Deadline: 15 Nov 2026.** Grading: ideas, product sense, design, clean code, low cost. North
star: *a small thing that works beats a big thing that breaks. No generic "AI slop."*

---

## 1. What the product is

Two modes, one app:

- **PUSH** — the app tells me what changed in my stocks and why I should care, without my asking.
  - A **feed/digest** of cards (most important first; routine stuff collapsed or hidden), over a
    window I choose (default 24h).
  - At least **one triggered alert** I can turn on (e.g. unusual volume ≥ 2× average, or a price
    move beyond ±X%, or a material announcement type I care about). Threshold is configurable.
- **PULL** — I ask FINN to research one company; it answers using **only that company's own
  filings** (annual report + concall transcripts). The **star feature is "promised vs delivered"**:
  over the last ~4 quarters, what management guided vs. what the numbers actually did.

**The core flow:** home = **FEED** of cards → tap a company → its **RESEARCH** page →
*look → dig in → ask questions.*

---

## 2. Decisions (fixed — do not change)

- **Stack:** Next.js (App Router) + TypeScript + Tailwind. Deploy on **Vercel**. **Mobile-first**,
  everything must look good on a phone.
- **Scope:** a small but working slice of **both** modes. Thin-but-working > broad-but-broken.
- **Data:** Python scripts in `data-pipeline/` download public data and save it as **committed JSON**
  in `data/` so the demo always runs offline. The app reads those files and calls the model.
- **Research engine is GENERIC** — works for any NSE ticker where data is available — but we
  **pre-save demo data** for our set so the demo is reliable.
- **Primary sources only** on the Pull side: annual reports + concall transcripts. No news, no
  broker notes, no research reports, no model-memory guessing. (Push-side enrichment like a new
  exec's bio *may* use outside sources — that's the one allowed exception.)
- **Models / cost:** route by difficulty. Cheap model (Haiku) for classification + short summaries,
  mid (Sonnet) for structured extraction/snapshots, strong (Opus) **only** for promised-vs-delivered
  reasoning. **Cache every answer to disk** (keyed by content hash) so we never re-pay. Routing table
  lives in `config/finn.config.json`.

### The 16 announcement categories (+ routine)
`results, M&A, fund_raise, management_change, litigation, insider_trading, earnings_call,`
`investor_meetings, credit_rating, dividend, bonus_split, capex, press_release, postal_ballot,`
`agm_egm, pledging, unclassified` — every filing goes into **exactly one**. Weights/priority per
category live in config and drive the feed sort.

---

## 3. Folder layout

```
.
├── CLAUDE.md                     # this file
├── config/
│   └── finn.config.json          # portfolio, research tickers, alert thresholds, model routing, categories
├── data/                         # committed demo store (JSON) — written by pipeline, read by app
│   ├── prices/<T>.json           # PriceBar[]
│   ├── announcements/<T>.json    # Announcement[]
│   ├── fundamentals/<T>/...       # raw primary sources (AR text + transcripts) — PULL uses only these
│   ├── research/<T>.json         # cached model output (ResearchDoc)
│   └── feed/latest.json          # precomputed FeedItem[]
├── data-pipeline/                # Python (venv + requirements.txt)
│   ├── config.py                 # loads the SAME config/finn.config.json
│   └── scripts/                  # fetch_prices, fetch_announcements, classify_announcements,
│                                 #   fetch_fundamentals, build_feed, research  (stubs for now)
├── src/
│   ├── app/                      # App Router pages + route handlers
│   ├── components/               # UI
│   ├── lib/                      # config.ts (typed), store.ts (reads data/)
│   └── types/finn.ts             # shared domain types (single source of truth for shapes)
├── .env.example
└── (Next.js config, tsconfig, etc.)
```

**Shapes are defined once** in `src/types/finn.ts`. **Config is read by both sides** (TS via
`src/lib/config.ts`, Python via `data-pipeline/config.py`).

---

## 4. Build steps (in order)

> Each step should end in something that visibly works. Commit after each.

**Phase 0 — scaffold (DONE)**
Next.js + TS + Tailwind app, `data-pipeline/` venv + requirements, config, env.example, data store,
git. No features yet.

**Phase 1 — data in the repo (plumbing)**
1. `fetch_prices.py` → `data/prices/<T>.json` for the ~20 portfolio tickers (yfinance, EOD).
2. `fetch_announcements.py` → raw filings per ticker (NSE/BSE).
3. `classify_announcements.py` → tag each filing into one of 16 categories + one-line summary (cheap model), fill `importance` from category weight.
4. `fetch_fundamentals.py` → AR + concall transcript **text** for the research demo set into `data/fundamentals/<T>/`.
   *Commit the output. The app never needs the network for the demo.*

**Phase 2 — PUSH (feed first, it's the home screen)**
5. `build_feed.py` → `data/feed/latest.json`: sort by importance, collapse routine, add a plain-English `reason` per item; results items get headline Revenue/EBITDA/PBT/PAT QoQ+YoY.
6. App: **home feed** of cards (important first, routine hidden behind a "show routine" toggle). Window picker (24h / 3d / 7d). Mobile-first.
7. App: **one alert toggle** (unusual volume or price move, threshold from config) — surfaced as a distinct card style.

**Phase 3 — PULL (research page)**
8. `research.py <TICKER>` → cached `ResearchDoc`. Start with **business snapshot + financial snapshot**, then the **promised-vs-delivered** section (strong model, primary sources only, with citations).
9. App: **research page** reached by tapping a company. Progressive depth: snapshot → trajectory/cash → promised-vs-delivered. Show the sources used.
10. App: **ask a question** box on the research page, answered from that company's primary docs only (grounded, cited).

**Phase 4 — polish + ship**
11. Design pass (typography, density, dark, tap targets), empty/loading states, Vercel deploy, covering note.

---

## 5. Conventions

- **TypeScript strict.** Keep `src/types/finn.ts` the single source of truth for data shapes; the
  Python side writes JSON matching those shapes.
- **Server reads, never client fs.** `src/lib/store.ts` is server-only.
- **Never commit secrets.** Only `.env.example` is tracked. Keys live in `.env.local` / Vercel env.
- **Cache or don't call.** Before any paid model call, check `data/research/`. If a matching cached
  answer exists, use it. Commit the cache so the demo is free and deterministic.
- **Primary-sources discipline** on Pull — if a claim can't be traced to the AR/transcript, it
  doesn't ship.
- Commit after each build step with a short, honest message.

---

## 6. Commands

```bash
# app
npm run dev          # local dev
npm run build        # production build (what Vercel runs)
npm run typecheck    # tsc --noEmit

# pipeline
cd data-pipeline && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
python scripts/fetch_prices.py
```
