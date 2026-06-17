import type { FastifyInstance } from "fastify";
import { sql, gte } from "drizzle-orm";
import { db, schema } from "../../db";

export function registerCostRoutes(app: FastifyInstance) {
  // Weekly cost summary
  app.get("/api/costs/summary", async () => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    const [costRow] = await db
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

    return {
      weekTotalUsd: costRow.totalUsd,
      weekTotalTokens: costRow.totalTokens,
      sessionCount: costRow.sessionCount,
      ticketCount: ticketCount.count,
    };
  });

  // Cost history (last 30 days, aggregated per day)
  app.get("/api/costs/history", async () => {
    const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    const rows = await db
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

    return rows;
  });
}
