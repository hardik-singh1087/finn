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

/** A corporate filing, after classification. */
export interface Announcement {
  id: string; // stable hash of (ticker + date + title)
  ticker: string;
  date: string; // ISO timestamp of the filing
  title: string;
  type: AnnouncementType;
  source?: string; // NSE/BSE url or file path to the raw filing
  summary?: string; // one-line, cheap-model generated
  importance: number; // 0-100, drives feed sort
}

/** One card in the Push feed / digest. */
export interface FeedItem extends Announcement {
  reason: string; // why this matters, in plain English
  enrichment?: ResultsHeadline | ManagementChangeBio | Record<string, unknown>;
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
  person: string;
  role: string;
  direction: "joining" | "resigning" | "retiring";
  background?: string; // short bio (push-side enrichment is allowed to use outside sources)
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
