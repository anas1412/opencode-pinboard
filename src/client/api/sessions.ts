import { request } from "./rpc-client"

export interface RecentSessionItem {
  id: string
  ticketId: string | null
  ticketTitle: string | null
  initialPrompt: string | null
  repoId: string | null
  repoName: string | null
  model: string
  opencodeSessionId: string | null
  totalTokens: number
  costUsd: number
  createdAt: number
  endedAt: number | null
  durationMs: number | null
  exitCode: number | null
  exitReason: string | null
}

export interface RecentSessionsParams {
  limit?: number
  repoId?: string
}

export function fetchRecentSessions(params?: RecentSessionsParams): Promise<RecentSessionItem[]> {
  return request("recentSessions", { limit: params?.limit, repoId: params?.repoId }).then((sessions) =>
    sessions.map((s) => ({
      id: s.id,
      ticketId: s.ticketId ?? null,
      ticketTitle: s.ticketTitle ?? null,
      initialPrompt: s.initialPrompt ?? null,
      repoId: s.repoId ?? null,
      repoName: s.repoName ?? null,
      model: s.model,
      opencodeSessionId: s.opencodeSessionId,
      totalTokens: s.totalTokens,
      costUsd: s.costUsd,
      createdAt: s.createdAt,
      endedAt: s.endedAt,
      durationMs: s.durationMs,
      exitCode: s.exitCode,
      exitReason: s.exitReason,
    })),
  )
}

export function sendSessionMessage(sessionId: string, text: string): Promise<void> {
  return request("sendSessionMessage", { id: sessionId, text })
}
