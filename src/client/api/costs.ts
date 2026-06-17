import { apiFetch } from "./client";

export interface CostSummary {
  weekTotalUsd: number;
  weekTotalTokens: number;
  sessionCount: number;
  ticketCount: number;
  breakdown: {
    opentack: { usd: number; tokens: number };
    opencode: { usd: number; tokens: number };
  };
}

export function fetchCostSummary(): Promise<CostSummary> {
  return apiFetch("/api/costs/summary");
}
