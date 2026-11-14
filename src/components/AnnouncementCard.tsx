import Link from "next/link";
import type { Announcement, AnnouncementType, PriceSummary } from "@/types/finn";
import { inr, relTime, signedPct } from "@/lib/format";
import { BioCard, ResultsCard } from "./DetailCards";

// Literal class strings (Tailwind needs them static) — colored tag per category.
const TAG: Record<AnnouncementType, string> = {
  results: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  "M&A": "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  fund_raise: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  management_change: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  litigation: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  credit_rating: "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300",
  pledging: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  insider_trading: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
  capex: "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300",
  dividend: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300",
  bonus_split: "bg-lime-100 text-lime-700 dark:bg-lime-500/15 dark:text-lime-300",
  earnings_call: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
  investor_meetings: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  press_release: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300",
  postal_ballot: "bg-stone-100 text-stone-600 dark:bg-stone-500/15 dark:text-stone-300",
  agm_egm: "bg-zinc-100 text-zinc-600 dark:bg-zinc-500/15 dark:text-zinc-300",
  unclassified: "bg-zinc-100 text-zinc-500 dark:bg-zinc-500/10 dark:text-zinc-400",
};

const LABEL: Partial<Record<AnnouncementType, string>> = {
  "M&A": "M&A", fund_raise: "Fund raise", management_change: "Mgmt change",
  credit_rating: "Credit rating", bonus_split: "Bonus / split",
  earnings_call: "Earnings call", investor_meetings: "Investor meet",
  press_release: "Press release", postal_ballot: "Postal ballot",
  agm_egm: "AGM / EGM", insider_trading: "Insider", unclassified: "Routine",
};

const label = (t: AnnouncementType) =>
  LABEL[t] ?? t.charAt(0).toUpperCase() + t.slice(1);

export function AnnouncementCard({ item, price }: { item: Announcement; price?: PriceSummary }) {
  const up = (price?.changePct1d ?? 0) >= 0;
  const unusualVol = (price?.volumeVsAvg ?? 0) >= 1.8;

  return (
    <Link
      href={`/research/${item.ticker}`}
      className="group block rounded-2xl border border-black/[0.06] bg-[var(--surface)] p-4 shadow-sm transition
                 active:scale-[0.99] hover:border-brand/40 hover:shadow-md dark:border-white/10 dark:bg-zinc-900/70 dark:hover:border-brand/40"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-semibold text-zinc-900 dark:text-zinc-50">{item.company || item.ticker}</div>
          <div className="text-xs text-zinc-400 dark:text-zinc-500">{item.ticker}</div>
        </div>
        {price && (
          <div className="flex shrink-0 items-center gap-1.5 text-right">
            <div>
              <div className="text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{inr(price.latestClose)}</div>
              <div className={`text-xs font-medium tabular-nums ${up ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                {signedPct(price.changePct1d)}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TAG[item.type]}`}>{label(item.type)}</span>
        {unusualVol && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
            ⚡ {price?.volumeVsAvg}× vol
          </span>
        )}
        <span className="text-xs text-zinc-400 dark:text-zinc-500">{relTime(item.date)}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="ml-auto h-4 w-4 text-zinc-300 transition group-hover:text-brand dark:text-zinc-600"><path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </div>

      {item.summary && (
        <p className="mt-2 text-sm leading-snug text-zinc-600 dark:text-zinc-300">{item.summary}</p>
      )}

      {/* Extra detail (push-side enrichment, cheap model, cached) */}
      {item.enrichment?.results && <ResultsCard results={item.enrichment.results} />}
      {item.enrichment?.bio && <BioCard bio={item.enrichment.bio} />}
    </Link>
  );
}
