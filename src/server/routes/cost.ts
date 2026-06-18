import type { FastifyInstance } from "fastify";
import { sql, gte } from "drizzle-orm";
import { db, schema } from "../../db";
import { getOpencodeDb } from "./cost-utils";

export function registerCostRoutes(app: FastifyInstance) {
  // All cost data comes from opencode's DB — the sole source of truth.
  // OpenTack never tracks costs itself.

  // Weekly cost summary with per-repo breakdown
  app.get("/api/costs/summary", async () => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const ocDb = getOpencodeDb();

    if (!ocDb) {
      return {
        weekTotalUsd: 0,
        weekTotalTokens: 0,
        sessionCount: 0,
        ticketCount: 0,
        perRepo: [],
        overheadUsd: 0,
        overheadTokens: 0,
      };
    }

    try {
      // Global weekly totals
      const totals = ocDb
        .query(
          `SELECT
             COALESCE(SUM(cost), 0) as total_cost,
             COALESCE(SUM(tokens_input + tokens_output), 0) as total_tokens,
             COUNT(*) as session_count
           FROM session
           WHERE time_created > ?`,
        )
        .get(weekAgo) as { total_cost: number; total_tokens: number; session_count: number };

      // Per-directory breakdown — map directories to OpenTack repos
      const perDirRows = ocDb
        .query(
          `SELECT
             directory,
             COALESCE(SUM(cost), 0) as cost,
             COALESCE(SUM(tokens_input + tokens_output), 0) as tokens,
             COUNT(*) as sessions
           FROM session
           WHERE time_created > ?
           GROUP BY directory`,
        )
        .all(weekAgo) as { directory: string; cost: number; tokens: number; sessions: number }[];

      ocDb.close();

      // Map directories to repos
      const allRepos = await db.select().from(schema.repos);
      const pathToRepo = new Map(allRepos.map((r) => [r.localPath, { id: r.id, name: r.name }]));

      const perRepoMap = new Map<string, { repoId: string; repoName: string; usd: number; tokens: number; sessionCount: number }>();

      for (const d of perDirRows) {
        const repo = pathToRepo.get(d.directory);
        if (!repo) continue; // only repos added to OpenTack
        const existing = perRepoMap.get(repo.id);
        if (existing) {
          existing.usd += d.cost;
          existing.tokens += d.tokens;
          existing.sessionCount += d.sessions;
        } else {
          perRepoMap.set(repo.id, { repoId: repo.id, repoName: repo.name, usd: d.cost, tokens: d.tokens, sessionCount: d.sessions });
        }
      }

      // Count tickets created this week from OpenTack's DB (metadata only, no costs)
      const [ticketCount] = await db
        .select({ count: sql<number>`COUNT(DISTINCT ${schema.tickets.id})` })
        .from(schema.tickets)
        .where(gte(schema.tickets.createdAt, weekAgo));

      // App-level overhead costs (prompt improvement, notes generation)
      let overheadUsd = 0;
      let overheadTokens = 0;
      try {
        const [overhead] = await db
          .select({
            costUsd: sql<number>`COALESCE(SUM(${schema.appCost.costUsd}), 0)`,
            totalTokens: sql<number>`COALESCE(SUM(${schema.appCost.totalTokens}), 0)`,
          })
          .from(schema.appCost)
          .where(gte(schema.appCost.createdAt, weekAgo));
        overheadUsd = overhead.costUsd;
        overheadTokens = overhead.totalTokens;
      } catch { /* table may not exist yet */ }

      return {
        weekTotalUsd: totals.total_cost,
        weekTotalTokens: totals.total_tokens,
        sessionCount: totals.session_count,
        ticketCount: ticketCount.count,
        perRepo: Array.from(perRepoMap.values()),
        overheadUsd,
        overheadTokens,
      };
    } catch {
      ocDb.close();
      return {
        weekTotalUsd: 0,
        weekTotalTokens: 0,
        sessionCount: 0,
        ticketCount: 0,
        perRepo: [],
        overheadUsd: 0,
        overheadTokens: 0,
      };
    }
  });

  // Cost history per day (last 30 days)
  app.get("/api/costs/history", async () => {
    const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const ocDb = getOpencodeDb();

    if (!ocDb) return [];

    try {
      const rows = ocDb
        .query(
          `SELECT
             DATE(time_created / 1000, 'unixepoch') as date,
             COALESCE(SUM(cost), 0) as totalUsd,
             COALESCE(SUM(tokens_input + tokens_output), 0) as totalTokens,
             COUNT(*) as sessionCount
           FROM session
           WHERE time_created > ?
           GROUP BY DATE(time_created / 1000, 'unixepoch')
           ORDER BY date`,
        )
        .all(monthAgo) as { date: string; totalUsd: number; totalTokens: number; sessionCount: number }[];

      ocDb.close();
      return rows;
    } catch {
      ocDb.close();
      return [];
    }
  });
}
