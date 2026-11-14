"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type Tab = { href: string; label: string; icon: ReactNode; match: (p: string) => boolean };

const I = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
    strokeLinecap="round" strokeLinejoin="round" className="h-[22px] w-[22px]">
    {d.split("|").map((p, i) => <path key={i} d={p} />)}
  </svg>
);

const TABS: Tab[] = [
  {
    href: "/", label: "Feed", match: (p) => p === "/",
    icon: <I d="M4 6h16|M4 12h16|M4 18h10" />,
  },
  {
    href: "/alerts", label: "Alerts", match: (p) => p.startsWith("/alerts"),
    icon: <I d="M13 3 4 14h7l-1 7 9-11h-7z" />,
  },
  {
    href: "/research", label: "Research", match: (p) => p.startsWith("/research"),
    icon: <I d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z|M21 21l-4.3-4.3" />,
  },
  {
    href: "/settings", label: "Settings", match: (p) => p.startsWith("/settings"),
    icon: <I d="M4 7h10|M18 7h2|M4 17h2|M10 17h10|M14 4v6|M8 14v6" />,
  },
];

export function BottomNav() {
  const pathname = usePathname() ?? "/";
  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-30">
      <div className="pointer-events-auto mx-auto max-w-md px-3 pb-safe">
        <div className="mb-1 flex items-stretch justify-around rounded-2xl border border-black/[0.06] bg-white/85 shadow-[0_-1px_24px_rgba(0,0,0,0.06)] backdrop-blur-xl dark:border-white/10 dark:bg-zinc-900/80">
          {TABS.map((t) => {
            const active = t.match(pathname);
            return (
              <Link
                key={t.href}
                href={t.href}
                aria-label={t.label}
                aria-current={active ? "page" : undefined}
                className="group relative flex flex-1 flex-col items-center gap-0.5 py-2.5"
              >
                <span
                  className={`flex h-9 w-14 items-center justify-center rounded-full transition-colors ${
                    active
                      ? "bg-brand/10 text-brand"
                      : "text-zinc-400 group-active:scale-90 dark:text-zinc-500"
                  }`}
                >
                  {t.icon}
                </span>
                <span
                  className={`text-[11px] font-medium transition-colors ${
                    active ? "text-brand" : "text-zinc-400 dark:text-zinc-500"
                  }`}
                >
                  {t.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
