import Database from "bun:sqlite";
import { homedir } from "os";
import { existsSync } from "fs";
import type { FastifyInstance } from "fastify";
import { sql, gte } from "drizzle-orm";
import { db, schema } from "../../db";

function getOpencodeDb(): Database | null {
  const dbPath = `${homedir()}/.local/share/opencode/opencode.db`;
  if (!existsSync(dbPath)) return null;
  try {
    return new Database(dbPath, { readonly: true });
  } catch {
    return null;
  }
}

export function registerCostRoutes(app: FastifyInstance) {
  // Weekly cost summary (combines OpenTack + opencode data)
  app.get("/api/costs/summary", async () => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    // 1. OpenTack's own cost records
    const [odCostRow] = await db
      .select({
        totalUsd: sql<number>`COALESCE(SUM(${schema.costRecords.costUsd}), 0)`,
        totalTokens: sql<number>`COALESCE(SUM(${schema.costRecords.promptTokens} + ${schema.costRecords.completionTokens}), 0)`,
        sessionCount: sql<number>`COUNT(*)`,
      })
      .from(schema.costRecords)
      .where(gte(schema.costRecords.recordedAt, weekAgo));

    const [ticketCount] = await db
      .select({
        count: sql<number>`COUNT(DISTINCT ${schema.tickets.id})`,
      })
      .from(schema.tickets)
      .where(gte(schema.tickets.createdAt, weekAgo));

    // 2. opencode's own DB (global usage across all opencode sessions)
    let ocCost = 0;
    let ocTokens = 0;
    let ocSessions = 0;

    const ocDb = getOpencodeDb();
    if (ocDb) {
      try {
        const row = ocDb
          .query(
            `SELECT
               COALESCE(SUM(cost), 0) as total_cost,
               COALESCE(SUM(tokens_input + tokens_output), 0) as total_tokens,
               COUNT(*) as session_count
             FROM session
             WHERE time_created > ?`,
          )
          .get(weekAgo) as { total_cost: number; total_tokens: number; session_count: number };

        ocCost = row.total_cost;
        ocTokens = row.total_tokens;
        ocSessions = row.session_count;
        ocDb.close();
      } catch {
        ocDb.close();
      }
    }

    return {
      weekTotalUsd: odCostRow.totalUsd + ocCost,
      weekTotalTokens: odCostRow.totalTokens + ocTokens,
      sessionCount: odCostRow.sessionCount + ocSessions,
      ticketCount: ticketCount.count,
      // Include breakdown so UI can show source if needed
      breakdown: {
        opentack: { usd: odCostRow.totalUsd, tokens: odCostRow.totalTokens },
        opencode: { usd: ocCost, tokens: ocTokens },
      },
    };
  });

  // Cost history (last 30 days, aggregated per day)
  app.get("/api/costs/history", async () => {
    const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    // OpenTack cost history
    const odRows = await db
      .select({
        date: sql<string>`DATE(${schema.costRecords.recordedAt} / 1000, 'unixepoch')`,
        totalUsd: sql<number>`COALESCE(SUM(${schema.costRecords.costUsd}), 0)`,
        totalTokens: sql<number>`COALESCE(SUM(${schema.costRecords.promptTokens} + ${schema.costRecords.completionTokens}), 0)`,
        sessionCount: sql<number>`COUNT(*)`,
      })
      .from(schema.costRecords)
      .where(gte(schema.costRecords.recordedAt, monthAgo))
      .groupBy(sql`DATE(${schema.costRecords.recordedAt} / 1000, 'unixepoch')`)
      .orderBy(sql`DATE(${schema.costRecords.recordedAt} / 1000, 'unixepoch')`);

    return odRows;
  });
}
