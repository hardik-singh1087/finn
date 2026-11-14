import Link from "next/link";
import { Feed } from "@/components/Feed";

export default function Home() {
  return (
    <div className="min-h-dvh bg-zinc-50 dark:bg-black">
      <div className="mx-auto w-full max-w-md px-4 pb-16">
        <header className="pt-6 pb-2">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">FINN</h1>
            <Link
              href="/settings"
              aria-label="Alerts & filters"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-zinc-600 ring-1 ring-black/[0.08] transition hover:text-zinc-900 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-white/10"
            >
              <span className="text-lg leading-none">⚙</span>
            </Link>
          </div>
          <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
            What changed, most important first.
          </p>
        </header>
        <Feed />
      </div>
    </div>
  );
}
