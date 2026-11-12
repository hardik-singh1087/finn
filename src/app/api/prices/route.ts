// GET /api/prices — latest price & volume for every portfolio stock.
// Reads the committed data/prices/_summary.json (written by fetch_prices.py).
// next.config.ts traces data/*.json into the serverless bundle so this works on Vercel.

import { NextResponse } from "next/server";
import { store } from "@/lib/store";

export async function GET() {
  const summary = await store.priceSummary();
  return NextResponse.json(summary);
}
