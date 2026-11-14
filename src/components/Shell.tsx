import Link from "next/link";
import type { ReactNode } from "react";

/** Consistent page frame: centered phone column, soft gradient page, room for the tab bar. */
export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-gradient-to-b from-[var(--background)] to-black/[0.02] dark:to-white/[0.02]">
      <div className="mx-auto w-full max-w-md px-4 pb-28">{children}</div>
    </div>
  );
}

/** Page title block. Pass `back` for a sub-page back pill, `action` for a right-side control. */
export function AppHeader({
  title, subtitle, back, action, brand,
}: {
  title: string;
  subtitle?: string;
  back?: string;
  action?: ReactNode;
  brand?: boolean;
}) {
  return (
    <header className="pt-6 pb-3">
      {back && (
        <Link
          href={back}
          className="mb-3 inline-flex items-center gap-1 rounded-full bg-[var(--surface)] px-3 py-1.5 text-sm font-medium text-zinc-600 ring-1 ring-black/[0.06] transition active:scale-95 dark:text-zinc-300 dark:ring-white/10"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4"><path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Back
        </Link>
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-[26px] font-bold leading-tight tracking-tight text-zinc-900 dark:text-zinc-50">
            {brand && (
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-[15px] font-black text-white shadow-sm">F</span>
            )}
            <span className="truncate">{title}</span>
          </h1>
          {subtitle && <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </header>
  );
}
