import { store } from "@/lib/store";
import type { AskResult, ResearchChunk } from "@/types/finn";

// Lightweight keyword retrieval over a company's own chunks (mirrors the Python BM25 spirit:
// $0, offline, deterministic). Good enough to feed the grounding model for follow-up Q&A.

const STOP = new Set([
  "the", "a", "an", "of", "to", "in", "on", "for", "and", "or", "is", "are", "was", "were",
  "be", "as", "at", "by", "it", "its", "this", "that", "with", "from", "we", "our", "about",
  "what", "did", "do", "does", "how", "has", "have", "they", "their", "will", "would", "s",
]);

const SYN: Record<string, string[]> = {
  revenue: ["sales", "turnover", "topline"], sales: ["revenue", "turnover"],
  profit: ["pat", "pbt", "earnings"], pat: ["profit", "net"], margin: ["margins", "ebitda"],
  cash: ["cashflow", "operations", "fcf"], debt: ["borrowings", "leverage"],
  guidance: ["outlook", "guided", "expect", "target"], capex: ["capacity", "expansion", "capital"],
  growth: ["grew", "yoy", "cagr"], store: ["stores", "outlet"], margins: ["margin", "ebitda"],
};

function tokenize(s: string): string[] {
  return (s.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((t) => t.length >= 2 && !STOP.has(t));
}

function expand(tokens: string[]): string[] {
  const out = [...tokens];
  for (const t of tokens) if (SYN[t]) out.push(...SYN[t]);
  return out;
}

// BM25 (Okapi) over the chunks — rare, specific query terms outrank common ones.
export function retrieve(chunks: ResearchChunk[], question: string, k: number): ResearchChunk[] {
  const qTerms = [...new Set(expand(tokenize(question)))];
  const docs = chunks.map((c) => tokenize(c.text));
  const N = docs.length || 1;
  const avgdl = docs.reduce((s, d) => s + d.length, 0) / N;

  const df = new Map<string, number>();
  for (const t of qTerms) {
    let n = 0;
    for (const d of docs) if (d.includes(t)) n++;
    df.set(t, n);
  }
  const k1 = 1.5, b = 0.75;
  const scored = chunks.map((c, i) => {
    const d = docs[i];
    const dl = d.length || 1;
    let score = 0;
    for (const t of qTerms) {
      const n = df.get(t) ?? 0;
      if (!n) continue;
      let f = 0;
      for (const w of d) if (w === t) f++;
      if (!f) continue;
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      score += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * dl) / avgdl)));
    }
    return { c, score };
  });
  return scored.sort((a, b) => b.score - a.score).slice(0, k).filter((x) => x.score > 0).map((x) => x.c);
}

const label = (c: ResearchChunk) =>
  `${c.docType === "annual_report" ? "Annual Report" : "Concall"} · ${c.period} · p.${c.page}`;

const SYSTEM =
  "You answer ONLY from the numbered document excerpts provided — a single company's own annual " +
  "report and earnings-call transcripts. Do NOT use outside knowledge or memory. Cite the excerpt " +
  "number(s) you use like [2]. If the excerpts do not contain the answer, set notFound true and " +
  'say so. Respond ONLY as JSON: {"notFound": <bool>, "used": [<excerpt numbers>], "answer": "<2-4 sentences>"}.';

/** Answer a follow-up question grounded strictly in the ticker's own documents. */
export async function askDocuments(ticker: string, question: string): Promise<AskResult> {
  const chunks = await store.chunks(ticker);
  if (!chunks.length) {
    return { answer: "No documents are loaded for this company yet.", notFound: true, citations: [] };
  }
  const top = retrieve(chunks, question, 8);
  if (!top.length) {
    return { answer: "Not found in the documents.", notFound: true, citations: [] };
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return { answer: "Follow-up Q&A needs GEMINI_API_KEY configured on the server.", notFound: true, citations: [] };
  }

  const context = top
    .map((c, i) => `[${i + 1}] (${label(c)})\n${c.text.replace(/\s+/g, " ").slice(0, 700)}`)
    .join("\n\n");

  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=" +
    encodeURIComponent(key);
  const body = {
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents: [{ parts: [{ text: `Question: ${question}\n\nExcerpts:\n\n${context}` }] }],
    generationConfig: { temperature: 0, responseMimeType: "application/json", maxOutputTokens: 600 },
  };

  let parsed: { notFound?: boolean; used?: number[]; answer?: string } = {};
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const m = text.match(/\{[\s\S]*\}/);
    if (m) parsed = JSON.parse(m[0]);
  } catch {
    return { answer: "Sorry — the answer service is unavailable right now.", notFound: true, citations: [] };
  }

  const used = (parsed.used ?? []).filter((n) => Number.isInteger(n) && n >= 1 && n <= top.length);
  const cites = (used.length ? used : top.map((_, i) => i + 1)).map((n) => {
    const c = top[n - 1];
    return {
      docType: c.docType, period: c.period, page: c.page, source: c.source,
      snippet: c.text.replace(/\s+/g, " ").slice(0, 240),
    };
  });

  return {
    answer: parsed.answer || "Not found in the documents.",
    notFound: !!parsed.notFound,
    citations: parsed.notFound ? [] : cites,
  };
}
