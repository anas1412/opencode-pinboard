import { db, schema } from "../db";
import { isNull } from "drizzle-orm";
import { getOpencodeDb } from "./routes/cost-utils";
import { emitSse } from "./sse";

const lastKnownCosts = new Map<string, { costUsd: number; tokens: number }>();

/**
 * Background watcher that queries opencode's SQLite DB for active session
 * cost/token data and emits `session.cost` SSE events when values change.
 * Only one interval runs across the entire server process.
 */
export function startCostWatcher(intervalMs = 3000): void {
  setInterval(async () => {
    try {
      const active = await db
        .select({
          id: schema.sessions.id,
          ticketId: schema.sessions.ticketId,
          opencodeSessionId: schema.sessions.opencodeSessionId,
        })
        .from(schema.sessions)
        .where(isNull(schema.sessions.endedAt));

      if (active.length === 0) return;

      const ocDb = getOpencodeDb();
      if (!ocDb) return;

      try {
        for (const session of active) {
          if (!session.opencodeSessionId) continue;

          const row = ocDb
            .query(
              `SELECT cost, tokens_input + tokens_output as total_tokens
               FROM session WHERE id = ?`,
            )
            .get(session.opencodeSessionId) as
            | { cost: number; total_tokens: number }
            | undefined;

          if (!row) continue;

          const last = lastKnownCosts.get(session.id);
          if (
            !last ||
            last.costUsd !== row.cost ||
            last.tokens !== row.total_tokens
          ) {
            lastKnownCosts.set(session.id, {
              costUsd: row.cost,
              tokens: row.total_tokens,
            });
            emitSse({
              type: "session.cost",
              sessionId: session.id,
              ticketId: session.ticketId,
              costUsd: row.cost,
              tokens: row.total_tokens,
            });
          }
        }
      } finally {
        ocDb.close();
      }
    } catch {
      // watcher errors are non-fatal
    }
  }, intervalMs);
}
