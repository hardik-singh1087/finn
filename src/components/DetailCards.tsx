import type { ManagementChangeBio, MetricCompare, ResultsHeadline } from "@/types/finn";

// ---- results: Revenue / EBITDA / PBT / PAT with QoQ + YoY ----

function num(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n);
}

function Delta({ v }: { v: number | null | undefined }) {
  if (v == null || Number.isNaN(v)) return <span className="text-zinc-300 dark:text-zinc-600">—</span>;
  const up = v >= 0;
  return (
    <span className={`tabular-nums ${up ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
      {up ? "▲" : "▼"} {Math.abs(v)}%
    </span>
  );
}

function Row({ label, m }: { label: string; m?: MetricCompare | null }) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 py-1.5 text-sm">
      <span className="text-zinc-500 dark:text-zinc-400">{label}</span>
      <span className="text-right font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{num(m?.current)}</span>
      <span className="flex w-24 justify-end gap-2 text-xs">
        <Delta v={m?.qoq} /><Delta v={m?.yoy} />
      </span>
    </div>
  );
}

export function ResultsCard({ results }: { results: ResultsHeadline }) {
  return (
    <div className="mt-3 rounded-xl border border-black/[0.06] bg-zinc-50/70 p-3 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="mb-1 flex items-center justify-between text-xs font-medium">
        <span className="text-zinc-500 dark:text-zinc-400">
          Results{results.quarter ? ` · ${results.quarter}` : ""}{results.revenue?.unit ? ` · ${results.revenue.unit}` : ""}
        </span>
        <span className="flex w-24 justify-end gap-2 text-[10px] uppercase tracking-wide text-zinc-400">
          <span className="w-10 text-right">QoQ</span><span className="w-10 text-right">YoY</span>
        </span>
      </div>
      <Row label="Revenue" m={results.revenue} />
      <Row label="EBITDA" m={results.ebitda} />
      <Row label="PBT" m={results.pbt} />
      <Row label="PAT" m={results.pat} />
    </div>
  );
}

// ---- management change: who they are ----

export function BioCard({ bio }: { bio: ManagementChangeBio }) {
  if (!bio.person && !bio.background) return null;
  return (
    <div className="mt-3 flex gap-3 rounded-xl border border-black/[0.06] bg-zinc-50/70 p-3 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm font-semibold text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
        {(bio.person ?? "?").split(/\s+/).map((w) => w[0]).slice(0, 2).join("")}
      </div>
      <div className="min-w-0">
        {bio.person && (
          <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            {bio.person}
            {bio.direction && (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                {bio.direction}
              </span>
            )}
          </div>
        )}
        {bio.role && <div className="text-xs text-zinc-500 dark:text-zinc-400">{bio.role}</div>}
        {bio.background && (
          <p className="mt-1.5 text-sm leading-snug text-zinc-600 dark:text-zinc-300">{bio.background}</p>
        )}
      </div>
    </div>
  );
}
