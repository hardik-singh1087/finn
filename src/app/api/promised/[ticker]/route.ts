// GET /api/promised/:ticker — the cached promised-vs-delivered comparison (primary sources only).
import { NextResponse } from "next/server";
import { store } from "@/lib/store";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const { ticker } = await params;
  const doc = await store.promisedVsDelivered(ticker);
  if (!doc) {
    return NextResponse.json(
      { error: `No promised-vs-delivered built for ${ticker.toUpperCase()} yet.` },
      { status: 404 },
    );
  }
  return NextResponse.json(doc);
}
