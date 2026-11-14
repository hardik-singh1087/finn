"use client";

import { useEffect, useState } from "react";

const KEY = "finn.intro.dismissed.v1";

const STEPS = [
  { n: "1", title: "Look", body: "A feed of what changed in your stocks — most important first, routine hidden." },
  { n: "2", title: "Dig in", body: "Tap a company for research built only from its own filings." },
  { n: "3", title: "Ask", body: "Promised vs delivered, then ask your own questions — every answer cited." },
];

export function Intro() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try { setShow(localStorage.getItem(KEY) !== "1"); } catch { setShow(true); }
  }, []);

  const dismiss = () => {
    setShow(false);
    try { localStorage.setItem(KEY, "1"); } catch { /* ignore */ }
  };

  if (!show) return null;

  return (
    <section className="rise mb-4 overflow-hidden rounded-2xl border border-brand/20 bg-gradient-to-b from-brand/[0.07] to-transparent p-4 dark:border-brand/25">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
            Too much market news. FINN shows the few things that matter.
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">Here&apos;s the whole app in three steps.</p>
        </div>
        <button
          onClick={dismiss}
          aria-label="Dismiss intro"
          className="shrink-0 rounded-full p-1 text-zinc-400 transition active:scale-90 hover:text-zinc-600 dark:hover:text-zinc-200"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4"><path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" /></svg>
        </button>
      </div>

      <ol className="mt-3 space-y-2">
        {STEPS.map((s) => (
          <li key={s.n} className="flex gap-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">{s.n}</span>
            <div className="min-w-0">
              <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{s.title}</span>
              <span className="text-sm text-zinc-500 dark:text-zinc-400"> — {s.body}</span>
            </div>
          </li>
        ))}
      </ol>

      <button
        onClick={dismiss}
        className="mt-3 w-full rounded-xl bg-brand py-2.5 text-sm font-semibold text-white transition active:scale-[0.99]"
      >
        Got it — show my feed
      </button>
    </section>
  );
}
