# FINN — only the few things that matter

A **phone-first app for an Indian-equities investor.** There's too much market news every day; FINN
shows only the few things that actually move your portfolio — and lets you research one company
using **only its own filings.** Built for the ENAM "AI Engineer Build Challenge."

**▶ Live demo:** _<!-- LIVE_URL -->(deploying — see "Deploy" below)_
Best viewed on a phone. The whole demo runs on **committed data** — nothing is downloaded live.

---

## What it is

Two modes, one app:

- **PUSH — the feed (home).** What changed across your 20-stock portfolio, **most important first**,
  routine collapsed. Pick a window (24h / 3d / 7d / custom). Plus a configurable **alert** when a
  stock's volume or price moves unusually. Two cards carry extra detail: a **results** card
  (Revenue / EBITDA / PBT / PAT, QoQ + YoY) and a **management-change** card (a short bio).
- **PULL — research.** Tap a company for research grounded **only in its own annual report and
  earnings-call transcripts** — no news, no broker notes, no model memory. The star feature is
  **Promised vs Delivered:** over the last ~4 quarters, what management *guided* vs. what the numbers
  actually *did*, quarter by quarter, with a kept / missed verdict and a citation to the exact line.
  Then **ask your own question**, answered the same grounded, cited way.

**The flow:** feed → tap a company → research → *look → dig in → ask.*

---

## Try this (2-minute demo path)

1. **Open the feed.** The home screen — updates that matter, most important first, with colored
   type tags (Results, M&A, Mgmt change, …) and a one-line "why it matters."
2. **Open "Routine & muted."** Tap the collapsed bar near the bottom — the low-signal filings are
   hidden by default, not deleted. This is the whole point: signal up top, noise one tap away.
3. **See an alert.** The amber/green cards at the top (and the **Alerts** tab) fire when a stock's
   day moved beyond *your* thresholds — e.g. *Dixon, volume 5.95× its 20-day average.* Thresholds
   are yours to set in **Settings**.
4. **Open a results card.** Find a **Results** filing in the feed (e.g. an IT or FMCG name) — the
   card expands inline with Revenue / EBITDA / PBT / PAT and QoQ + YoY, pulled from the filing.
5. **Tap a company → research.** Go to the **Research** tab and open **Infosys (INFY)** — the
   demo set is pre-built and instant.
6. **Read Promised vs Delivered.** The ⭐ section at the top: INFY *held* its 20–22% margin and
   29–30% tax guidance (**kept**) but *cut* FY revenue-growth guidance from 1.5–3% → 1–2%
   (**missed**). Every number links to the exact concall line. Scroll on for the grounded snapshot
   sections, and **Ask the documents** a question of your own.

---

## How it's built

```
Python pipeline  ──writes──▶  committed JSON (data/)  ──read──▶  Next.js app (Vercel)
(data-pipeline/)              prices, announcements,            feed · alerts · research ·
                              fundamentals, research,           promised-vs-delivered
                              promised-vs-delivered
```

- **App:** Next.js 16 (App Router, Turbopack, Partial Prerendering) · TypeScript (strict) · Tailwind
  v4. Phone-first; bottom tab bar (Feed / Alerts / Research / Settings); light + dark.
- **Server reads, never the client.** [`src/lib/store.ts`](./src/lib/store.ts) reads the JSON on the
  server; route handlers under [`src/app/api`](./src/app/api) serve it. The browser only calls our
  own API.
- **One source of truth for shapes** ([`src/types/finn.ts`](./src/types/finn.ts)) and for config
  ([`config/finn.config.json`](./config/finn.config.json)) — the Python side writes JSON matching
  those shapes and reads the same config, so the app and the data never drift.
- **The demo never downloads anything.** Every page is served from committed JSON. The *only*
  request-time network call in the whole app is the optional **"Ask the documents"** box; if its key
  is missing or the upstream is slow/over-quota, it times out at 12s and falls back with a clear
  message while everything else keeps working.

## Models & cost

Routed by difficulty, and **every answer is cached to disk** (committed) so a call is never repaid —
the demo is deterministic and free to run.

| Job | Model | Why |
|---|---|---|
| Classify filings into 16 types · one-line "why it matters" | **Gemini 3.5 Flash-Lite** (free tier) | High-volume, cheap, fast; a rules-based classifier is the offline fallback. |
| Promised-vs-delivered reasoning · research synthesis | **Gemini 3.5 Flash**, thinking off (free tier) | Judging management is the one reasoning-heavy step; one call per company. |
| Live "Ask the documents" | **Gemini 3.5 Flash-Lite** | Grounded retrieval → short cited answer, at request time. |

- **Why Gemini free tier:** keeps running cost at **₹0** for the challenge. Anthropic (Haiku /
  Sonnet / Opus) is kept in [`config/finn.config.json`](./config/finn.config.json) as a routable
  option; the routing table lives there.
- **Retrieval is keyword BM25**, not embeddings — $0, offline, deterministic, and a clean seam to
  swap in embeddings later. Financial questions are keyword-dense, so it fits.
- **Grounding discipline (Pull side):** if a claim can't be traced to the AR or a transcript, it
  doesn't ship — the section says *"Not found in the documents."*

## Data sources (all primary / public)

- **Prices & volume:** Yahoo Finance (`yfinance`), end-of-day, ~1 year per ticker.
- **Announcements:** NSE/BSE corporate-filing feeds, classified into 16 categories + "routine."
- **Fundamentals (research):** each company's **own** annual report + last ~4 concall transcripts
  (sourced via screener.in → the exchange PDFs), converted to text, chunked, and BM25-indexed. Raw
  PDFs are git-ignored; the extracted text chunks are committed.

---

## Run it locally

```bash
npm install
npm run dev          # http://localhost:3000
```

```bash
npm run build        # production build (what Vercel runs)
npm run typecheck    # tsc --noEmit
```

The committed data needs **no keys**. A key is only needed for the live "Ask" box and for
(re)generating data:

```bash
cp .env.example .env            # then add GEMINI_API_KEY (free: aistudio.google.com/apikey)
```

Regenerate data (optional — the demo set is already committed):

```bash
cd data-pipeline
python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
python scripts/fetch_prices.py
python scripts/fetch_announcements.py && python scripts/classify_announcements.py
python scripts/fetch_fundamentals.py INFY
python scripts/research.py INFY
python scripts/promised_vs_delivered.py INFY     # ⭐ the star feature
```

## Deploy

Deployed on **Vercel**. The committed `data/**` JSON is bundled into the serverless functions via
`outputFileTracingIncludes` in [`next.config.ts`](./next.config.ts), so the live app reads it with
**no network at request time**.

```bash
npm i -g vercel         # or use: npx vercel
vercel                  # first run links/creates the project
vercel env add GEMINI_API_KEY production   # for the live "Ask" box (optional)
vercel --prod           # deploy
```

> Everything except the "Ask the documents" box works with **no env vars at all** — so even if the
> key is absent, the feed, alerts, research, and promised-vs-delivered are fully live.

## Where things are

- **[`CLAUDE.md`](./CLAUDE.md)** — product, fixed decisions, folder layout, the full build plan.
- **[`config/finn.config.json`](./config/finn.config.json)** — portfolio, research tickers, alert
  thresholds, model routing, the 16 announcement categories (read by app **and** pipeline).
- **[`src/types/finn.ts`](./src/types/finn.ts)** — shared data shapes.
- **[`data-pipeline/`](./data-pipeline)** — the Python scripts that produce the committed data.
- **[`data/`](./data)** — the committed demo store (prices, announcements, fundamentals, research).
