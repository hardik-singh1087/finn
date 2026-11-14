"use client";

import { useEffect, useState } from "react";
import type { AnnouncementType } from "@/types/finn";
import { config } from "@/lib/config";

export interface FinnSettings {
  volumeMultiple: number; // alert: volume >= N x avg
  priceMovePct: number; // alert: |move| >= X%
  lookbackDays: number; // how many recent days the alert engine scans
  caredTypes: AnnouncementType[]; // announcement types I want in my feed
}

// Everything the user hasn't muted. Defaults mean "show all real filings; alerts at 2x / 5%".
const ALL_REAL_TYPES = config.categories
  .map((c) => c.id)
  .filter((id) => id !== "unclassified") as AnnouncementType[];

export const DEFAULT_SETTINGS: FinnSettings = {
  volumeMultiple: config.alerts.volumeMultiple,
  priceMovePct: config.alerts.priceMovePct,
  lookbackDays: 10,
  caredTypes: ALL_REAL_TYPES,
};

const KEY = "finn.settings.v1";

/** Per-viewer settings, persisted in localStorage (falls back to defaults everywhere). */
export function useSettings(): [FinnSettings, (next: Partial<FinnSettings>) => void, () => void] {
  const [settings, setSettings] = useState<FinnSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) });
    } catch {
      /* private mode / blocked storage — keep defaults */
    }
  }, []);

  const update = (next: Partial<FinnSettings>) => {
    setSettings((prev) => {
      const merged = { ...prev, ...next };
      try {
        localStorage.setItem(KEY, JSON.stringify(merged));
      } catch {
        /* ignore */
      }
      return merged;
    });
  };

  const reset = () => {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    setSettings(DEFAULT_SETTINGS);
  };

  return [settings, update, reset];
}
