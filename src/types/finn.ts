// Shared domain types for FINN. Kept deliberately small — expand as features land.

/** The 16 real announcement categories + the routine bucket. One filing -> exactly one. */
export type AnnouncementType =
  | "results"
  | "M&A"
  | "fund_raise"
  | "management_change"
  | "litigation"
  | "insider_trading"
  | "earnings_call"
  | "investor_meetings"
  | "credit_rating"
  | "dividend"
  | "bonus_split"
  | "capex"
  | "press_release"
  | "postal_ballot"
  | "agm_egm"
  | "pledging"
  | "unclassified";

export type PriorityTier = "high" | "medium" | "low";

export interface Company {
  ticker: string; // NSE symbol, e.g. "RELIANCE"
  name: string;
  sector: string;
  yahoo?: string; // override when Yahoo symbol differs from NSE (e.g. ZOMATO -> ETERNAL)
  screener?: string; // screener.in slug when it differs from the ticker
  note?: string;
}

/** End-of-day price bar for one ticker on one day. */
export interface PriceBar {
  date: string; // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** Per-stock rollup written by fetch_prices.py — feeds the API and the unusual-move alerts. */
export interface PriceSummary {
  ticker: string;
  name: string;
  sector: string;
  latestDate: string; // YYYY-MM-DD of the latest bar
  latestClose: number;
  prevClose: number | null;
  changePct1d: number | null; // % vs previous close
  latestVolume: number;
  avgVolume20d: number;
  volumeVsAvg: number | null; // latestVolume / avgVolume20d (>= ~2 is "unusual")
  bars: number; // how many daily bars are stored
  fetchedOn: string; // YYYY-MM-DD (IST) the data was last pulled — same-day cache key
}

export interface PriceSummaryFile {
  generatedAt: string;
  stocks: PriceSummary[];
}

/** A corporate filing, after classification. */
export interface Announcement {
  id: string; // stable hash of (ticker + date + title)
  ticker: string;
  company: string; // issuer name as filed
  date: string; // ISO timestamp of the filing
  title: string; // exchange subject line
  exchangeSubject?: string; // raw NSE/BSE subject (kept as a classifier hint)
  type: AnnouncementType;
  summary?: string; // one-line, cheap-model (or rules) generated
  importance: number; // 0-100, drives feed sort
  source?: string; // NSE/BSE url to the raw filing (usually a PDF)
  rawText?: string; // the filing's own text, as provided by the exchange
  exchange?: "NSE" | "BSE" | "seed";
  enrichment?: Enrichment; // extra detail for mgmt-change / results (push-side, cached)
}

/** Push-side "extra detail" attached to a card (cheap model, cached). */
export interface Enrichment {
  kind: "management_change" | "results";
  bio?: ManagementChangeBio;
  results?: ResultsHeadline;
}

/** An unusual end-of-day price/volume move — computed by the alert engine per the user's thresholds. */
export interface Alert {
  ticker: string;
  company: string;
  date: string; // YYYY-MM-DD of the breach
  kind: "volume" | "price";
  value: number; // volume: the ×avg multiple; price: the day's % move
  threshold: number; // the setting that was crossed (N or X)
  close: number;
  changePct: number; // that day's % move (context)
  volumeVsAvg: number; // that day's volume multiple (context)
}

/** One card in the Push feed / digest. */
export interface FeedItem extends Announcement {
  reason: string; // why this matters, in plain English
}

/** Quarterly results, first-cut headline numbers (QoQ + YoY). */
export interface ResultsHeadline {
  quarter: string; // e.g. "Q2 FY26"
  revenue: MetricCompare;
  ebitda: MetricCompare;
  pbt: MetricCompare;
  pat: MetricCompare;
}

export interface MetricCompare {
  current: number;
  qoq?: number; // % change vs previous quarter
  yoy?: number; // % change vs same quarter last year
  unit?: string; // e.g. "INR cr"
}

export interface ManagementChangeBio {
  person: string | null;
  role?: string | null;
  direction?: string | null; // joining | resigning | retiring | reappointed
  background?: string | null; // short bio (push-side enrichment may use outside sources)
}

// ---- Research / Pull side (grounded in primary docs only) ----

export type ResearchSectionId =
  | "business_snapshot" | "financial_snapshot" | "trajectory" | "balance_sheet"
  | "cash_quality" | "guidance" | "bull_vs_bear";

export interface ResearchCitation {
  n?: number;
  docType: "annual_report" | "concall_transcript";
  period: string;
  page: number;
  source: string;
  snippet: string;
}

export interface FinMetric { metric: string; value: string; n?: number }
export interface BullBear { bull: string[]; bear: string[] }

export interface ResearchSectionData {
  title: string;
  model: string | null;
  notFound: boolean;
  content: string | FinMetric[] | BullBear | null;
  citations: ResearchCitation[];
}

export interface ResearchDocFull {
  ticker: string;
  name?: string;
  generatedAt: string;
  docsUsed: { docType: string; period: string; source: string }[];
  sections: Partial<Record<ResearchSectionId, ResearchSectionData>>;
}

/** A grounded answer to a follow-up question. */
export interface AskResult {
  answer: string;
  notFound: boolean;
  citations: Omit<ResearchCitation, "n">[];
}

/** One searchable chunk of a company's own primary document (AR or concall transcript). */
export interface ResearchChunk {
  id: string;
  ticker: string;
  docType: "annual_report" | "concall_transcript";
  period: string; // e.g. "FY2026" or "Aug 2026"
  source: string; // url of the original PDF
  page: number;
  text: string;
}

/** A cached Pull/research output, grounded in primary sources only. */
export interface ResearchDoc {
  ticker: string;
  generatedAt: string;
  model: string;
  sources: string[]; // paths/urls of the primary docs used (AR + transcripts)
  sections: Partial<Record<ResearchSection, unknown>>;
}

export type ResearchSection =
  | "business_snapshot"
  | "financial_snapshot"
  | "trajectory"
  | "balance_sheet"
  | "cash_quality"
  | "narrative_vs_numbers"
  | "guidance"
  | "bull_vs_bear"
  | "promised_vs_delivered"; // the star feature
