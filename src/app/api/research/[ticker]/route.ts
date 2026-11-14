// GET /api/research/:ticker — the cached, grounded research doc (primary sources only).
import { NextResponse } from "next/server";
import { store } from "@/lib/store";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const { ticker } = await params;
  const doc = await store.researchDoc(ticker);
  if (!doc) {
    return NextResponse.json(
      { error: `No research generated for ${ticker.toUpperCase()} yet.` },
      { status: 404 },
    );
  }
  return NextResponse.json(doc);
}
