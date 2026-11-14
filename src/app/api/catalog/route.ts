// GET /api/catalog — the companies you can research, and which already have cached output.
// Research is generic for any ticker with fundamentals; the demo set is pre-built so it's instant.
import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { config } from "@/lib/config";

export async function GET() {
  const dir = path.join(process.cwd(), "data", "research");
  let files: string[] = [];
  try {
    files = await fs.readdir(dir);
  } catch {
    files = [];
  }
  const has = (t: string, suffix: string) => files.includes(`${t.toUpperCase()}${suffix}`);

  const toRow = (c: { ticker: string; name: string; sector: string }, group: "research" | "portfolio") => ({
    ticker: c.ticker,
    name: c.name,
    sector: c.sector,
    group,
    hasResearch: has(c.ticker, ".json"),
    hasPvd: has(c.ticker, ".pvd.json"),
  });

  const research = config.researchTickers.map((c) => toRow(c, "research"));
  const portfolio = config.portfolio.map((c) => toRow(c, "portfolio"));

  return NextResponse.json({ research, portfolio });
}
