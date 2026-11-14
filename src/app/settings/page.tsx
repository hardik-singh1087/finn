"use client";

import Link from "next/link";
import type { AnnouncementType } from "@/types/finn";
import { config } from "@/lib/config";
import { useSettings } from "@/lib/settings";

const REAL_TYPES = config.categories.filter((c) => c.id !== "unclassified");

function NumberField({
  label, hint, value, min, max, step, suffix, onChange,
}: {
  label: string; hint: string; value: number; min: number; max: number; step: number;
  suffix: string; onChange: (v: number) => void;
}) {
  const set = (v: number) => onChange(Math.max(min, Math.min(max, Math.round(v * 100) / 100)));
  return (
    <div className="rounded-2xl border border-black/[0.07] bg-white p-4 dark:border-white/10 dark:bg-zinc-900/70">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium text-zinc-900 dark:text-zinc-50">{label}</div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400">{hint}</div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => set(value - step)} className="h-8 w-8 rounded-full bg-black/[0.05] text-lg leading-none text-zinc-600 dark:bg-white/10 dark:text-zinc-300">−</button>
          <span className="w-16 text-center text-base font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{value}{suffix}</span>
          <button onClick={() => set(value + step)} className="h-8 w-8 rounded-full bg-black/[0.05] text-lg leading-none text-zinc-600 dark:bg-white/10 dark:text-zinc-300">+</button>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [settings, update, reset] = useSettings();
  const cared = new Set(settings.caredTypes);

  const toggle = (id: AnnouncementType) => {
    const next = new Set(cared);
    if (next.has(id)) next.delete(id); else next.add(id);
    update({ caredTypes: [...next] as AnnouncementType[] });
  };

  return (
    <div className="min-h-dvh bg-zinc-50 dark:bg-black">
      <div className="mx-auto w-full max-w-md px-4 pb-16">
        <header className="flex items-center justify-between pt-6 pb-4">
          <Link href="/" className="rounded-full bg-white px-3 py-1.5 text-sm font-medium text-zinc-600 ring-1 ring-black/[0.08] dark:bg-zinc-900 dark:text-zinc-300 dark:ring-white/10">← Feed</Link>
          <button onClick={reset} className="text-sm font-medium text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">Reset</button>
        </header>

        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Alerts &amp; filters</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">You decide what counts as unusual, and what you care about.</p>

        <section className="mt-6 space-y-3">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">Alert thresholds</h2>
          <NumberField
            label="Unusual volume" hint="Flag when a day's volume beats its 20-day average by"
            value={settings.volumeMultiple} min={1.2} max={10} step={0.5} suffix="×"
            onChange={(v) => update({ volumeMultiple: v })}
          />
          <NumberField
            label="Big price move" hint="Flag when the price moves in a day by at least"
            value={settings.priceMovePct} min={1} max={25} step={1} suffix="%"
            onChange={(v) => update({ priceMovePct: v })}
          />
          <NumberField
            label="Lookback" hint="How many recent trading days the alert engine scans"
            value={settings.lookbackDays} min={1} max={60} step={1} suffix="d"
            onChange={(v) => update({ lookbackDays: v })}
          />
        </section>

        <section className="mt-6">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Announcement types I care about</h2>
            <span className="text-xs text-zinc-400">{cared.size}/{REAL_TYPES.length}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {REAL_TYPES.map((c) => {
              const on = cared.has(c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => toggle(c.id)}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                    on
                      ? "bg-zinc-900 text-white dark:bg-white dark:text-black"
                      : "bg-white text-zinc-400 ring-1 ring-black/[0.08] dark:bg-zinc-900 dark:ring-white/10"
                  }`}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
          <p className="mt-3 px-1 text-xs text-zinc-400">Unticked types drop to the “routine &amp; muted” section on the feed.</p>
        </section>
      </div>
    </div>
  );
}
