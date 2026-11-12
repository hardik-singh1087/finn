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

export const DATA_DIR = path.join(process.cwd(), "data");

async function readJson<T>(relPath: string, fallback: T): Promise<T> {
  try {
    const buf = await fs.readFile(path.join(DATA_DIR, relPath), "utf-8");
    return JSON.parse(buf) as T;
  } catch {
    return fallback;
  }
}

export const store = {
  readJson,
  prices: <T>(ticker: string) => readJson<T>(`prices/${ticker}.json`, [] as unknown as T),
  announcements: <T>(ticker: string) =>
    readJson<T>(`announcements/${ticker}.json`, [] as unknown as T),
  research: <T>(ticker: string) =>
    readJson<T>(`research/${ticker}.json`, null as unknown as T),
  feed: <T>() => readJson<T>(`feed/latest.json`, [] as unknown as T),
};
