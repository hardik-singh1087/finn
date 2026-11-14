"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Row = {
  ticker: string; name: string; sector: string;
  group: "research" | "portfolio"; hasResearch: boolean; hasPvd: boolean;
};
type Catalog = { research: Row[]; portfolio: Row[] };

function CompanyRow({ r }: { r: Row }) {
  return (
    <Link
      href={`/research/${r.ticker}`}
      className="flex items-center gap-3 rounded-2xl border border-black/[0.06] bg-[var(--surface)] p-3.5 shadow-sm transition active:scale-[0.99] hover:border-brand/40 dark:border-white/10 dark:bg-zinc-900/70"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-sm font-bold text-brand">
        {r.ticker.slice(0, 2)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold text-zinc-900 dark:text-zinc-50">{r.name}</div>
        <div className="truncate text-xs text-zinc-400 dark:text-zinc-500">{r.ticker} · {r.sector}</div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {r.hasPvd && (
          <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-semibold text-brand">★ P/D</span>
        )}
        {r.hasResearch ? (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300">Ready</span>
        ) : (
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-400 dark:bg-white/5">Generic</span>
        )}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4 text-zinc-300 dark:text-zinc-600"><path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </div>
    </Link>
  );
}

function Skeleton() {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-[68px] rounded-2xl" />)}
    </div>
  );
}

export function ResearchIndex() {
  const [data, setData] = useState<Catalog | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [q, setQ] = useState("");

  useEffect(() => {
    fetch("/api/catalog")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: Catalog) => { setData(d); setState("ready"); })
      .catch(() => setState("error"));
  }, []);

  const filtered = useMemo(() => {
    if (!data) return null;
    const needle = q.trim().toLowerCase();
    const f = (rows: Row[]) =>
      !needle ? rows : rows.filter((r) =>
        r.name.toLowerCase().includes(needle) || r.ticker.toLowerCase().includes(needle) || r.sector.toLowerCase().includes(needle));
    return { research: f(data.research), portfolio: f(data.portfolio) };
  }, [data, q]);

  if (state === "loading") return <Skeleton />;
  if (state === "error" || !filtered) {
    return (
      <div className="rounded-2xl border border-dashed border-black/10 p-8 text-center text-sm text-zinc-500 dark:border-white/15">
        Couldn&apos;t load the company list. Pull to refresh or try again.
      </div>
    );
  }

  const nothing = filtered.research.length === 0 && filtered.portfolio.length === 0;

  return (
    <div className="space-y-5">
      <div className="relative">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"><path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search a company or sector"
          className="w-full rounded-xl border border-black/10 bg-[var(--surface)] py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-brand dark:border-white/15 dark:bg-zinc-900"
        />
      </div>

      {nothing && (
        <div className="rounded-2xl border border-dashed border-black/10 p-8 text-center text-sm text-zinc-500 dark:border-white/15">
          No company matches “{q}”.
        </div>
      )}

      {filtered.research.length > 0 && (
        <section>
          <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">Deep-research demo set</h2>
          <div className="space-y-2.5">
            {filtered.research.map((r) => <CompanyRow key={r.ticker} r={r} />)}
          </div>
        </section>
      )}

      {filtered.portfolio.length > 0 && (
        <section>
          <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">Your portfolio</h2>
          <div className="space-y-2.5">
            {filtered.portfolio.map((r) => <CompanyRow key={r.ticker} r={r} />)}
          </div>
        </section>
      )}
    </div>
  );
}
