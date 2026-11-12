# FINN — Financial Investment Agent

A **phone-first app for an Indian-equities investor.** Too much news every day; FINN surfaces only
the few things that matter. Built for the ENAM "AI Engineer Build Challenge."

Two modes:

- **Push** — a prioritised **feed** of what changed across my portfolio (important first, routine
  hidden) + a configurable **alert** (unusual volume / price move / material filing type).
- **Pull** — on-demand **research** on one company, grounded **only in its own filings** (annual
  report + concall transcripts). Star feature: **promised vs. delivered** over the last ~4 quarters.

Flow: **feed → tap a company → research → ask questions.**

## Stack

Next.js (App Router) · TypeScript · Tailwind · deployed on Vercel. Data is prepared by Python
scripts in [`data-pipeline/`](./data-pipeline) and committed as JSON in [`data/`](./data) so the
demo runs offline. Models are routed by difficulty (cheap → strong) and every answer is cached.

## Getting started

```bash
npm install
npm run dev          # http://localhost:3000
```

Data pipeline:

```bash
cd data-pipeline
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

## Where things are

- **[`CLAUDE.md`](./CLAUDE.md)** — product, decisions, folder layout, and the full build plan.
- **[`config/finn.config.json`](./config/finn.config.json)** — portfolio, research tickers, alert
  thresholds, model routing, announcement categories (read by both the app and the pipeline).
- **[`src/types/finn.ts`](./src/types/finn.ts)** — shared data shapes.
- **[`data/README.md`](./data/README.md)** — the committed data store.

Copy `.env.example` to `.env.local` and add keys only when (re)generating summaries/research —
the committed demo data needs none.
