// GET /api/announcements — portfolio filings, sorted most-important-first.
// Filters (all optional, combinable):
//   ?ticker=RELIANCE,TCS     one or more stocks
//   ?type=results,M&A        one or more of the 16 categories
//   ?windowHours=24          only items newer than N hours  (or ?days=7)
//   ?hideRoutine=1           drop the "unclassified" noise
//   ?limit=50                cap the result (default 100)
// Sort: importance desc, then date desc.

import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import type { Announcement } from "@/types/finn";

const csv = (v: string | null) =>
  v ? new Set(v.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)) : null;

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;

  const tickers = csv(q.get("ticker"));
  const types = csv(q.get("type"));
  const hideRoutine = q.get("hideRoutine") === "1" || q.get("hideRoutine") === "true";
  const limit = Math.max(1, Math.min(500, Number(q.get("limit")) || 100));

  const hours = Number(q.get("windowHours"));
  const days = Number(q.get("days"));
  const windowMs = hours ? hours * 3_600_000 : days ? days * 86_400_000 : null;
  const cutoff = windowMs ? Date.now() - windowMs : null;

  const [all, enrichment] = await Promise.all([store.allAnnouncements(), store.enrichment()]);
  let items: Announcement[] = all;

  items = items.filter((a) => {
    if (tickers && !tickers.has(a.ticker.toUpperCase())) return false;
    if (types && !types.has(a.type.toUpperCase())) return false;
    if (hideRoutine && a.type === "unclassified") return false;
    if (cutoff && new Date(a.date).getTime() < cutoff) return false;
    return true;
  });

  items.sort((a, b) => b.importance - a.importance || b.date.localeCompare(a.date));
  const total = items.length;
  items = items.slice(0, limit).map((a) =>
    enrichment[a.id] ? { ...a, enrichment: enrichment[a.id] } : a,
  );

  return NextResponse.json({
    total,
    returned: items.length,
    filters: {
      ticker: q.get("ticker") ?? null,
      type: q.get("type") ?? null,
      windowHours: hours || null,
      days: days || null,
      hideRoutine,
      limit,
    },
    items,
  });
}
