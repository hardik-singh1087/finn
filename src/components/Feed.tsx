"use client";

import { useEffect, useMemo, useState } from "react";
import type { Announcement, PriceSummary } from "@/types/finn";
import { AnnouncementCard } from "./AnnouncementCard";

const PRESETS = [
  { label: "24h", h: 24 },
  { label: "3d", h: 72 },
  { label: "7d", h: 168 },
];

export function Feed() {
  const [hours, setHours] = useState(24);
  const [customOpen, setCustomOpen] = useState(false);
  const [customDays, setCustomDays] = useState(30);
  const [items, setItems] = useState<Announcement[]>([]);
  const [prices, setPrices] = useState<Record<string, PriceSummary>>({});
  const [loading, setLoading] = useState(true);
  const [showRoutine, setShowRoutine] = useState(false);

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

  // Announcements whenever the window changes (prompt 2 API).
  useEffect(() => {
    setLoading(true);
    fetch(`/api/announcements?windowHours=${hours}&limit=300`)
      .then((r) => r.json())
      .then((d) => setItems(d.items ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [hours]);

  const { important, routine } = useMemo(() => {
    // API already sorts by importance desc, then date desc.
    return {
      important: items.filter((a) => a.type !== "unclassified"),
      routine: items.filter((a) => a.type === "unclassified"),
    };
  }, [items]);

  const pickPreset = (h: number) => { setCustomOpen(false); setHours(h); };

  return (
    <div className="w-full">
      {/* Window picker */}
      <div className="sticky top-0 z-10 -mx-4 mb-3 bg-zinc-50/90 px-4 py-3 backdrop-blur dark:bg-black/80">
        <div className="flex items-center gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.h}
              onClick={() => pickPreset(p.h)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                !customOpen && hours === p.h
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-black"
                  : "bg-white text-zinc-600 ring-1 ring-black/[0.08] dark:bg-zinc-900 dark:text-zinc-300 dark:ring-white/10"
              }`}
            >
              {p.label}
            </button>
          ))}
          <button
            onClick={() => { setCustomOpen(true); setHours(customDays * 24); }}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
              customOpen
                ? "bg-zinc-900 text-white dark:bg-white dark:text-black"
                : "bg-white text-zinc-600 ring-1 ring-black/[0.08] dark:bg-zinc-900 dark:text-zinc-300 dark:ring-white/10"
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
        <p className="mb-3 px-1 text-sm text-zinc-500 dark:text-zinc-400">
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">{important.length}</span> update
          {important.length === 1 ? "" : "s"} that matter
          {routine.length > 0 && <> · {routine.length} routine hidden</>}
        </p>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-black/[0.04] dark:bg-white/[0.04]" />
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
            <div className="rounded-2xl border border-dashed border-black/10 p-8 text-center text-sm text-zinc-500 dark:border-white/15">
              Nothing material in this window. Try a longer period.
            </div>
          )}

          {/* Routine (collapsed) */}
          {routine.length > 0 && (
            <div className="pt-1">
              <button
                onClick={() => setShowRoutine((v) => !v)}
                className="flex w-full items-center justify-between rounded-xl bg-black/[0.03] px-4 py-3 text-sm font-medium text-zinc-500 transition hover:bg-black/[0.05] dark:bg-white/[0.04] dark:text-zinc-400 dark:hover:bg-white/[0.07]"
              >
                <span>Routine ({routine.length})</span>
                <span className={`transition ${showRoutine ? "rotate-180" : ""}`}>▾</span>
              </button>
              {showRoutine && (
                <div className="mt-3 space-y-3">
                  {routine.map((a) => (
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
