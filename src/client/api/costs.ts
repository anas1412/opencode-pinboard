import { apiFetch } from "./client";

export interface CostSummary {
  weekTotalUsd: number;
  weekTotalTokens: number;
  sessionCount: number;
  ticketCount: number;
  perRepo: {
    repoId: string;
    repoName: string;
    usd: number;
    tokens: number;
    sessionCount: number;
  }[];
}

export function fetchCostSummary(): Promise<CostSummary> {
  return apiFetch("/api/costs/summary");
}

export interface CostHistoryEntry {
  date: string;
  totalUsd: number;
  totalTokens: number;
  sessionCount: number;
}

export function fetchCostHistory(): Promise<CostHistoryEntry[]> {
  return apiFetch("/api/costs/history");
}
