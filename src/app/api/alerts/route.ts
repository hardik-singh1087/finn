// GET /api/alerts — unusual EOD price/volume moves, per the user's thresholds.
// The user decides what "unusual" means:
//   ?volumeMultiple=2     volume >= N x its trailing-20-day average
//   ?priceMovePct=5       |one-day % move| >= X
//   ?lookbackDays=10      how many recent trading days to scan (default 10)
// Returns the breaches, most severe first.

import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import { config, companyByTicker } from "@/lib/config";
import type { Alert, PriceBar } from "@/types/finn";

const AVG_WINDOW = 20;

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const volumeMultiple = Number(q.get("volumeMultiple")) || config.alerts.volumeMultiple;
  const priceMovePct = Number(q.get("priceMovePct")) || config.alerts.priceMovePct;
  const lookbackDays = Math.max(1, Math.min(60, Number(q.get("lookbackDays")) || 10));

  const alerts: Alert[] = [];

  await Promise.all(
    config.portfolio.map(async (c) => {
      const bars: PriceBar[] = await store.prices(c.ticker);
      if (bars.length < AVG_WINDOW + 2) return;
      const company = companyByTicker(c.ticker)?.name ?? c.ticker;
      const start = Math.max(AVG_WINDOW, bars.length - lookbackDays);

      for (let i = start; i < bars.length; i++) {
        const bar = bars[i];
        const prev = bars[i - 1];
        const avg =
          bars.slice(i - AVG_WINDOW, i).reduce((s, b) => s + b.volume, 0) / AVG_WINDOW;
        const volX = avg ? bar.volume / avg : 0;
        const move = prev.close ? ((bar.close - prev.close) / prev.close) * 100 : 0;

        const base = {
          ticker: c.ticker,
          company,
          date: bar.date,
          close: bar.close,
          changePct: Math.round(move * 100) / 100,
          volumeVsAvg: Math.round(volX * 100) / 100,
        };
        if (volX >= volumeMultiple) {
          alerts.push({ ...base, kind: "volume", value: base.volumeVsAvg, threshold: volumeMultiple });
        }
        if (Math.abs(move) >= priceMovePct) {
          alerts.push({ ...base, kind: "price", value: base.changePct, threshold: priceMovePct });
        }
      }
    }),
  );

  // Most severe first: how far past the threshold, then most recent.
  alerts.sort((a, b) => {
    const sa = a.kind === "volume" ? a.value / a.threshold : Math.abs(a.value) / a.threshold;
    const sb = b.kind === "volume" ? b.value / b.threshold : Math.abs(b.value) / b.threshold;
    return sb - sa || b.date.localeCompare(a.date);
  });

  return NextResponse.json({
    thresholds: { volumeMultiple, priceMovePct, lookbackDays },
    count: alerts.length,
    alerts,
  });
}
