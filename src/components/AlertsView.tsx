"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Alert } from "@/types/finn";
import { AlertCard } from "./AlertCard";
import { useSettings } from "@/lib/settings";

export function AlertsView() {
  const [settings] = useSettings();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    setState("loading");
    const qs = new URLSearchParams({
      volumeMultiple: String(settings.volumeMultiple),
      priceMovePct: String(settings.priceMovePct),
      lookbackDays: String(settings.lookbackDays),
    });
    fetch(`/api/alerts?${qs}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => { setAlerts(d.alerts ?? []); setState("ready"); })
      .catch(() => setState("error"));
  }, [settings.volumeMultiple, settings.priceMovePct, settings.lookbackDays]);

  // One per ticker+kind (most severe) so the list stays signal, not noise.
  const top = useMemo(() => {
    const best = new Map<string, Alert>();
    for (const a of alerts) {
      const k = `${a.ticker}:${a.kind}`;
      if (!best.has(k)) best.set(k, a);
    }
    return [...best.values()];
  }, [alerts]);

  return (
    <div className="space-y-4">
      {/* what the engine is watching — reads the user's own thresholds */}
      <Link
        href="/settings"
        className="flex items-center justify-between gap-3 rounded-2xl border border-amber-200/70 bg-amber-50/70 p-3.5 transition active:scale-[0.99] dark:border-amber-500/20 dark:bg-amber-500/[0.08]"
      >
        <div className="text-xs leading-relaxed text-amber-800 dark:text-amber-200">
          Watching for <b>volume ≥ {settings.volumeMultiple}×</b> the 20-day average or a{" "}
          <b>± {settings.priceMovePct}%</b> day, over the last {settings.lookbackDays} trading days.
        </div>
        <span className="shrink-0 rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:bg-black/20 dark:text-amber-300">Tune</span>
      </Link>

      {state === "loading" && (
        <div className="space-y-2.5">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-[76px] rounded-2xl" />)}
        </div>
      )}

      {state === "error" && (
        <div className="rounded-2xl border border-dashed border-black/10 p-8 text-center text-sm text-zinc-500 dark:border-white/15">
          Couldn&apos;t load alerts right now. Try again in a moment.
        </div>
      )}

      {state === "ready" && top.length === 0 && (
        <div className="rounded-2xl border border-dashed border-black/10 p-10 text-center dark:border-white/15">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-xl dark:bg-emerald-500/10">✓</div>
          <p className="mt-3 font-semibold text-zinc-700 dark:text-zinc-200">All quiet</p>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            No stock crossed your thresholds. Loosen them in settings to catch smaller moves.
          </p>
        </div>
      )}

      {state === "ready" && top.length > 0 && (
        <>
          <p className="px-1 text-sm text-zinc-500 dark:text-zinc-400">
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">{top.length}</span> stock{top.length === 1 ? "" : "s"} moved unusually.
          </p>
          <div className="space-y-2.5">
            {top.map((a) => <AlertCard key={`${a.ticker}-${a.kind}-${a.date}`} alert={a} />)}
          </div>
        </>
      )}
    </div>
  );
}
