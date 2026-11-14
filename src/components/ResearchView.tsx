"use client";

import { useEffect, useState } from "react";
import type {
  AskResult, BullBear, FinMetric, ResearchCitation, ResearchDocFull,
  ResearchSectionData, ResearchSectionId,
} from "@/types/finn";

const ORDER: ResearchSectionId[] = [
  "business_snapshot", "financial_snapshot", "trajectory",
  "balance_sheet", "cash_quality", "guidance", "bull_vs_bear",
];

const cite = (c: ResearchCitation) =>
  `${c.docType === "annual_report" ? "AR" : "Concall"} · ${c.period} · p.${c.page}`;

function Sources({ citations }: { citations: ResearchCitation[] }) {
  const [open, setOpen] = useState(false);
  if (!citations.length) return null;
  return (
    <div className="mt-3 border-t border-black/[0.06] pt-2.5 dark:border-white/10">
      <button onClick={() => setOpen((v) => !v)} className="text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400">
        {open ? "▾" : "▸"} Sources ({citations.length})
      </button>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {citations.map((c, i) => (
          <a key={i} href={c.source} target="_blank" rel="noopener noreferrer"
            className="rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 hover:bg-zinc-200 dark:bg-white/10 dark:text-zinc-300">
            {c.n ? `[${c.n}] ` : ""}{cite(c)}
          </a>
        ))}
      </div>
      {open && (
        <div className="mt-2 space-y-2">
          {citations.map((c, i) => (
            <blockquote key={i} className="border-l-2 border-zinc-200 pl-3 text-xs leading-relaxed text-zinc-500 dark:border-white/15 dark:text-zinc-400">
              <span className="font-medium text-zinc-400">{cite(c)} — </span>“{c.snippet}…”
            </blockquote>
          ))}
        </div>
      )}
    </div>
  );
}

function Content({ content }: { content: ResearchSectionData["content"] }) {
  if (content == null) return null;
  if (typeof content === "string") {
    return <p className="whitespace-pre-line text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">{content}</p>;
  }
  if (Array.isArray(content)) {
    return (
      <div className="divide-y divide-black/[0.05] dark:divide-white/10">
        {(content as FinMetric[]).map((m, i) => (
          <div key={i} className="flex items-center justify-between py-1.5 text-sm">
            <span className="text-zinc-500 dark:text-zinc-400">{m.metric}</span>
            <span className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
              {m.value}{m.n ? <sup className="ml-0.5 text-[10px] font-normal text-zinc-400">[{m.n}]</sup> : null}
            </span>
          </div>
        ))}
      </div>
    );
  }
  const bb = content as BullBear;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">Bull</div>
        <ul className="space-y-1.5">
          {(bb.bull ?? []).map((p, i) => <li key={i} className="text-sm leading-snug text-zinc-700 dark:text-zinc-200">• {p}</li>)}
        </ul>
      </div>
      <div>
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-red-600 dark:text-red-400">Bear</div>
        <ul className="space-y-1.5">
          {(bb.bear ?? []).map((p, i) => <li key={i} className="text-sm leading-snug text-zinc-700 dark:text-zinc-200">• {p}</li>)}
        </ul>
      </div>
    </div>
  );
}

function Section({ data }: { data: ResearchSectionData }) {
  return (
    <section className="rounded-2xl border border-black/[0.07] bg-white p-4 dark:border-white/10 dark:bg-zinc-900/70">
      <h3 className="mb-2 font-semibold text-zinc-900 dark:text-zinc-50">{data.title}</h3>
      {data.notFound ? (
        <p className="text-sm italic text-zinc-400">Not found in the documents.</p>
      ) : (
        <>
          <Content content={data.content} />
          <Sources citations={data.citations} />
        </>
      )}
    </section>
  );
}

function AskBox({ ticker }: { ticker: string }) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [thread, setThread] = useState<{ q: string; a: AskResult }[]>([]);

  const ask = async () => {
    const question = q.trim();
    if (!question || busy) return;
    setBusy(true);
    setQ("");
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker, question }),
      });
      const a: AskResult = await res.json();
      setThread((t) => [{ q: question, a }, ...t]);
    } catch {
      setThread((t) => [{ q: question, a: { answer: "Something went wrong.", notFound: true, citations: [] } }, ...t]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-black/[0.07] bg-white p-4 dark:border-white/10 dark:bg-zinc-900/70">
      <h3 className="mb-2 font-semibold text-zinc-900 dark:text-zinc-50">Ask the documents</h3>
      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ask()}
          placeholder="e.g. what did management say about margins?"
          className="min-w-0 flex-1 rounded-xl border border-black/10 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-white/15 dark:bg-zinc-800"
        />
        <button onClick={ask} disabled={busy}
          className="shrink-0 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black">
          {busy ? "…" : "Ask"}
        </button>
      </div>
      <p className="mt-1.5 text-xs text-zinc-400">Answered only from {ticker}&apos;s annual report + transcripts.</p>

      <div className="mt-3 space-y-3">
        {thread.map((t, i) => (
          <div key={i} className="rounded-xl bg-zinc-50 p-3 dark:bg-white/[0.03]">
            <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{t.q}</div>
            <p className={`mt-1 text-sm leading-relaxed ${t.a.notFound ? "italic text-zinc-400" : "text-zinc-700 dark:text-zinc-200"}`}>
              {t.a.answer}
            </p>
            {t.a.citations.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {t.a.citations.map((c, j) => (
                  <a key={j} href={c.source} target="_blank" rel="noopener noreferrer"
                    className="rounded-md bg-zinc-200/70 px-2 py-0.5 text-[11px] font-medium text-zinc-600 hover:bg-zinc-200 dark:bg-white/10 dark:text-zinc-300">
                    {cite(c as ResearchCitation)}
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

export function ResearchView({ ticker }: { ticker: string }) {
  const [doc, setDoc] = useState<ResearchDocFull | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");

  useEffect(() => {
    fetch(`/api/research/${ticker}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => { setDoc(d); setState("ready"); })
      .catch(() => setState("missing"));
  }, [ticker]);

  if (state === "loading") {
    return <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-black/[0.04] dark:bg-white/[0.04]" />)}</div>;
  }

  if (state === "missing" || !doc) {
    return (
      <div className="rounded-2xl border border-dashed border-black/10 p-8 text-center dark:border-white/15">
        <div className="text-3xl">🔬</div>
        <p className="mt-3 font-medium text-zinc-700 dark:text-zinc-200">No research generated yet</p>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Run the research engine for {ticker} to ground this page in its filings.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {doc.docsUsed?.length > 0 && (
        <p className="px-1 text-xs text-zinc-400">
          Grounded in {doc.docsUsed.length} primary documents · {doc.docsUsed.map((d) => d.period).join(", ")}
        </p>
      )}
      {ORDER.filter((id) => doc.sections[id]).map((id) => (
        <Section key={id} data={doc.sections[id]!} />
      ))}
      <AskBox ticker={ticker} />
    </div>
  );
}
