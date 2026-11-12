import { Feed } from "@/components/Feed";

export default function Home() {
  return (
    <div className="min-h-dvh bg-zinc-50 dark:bg-black">
      <div className="mx-auto w-full max-w-md px-4 pb-16">
        <header className="pt-6 pb-2">
          <div className="flex items-baseline justify-between">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">FINN</h1>
            <span className="text-xs font-medium text-zinc-400">your portfolio, filtered</span>
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
