import Link from "next/link";
import type { Alert } from "@/types/finn";
import { inr, relTime } from "@/lib/format";

export function AlertCard({ alert }: { alert: Alert }) {
  const isVol = alert.kind === "volume";
  const up = alert.changePct >= 0;
  const accent = isVol
    ? "border-amber-300 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10"
    : up
      ? "border-emerald-300 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10"
      : "border-red-300 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10";

  return (
    <Link
      href={`/research/${alert.ticker}`}
      className={`block rounded-2xl border p-3.5 transition active:scale-[0.99] ${accent}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            <span>{isVol ? "⚡" : up ? "📈" : "📉"}</span>
            <span className="truncate">{alert.company}</span>
          </div>
          <div className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-300">
            {isVol ? (
              <>Volume <b>{alert.volumeVsAvg}×</b> its 20-day average</>
            ) : (
              <>Price moved <b>{up ? "+" : ""}{alert.changePct}%</b> in a day</>
            )}
            <span className="text-zinc-400"> · ≥{isVol ? `${alert.threshold}×` : `${alert.threshold}%`} · {relTime(alert.date)}</span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{inr(alert.close)}</div>
          <div className={`text-xs font-medium tabular-nums ${up ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
            {up ? "+" : ""}{alert.changePct}%
          </div>
        </div>
      </div>
    </Link>
  );
}
