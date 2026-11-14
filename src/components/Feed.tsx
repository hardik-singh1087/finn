"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Alert, Announcement, PriceSummary } from "@/types/finn";
import { AnnouncementCard } from "./AnnouncementCard";
import { AlertCard } from "./AlertCard";
import { useSettings } from "@/lib/settings";

const PRESETS = [
  { label: "24h", h: 24 },
  { label: "3d", h: 72 },
  { label: "7d", h: 168 },
];

export function Feed() {
  const [settings] = useSettings();
  const [hours, setHours] = useState(24);
  const [customOpen, setCustomOpen] = useState(false);
  const [customDays, setCustomDays] = useState(30);
  const [items, setItems] = useState<Announcement[]>([]);
  const [prices, setPrices] = useState<Record<string, PriceSummary>>({});
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRoutine, setShowRoutine] = useState(false);
  const [asOf, setAsOf] = useState<string | null>(null);

  // Prices once (prompt 1 API).
  useEffect(() => {
    fetch("/api/prices")
      .then((r) => r.json())
      .then((d) => {
        const map: Record<string, PriceSummary> = {};
        for (const s of d.stocks ?? []) map[s.ticker] = s;
        setPrices(map);
      })
      .catch(() => {});
  }, []);

  // Alerts whenever the thresholds change (alert engine API).
  useEffect(() => {
    const qs = new URLSearchParams({
      volumeMultiple: String(settings.volumeMultiple),
      priceMovePct: String(settings.priceMovePct),
      lookbackDays: String(settings.lookbackDays),
    });
    fetch(`/api/alerts?${qs}`)
      .then((r) => r.json())
      .then((d) => setAlerts(d.alerts ?? []))
      .catch(() => setAlerts([]));
  }, [settings.volumeMultiple, settings.priceMovePct, settings.lookbackDays]);

  // Announcements whenever the window changes (prompt 2 API).
  useEffect(() => {
    setLoading(true);
    fetch(`/api/announcements?windowHours=${hours}&limit=300`)
      .then((r) => r.json())
      .then((d) => { setItems(d.items ?? []); setAsOf(d.asOf ?? null); })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [hours]);

  // One alert per ticker+kind (the most severe), so the section stays tight.
  const topAlerts = useMemo(() => {
    const best = new Map<string, Alert>();
    for (const a of alerts) {
      const k = `${a.ticker}:${a.kind}`;
      if (!best.has(k)) best.set(k, a); // alerts arrive severity-sorted
    }
    return [...best.values()].slice(0, 8);
  }, [alerts]);

  const cared = useMemo(() => new Set(settings.caredTypes), [settings.caredTypes]);
  const { important, muted } = useMemo(() => {
    const isImportant = (a: Announcement) => a.type !== "unclassified" && cared.has(a.type);
    return {
      important: items.filter(isImportant),
      muted: items.filter((a) => !isImportant(a)),
    };
  }, [items, cared]);

  const pickPreset = (h: number) => { setCustomOpen(false); setHours(h); };

  return (
    <div className="w-full">
      {/* Alerts */}
      {topAlerts.length > 0 && (
        <section className="mb-4">
          <Link href="/alerts" className="mb-2 flex items-center justify-between px-1">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
              ⚡ Alerts · {topAlerts.length}
            </h2>
            <span className="text-xs font-medium text-zinc-400">See all →</span>
          </Link>
          <div className="space-y-2">
            {topAlerts.slice(0, 3).map((a) => (
              <AlertCard key={`${a.ticker}-${a.kind}-${a.date}`} alert={a} />
            ))}
          </div>
        </section>
      )}

      {/* Window picker */}
      <div className="sticky top-0 z-10 -mx-4 mb-3 bg-[var(--background)]/85 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.h}
              onClick={() => pickPreset(p.h)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition active:scale-95 ${
                !customOpen && hours === p.h
                  ? "bg-brand text-white shadow-sm"
                  : "bg-[var(--surface)] text-zinc-600 ring-1 ring-black/[0.06] dark:bg-zinc-900 dark:text-zinc-300 dark:ring-white/10"
              }`}
            >
              {p.label}
            </button>
          ))}
          <button
            onClick={() => { setCustomOpen(true); setHours(customDays * 24); }}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition active:scale-95 ${
              customOpen
                ? "bg-brand text-white shadow-sm"
                : "bg-[var(--surface)] text-zinc-600 ring-1 ring-black/[0.06] dark:bg-zinc-900 dark:text-zinc-300 dark:ring-white/10"
            }`}
          >
            Custom
          </button>
          {customOpen && (
            <div className="ml-auto flex items-center gap-1 text-sm text-zinc-500">
              last
              <input
                type="number"
                min={1}
                max={365}
                value={customDays}
                onChange={(e) => {
                  const d = Math.max(1, Math.min(365, Number(e.target.value) || 1));
                  setCustomDays(d);
                  setHours(d * 24);
                }}
                className="w-14 rounded-lg border border-black/10 bg-white px-2 py-1 text-center tabular-nums dark:border-white/15 dark:bg-zinc-900"
              />
              days
            </div>
          )}
        </div>
      </div>

      {/* Summary line */}
      {!loading && (
        <div className="mb-3 flex items-baseline justify-between px-1">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">{important.length}</span> update
            {important.length === 1 ? "" : "s"} that matter
            {muted.length > 0 && <> · {muted.length} hidden</>}
          </p>
          {asOf && (
            <span className="shrink-0 text-xs text-zinc-400">
              as of {new Date(asOf).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
            </span>
          )}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-28 rounded-2xl" />
          ))}
        </div>
      )}

      {/* Important feed */}
      {!loading && (
        <div className="space-y-3">
          {important.map((a) => (
            <AnnouncementCard key={a.id} item={a} price={prices[a.ticker]} />
          ))}

          {important.length === 0 && (
            <div className="rounded-2xl border border-dashed border-black/10 p-10 text-center dark:border-white/15">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand/10 text-xl">🗞️</div>
              <p className="mt-3 font-semibold text-zinc-700 dark:text-zinc-200">Nothing that matters here</p>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                No filings for the types you follow in this window. Try a longer period, or widen your filters in{" "}
                <Link href="/settings" className="font-medium text-brand">settings</Link>.
              </p>
            </div>
          )}

          {muted.length > 0 && (
            <div className="pt-1">
              <button
                onClick={() => setShowRoutine((v) => !v)}
                className="flex w-full items-center justify-between rounded-xl bg-black/[0.03] px-4 py-3 text-sm font-medium text-zinc-500 transition hover:bg-black/[0.05] dark:bg-white/[0.04] dark:text-zinc-400 dark:hover:bg-white/[0.07]"
              >
                <span>Routine &amp; muted ({muted.length})</span>
                <span className={`transition ${showRoutine ? "rotate-180" : ""}`}>▾</span>
              </button>
              {showRoutine && (
                <div className="mt-3 space-y-3">
                  {muted.map((a) => (
                    <AnnouncementCard key={a.id} item={a} price={prices[a.ticker]} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
