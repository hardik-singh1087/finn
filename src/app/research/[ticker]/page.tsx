import Link from "next/link";
import { companyByTicker } from "@/lib/config";

// Dynamic per-ticker route — render on demand (reads params).
export const instant = false;

// Stub — the Pull/research view (snapshot → promised-vs-delivered → ask) lands in Phase 3.
export default async function ResearchPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = await params;
  const company = companyByTicker(ticker);

  return (
    <div className="min-h-dvh bg-zinc-50 dark:bg-black">
      <div className="mx-auto w-full max-w-md px-4 pb-16">
        <header className="flex items-center gap-3 pt-6 pb-4">
          <Link
            href="/"
            className="rounded-full bg-white px-3 py-1.5 text-sm font-medium text-zinc-600 ring-1 ring-black/[0.08] dark:bg-zinc-900 dark:text-zinc-300 dark:ring-white/10"
          >
            ← Feed
          </Link>
        </header>

        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          {company?.name ?? ticker.toUpperCase()}
        </h1>
        <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {ticker.toUpperCase()}
          {company?.sector ? ` · ${company.sector}` : ""}
        </div>

        <div className="mt-8 rounded-2xl border border-dashed border-black/10 p-8 text-center dark:border-white/15">
          <div className="text-3xl">🔬</div>
          <p className="mt-3 font-medium text-zinc-700 dark:text-zinc-200">Research view coming soon</p>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Snapshot, trajectory, cash quality, and the “promised vs delivered” read — grounded only in{" "}
            {company?.name ?? "this company"}’s own filings.
          </p>
        </div>
      </div>
    </div>
  );
}
