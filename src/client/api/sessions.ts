import { apiFetch } from "./client";

export interface RecentSessionItem {
  id: string;
  ticketId: string;
  ticketTitle: string;
  repoId: string;
  repoName: string;
  model: string;
  opencodeSessionId: string | null;
  totalTokens: number;
  costUsd: number;
  createdAt: number;
  endedAt: number | null;
  durationMs: number | null;
  exitCode: number | null;
  exitReason: string | null;
}

export interface RecentSessionsParams {
  limit?: number;
  repoId?: string;
}

export function fetchRecentSessions(params?: RecentSessionsParams): Promise<RecentSessionItem[]> {
  const searchParams = new URLSearchParams();
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.repoId) searchParams.set("repoId", params.repoId);
  const qs = searchParams.toString();
  return apiFetch(`/api/sessions/recent${qs ? `?${qs}` : ""}`);
}

export function sendSessionMessage(sessionId: string, text: string): Promise<{ success: boolean }> {
  return apiFetch(`/api/sessions/${sessionId}/send-message`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}
