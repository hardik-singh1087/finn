"use client";

import { useEffect, useState } from "react";
import type {
  PromisedVsDelivered, PvdCitation, PvdQuarter, PvdTrackedPromise, PvdVerdict,
} from "@/types/finn";

const V: Record<PvdVerdict, { label: string; dot: string; chip: string; text: string }> = {
  match: {
    label: "Kept", dot: "bg-emerald-500",
    chip: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/20",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  miss: {
    label: "Missed", dot: "bg-red-500",
    chip: "bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-400/20",
    text: "text-red-600 dark:text-red-400",
  },
  mixed: {
    label: "Mixed", dot: "bg-amber-500",
    chip: "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/20",
    text: "text-amber-600 dark:text-amber-400",
  },
  na: {
    label: "Pending", dot: "bg-zinc-400",
    chip: "bg-zinc-100 text-zinc-500 ring-black/10 dark:bg-white/10 dark:text-zinc-400 dark:ring-white/10",
    text: "text-zinc-500 dark:text-zinc-400",
  },
};

const v = (x: PvdVerdict) => V[x] ?? V.na;
const ref = (n?: number) =>
  n ? <sup className="ml-0.5 text-[10px] font-normal text-zinc-400">[{n}]</sup> : null;

function VerdictBadge({ verdict }: { verdict: PvdVerdict }) {
  const s = v(verdict);
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${s.chip}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

/** A single commitment followed call-over-call — the gap is in the changing values. */
function TrackedPromise({ t }: { t: PvdTrackedPromise }) {
  const s = v(t.verdict);
  return (
    <div className="rounded-xl bg-zinc-50 p-3 ring-1 ring-black/[0.04] dark:bg-white/[0.03] dark:ring-white/[0.06]">
      <div className="flex items-start justify-between gap-2">
        <div className="text-[13px] font-semibold leading-snug text-zinc-800 dark:text-zinc-100">{t.topic}</div>
        <VerdictBadge verdict={t.verdict} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-1 gap-y-1.5">
        {t.trail.map((step, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <span className={`text-xs ${s.text}`}>→</span>}
            <span className="rounded-lg bg-white px-2 py-1 text-xs ring-1 ring-black/[0.06] dark:bg-zinc-800 dark:ring-white/10">
              <span className="text-zinc-400">{step.call}</span>{" "}
              <span className={`font-semibold tabular-nums ${s.text}`}>{step.value}</span>
              {ref(step.n)}
            </span>
          </span>
        ))}
      </div>
      {t.note && <p className="mt-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{t.note}</p>}
    </div>
  );
}

function Quarter({ q }: { q: PvdQuarter }) {
  const s = v(q.verdict);
  return (
    <div className={`relative rounded-xl border-l-2 bg-white p-3 ring-1 ring-black/[0.05] dark:bg-zinc-900/60 dark:ring-white/[0.06]`}
      style={{ borderLeftColor: "var(--pvd-accent)" }}>
      <div className={`absolute -left-[5px] top-4 h-2 w-2 rounded-full ${s.dot}`} />
      <div className="flex items-center justify-between gap-2">
        <div>
          <span className="text-sm font-bold text-zinc-900 dark:text-zinc-50">{q.label}</span>
          <span className="ml-1.5 text-xs text-zinc-400">{q.call} call</span>
        </div>
        <VerdictBadge verdict={q.verdict} />
      </div>

      <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
        <div>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Promised</div>
          <ul className="space-y-1">
            {q.promised.length === 0 && <li className="text-xs italic text-zinc-400">—</li>}
            {q.promised.map((p, i) => (
              <li key={i} className="text-xs leading-snug text-zinc-700 dark:text-zinc-200">
                {p.text}{ref(p.n)}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg bg-zinc-50 p-2 dark:bg-white/[0.03]">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Delivered</div>
          <div className="divide-y divide-black/[0.05] dark:divide-white/10">
            {q.delivered.length === 0 && <div className="text-xs italic text-zinc-400">—</div>}
            {q.delivered.map((d, i) => (
              <div key={i} className="flex items-baseline justify-between gap-2 py-1">
                <span className="text-xs text-zinc-500 dark:text-zinc-400">{d.metric}</span>
                <span className="text-right text-xs font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                  {d.value}
                  {d.change && <span className="ml-1 font-normal text-zinc-400">{d.change}</span>}
                  {ref(d.n)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {q.note && (
        <p className={`mt-2 border-l-2 pl-2 text-xs leading-relaxed ${s.text}`}
          style={{ borderColor: "currentColor" }}>
          {q.note}
        </p>
      )}
    </div>
  );
}

const citeLabel = (c: PvdCitation) =>
  `${c.docType === "annual_report" ? "AR" : "Concall"} · ${c.period} · p.${c.page}`;

function Sources({ citations }: { citations: PvdCitation[] }) {
  const [open, setOpen] = useState(false);
  if (!citations.length) return null;
  return (
    <div className="border-t border-black/[0.06] pt-2.5 dark:border-white/10">
      <button onClick={() => setOpen((o) => !o)} className="text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400">
        {open ? "▾" : "▸"} Sources — exact lines ({citations.length})
      </button>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {citations.map((c) => (
          <a key={c.n} href={c.source} target="_blank" rel="noopener noreferrer"
            className="rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 hover:bg-zinc-200 dark:bg-white/10 dark:text-zinc-300">
            [{c.n}] {citeLabel(c)}
          </a>
        ))}
      </div>
      {open && (
        <div className="mt-2 space-y-2">
          {citations.map((c) => (
            <blockquote key={c.n} className="border-l-2 border-zinc-200 pl-3 text-xs leading-relaxed text-zinc-500 dark:border-white/15 dark:text-zinc-400">
              <span className="font-medium text-zinc-400">[{c.n}] {citeLabel(c)} — </span>“{c.snippet}…”
            </blockquote>
          ))}
        </div>
      )}
    </div>
  );
}

export function PromisedVsDeliveredView({ ticker }: { ticker: string }) {
  const [doc, setDoc] = useState<PromisedVsDelivered | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "none">("loading");

  useEffect(() => {
    let live = true;
    fetch(`/api/promised/${ticker}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: PromisedVsDelivered) => { if (live) { setDoc(d); setState("ready"); } })
      .catch(() => live && setState("none"));
    return () => { live = false; };
  }, [ticker]);

  if (state === "loading") {
    return <div className="h-40 animate-pulse rounded-2xl bg-black/[0.04] dark:bg-white/[0.04]" />;
  }
  if (state === "none" || !doc || doc.notFound) return null;

  const sc = doc.scorecard ?? { kept: 0, missed: 0, mixed: 0 };

  return (
    <section
      className="overflow-hidden rounded-2xl border border-indigo-200/70 bg-gradient-to-b from-indigo-50/80 to-white p-4 dark:border-indigo-400/20 dark:from-indigo-500/[0.08] dark:to-zinc-900/70"
      style={{ ["--pvd-accent" as string]: "rgb(129 140 248)" }}
    >
      <div className="flex items-center gap-2">
        <span className="text-base">⭐</span>
        <h3 className="font-bold text-zinc-900 dark:text-zinc-50">Promised vs delivered</h3>
      </div>
      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
        Did management do what it said? Last {doc.quarters.length} quarters, from its own calls.
      </p>

      {/* overall verdict + scorecard */}
      <div className="mt-3 rounded-xl bg-white/70 p-3 ring-1 ring-black/[0.05] dark:bg-black/20 dark:ring-white/[0.06]">
        <div className="flex flex-wrap gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300">
            {sc.kept} kept
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700 ring-1 ring-red-600/20 dark:bg-red-500/10 dark:text-red-300">
            {sc.missed} missed
          </span>
          {sc.mixed > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300">
              {sc.mixed} mixed
            </span>
          )}
        </div>
        {doc.verdict && <p className="mt-2 text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">{doc.verdict}</p>}
      </div>

      {/* tracked promises — the gap at a glance */}
      {doc.trackedPromises.length > 0 && (
        <div className="mt-3">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
            Guidance tracked call-over-call
          </div>
          <div className="space-y-2">
            {doc.trackedPromises.map((t, i) => <TrackedPromise key={i} t={t} />)}
          </div>
        </div>
      )}

      {/* quarter-by-quarter timeline */}
      {doc.quarters.length > 0 && (
        <div className="mt-4">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
            Quarter by quarter
          </div>
          <div className="ml-1 space-y-2 border-l border-dashed border-indigo-200 pl-3 dark:border-indigo-400/20">
            {doc.quarters.map((q, i) => <Quarter key={i} q={q} />)}
          </div>
        </div>
      )}

      <div className="mt-3">
        <Sources citations={doc.citations} />
      </div>
    </section>
  );
}
