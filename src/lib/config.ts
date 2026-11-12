// Typed accessor for the shared config (config/finn.config.json).
// The SAME json is read by the Python pipeline (data-pipeline/config.py),
// so the app and the data stay in lockstep.

import raw from "../../config/finn.config.json";
import type { AnnouncementType, Company, PriorityTier } from "@/types/finn";

export interface CategoryConfig {
  id: AnnouncementType;
  label: string;
  tier: PriorityTier;
  weight: number;
}

export interface FinnConfig {
  appName: string;
  tagline: string;
  portfolio: Company[];
  researchTickers: Company[];
  alerts: {
    digestWindowHours: number;
    digestWindowOptions: number[];
    priceMovePct: number;
    volumeMultiple: number;
    volumeLookbackDays: number;
    materialTypes: AnnouncementType[];
  };
  models: {
    cheap: string;
    mid: string;
    strong: string;
    cacheDir: string;
    routing: Record<string, "cheap" | "mid" | "strong">;
    notes: string;
  };
  categories: CategoryConfig[];
}

export const config = raw as unknown as FinnConfig;

export const categoryById = (id: string): CategoryConfig | undefined =>
  config.categories.find((c) => c.id === id);

export const companyByTicker = (ticker: string): Company | undefined =>
  [...config.portfolio, ...config.researchTickers].find(
    (c) => c.ticker.toUpperCase() === ticker.toUpperCase(),
  );
