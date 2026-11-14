// POST /api/ask  { ticker, question } -> grounded answer from the company's own docs, with sources.
import { NextRequest, NextResponse } from "next/server";
import { askDocuments } from "@/lib/research";

export async function POST(req: NextRequest) {
  let ticker = "";
  let question = "";
  try {
    const body = await req.json();
    ticker = String(body.ticker ?? "").trim();
    question = String(body.question ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (!ticker || !question) {
    return NextResponse.json({ error: "ticker and question are required" }, { status: 400 });
  }
  const result = await askDocuments(ticker, question.slice(0, 400));
  return NextResponse.json(result);
}
