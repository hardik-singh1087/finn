// Simple file-backed data store. The Python pipeline WRITES these files;
// the Next.js app (server components / route handlers) READS them.
// JSON on disk, committed to the repo, so the demo always runs with zero setup.
//
// Layout (see data/README.md):
//   data/prices/<TICKER>.json          -> PriceBar[]
//   data/announcements/<TICKER>.json   -> Announcement[]
//   data/fundamentals/<TICKER>/...     -> raw primary docs (AR text, transcripts)
//   data/research/<TICKER>.json        -> cached ResearchDoc (model output)
//   data/feed/latest.json              -> precomputed FeedItem[] for the digest
//
// Server-only: uses node fs. Never import this into a client component.

import { promises as fs } from "fs";
import path from "path";
import type {
  Announcement, Enrichment, PriceBar, PriceSummaryFile, ResearchChunk, ResearchDocFull,
} from "@/types/finn";
import { config } from "@/lib/config";

export const DATA_DIR = path.join(process.cwd(), "data");

async function readJson<T>(relPath: string, fallback: T): Promise<T> {
  try {
    const buf = await fs.readFile(path.join(DATA_DIR, relPath), "utf-8");
    return JSON.parse(buf) as T;
  } catch {
    return fallback;
  }
}

const EMPTY_SUMMARY: PriceSummaryFile = { generatedAt: "", stocks: [] };

export const store = {
  readJson,
  prices: (ticker: string) => readJson<PriceBar[]>(`prices/${ticker}.json`, []),
  priceSummary: () => readJson<PriceSummaryFile>(`prices/_summary.json`, EMPTY_SUMMARY),
  announcements: (ticker: string) =>
    readJson<Announcement[]>(`announcements/${ticker}.json`, []),

  /** Every portfolio ticker's announcements, merged into one array (unsorted). */
  allAnnouncements: async (): Promise<Announcement[]> => {
    const lists = await Promise.all(
      config.portfolio.map((c) => readJson<Announcement[]>(`announcements/${c.ticker}.json`, [])),
    );
    return lists.flat();
  },
  research: <T>(ticker: string) =>
    readJson<T>(`research/${ticker}.json`, null as unknown as T),
  researchDoc: (ticker: string) =>
    readJson<ResearchDocFull | null>(`research/${ticker.toUpperCase()}.json`, null),
  chunks: (ticker: string) =>
    readJson<ResearchChunk[]>(`fundamentals/${ticker.toUpperCase()}/chunks.json`, []),
  feed: <T>() => readJson<T>(`feed/latest.json`, [] as unknown as T),
  enrichment: () => readJson<Record<string, Enrichment>>(`enrichment.json`, {}),
};
