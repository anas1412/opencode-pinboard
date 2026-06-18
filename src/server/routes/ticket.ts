import type { FastifyInstance } from "fastify";
import { eq, like, and, desc, sql, inArray } from "drizzle-orm";
import { db, schema } from "../../db";
import { ticketCreateSchema, ticketUpdateSchema, ticketListQuerySchema } from "../validators";
import { enrichFromOpencode, getOpencodeDb } from "./cost-utils";
import { z } from "zod";

export function registerTicketRoutes(app: FastifyInstance) {
  // Create ticket
  app.post("/api/tickets", async (req, reply) => {
    const input = ticketCreateSchema.parse(req.body);
    const id = crypto.randomUUID();

    // Generate display branch name from title + category (no git ops performed)
    const prefixMap: Record<string, string> = {
      feature: "feat",
      bug: "fix",
      refactor: "refactor",
      chore: "chore",
      docs: "docs",
    };
    const prefix = prefixMap[input.category] ?? "feat";
    const slug = input.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48);
    const branch = `${prefix}/${slug}-${id.slice(0, 8)}`;

    const ticket = {
      id,
      title: input.title,
      description: input.description,
      status: "open" as const,
      priority: input.priority,
      category: input.category,
      repoId: input.repoId,
      branch,
      baseBranch: "",
      sessionIds: "[]",
      activeSessionId: null,
      filesChanged: "[]",
      totalCostUsd: 0,
      totalTokens: 0,
      tags: JSON.stringify(input.tags),
      notes: "",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      resolvedAt: null,
    };

    await db.insert(schema.tickets).values(ticket);
    return deserializeTicket(ticket);
  });

  // List tickets
  app.get("/api/tickets", async (req) => {
    const query = ticketListQuerySchema.parse(req.query);

    const conditions = [];
    if (query.status) conditions.push(eq(schema.tickets.status, query.status));
    if (query.priority) conditions.push(eq(schema.tickets.priority, query.priority));
    if (query.repoId) conditions.push(eq(schema.tickets.repoId, query.repoId));
    if (query.category) conditions.push(eq(schema.tickets.category, query.category));
    if (query.search) conditions.push(like(schema.tickets.title, `%${query.search}%`));

    const where = conditions.length ? and(...conditions) : undefined;

    const rows = await db
      .select()
      .from(schema.tickets)
      .where(where)
      .orderBy(desc(schema.tickets.updatedAt))
      .limit(query.limit)
      .offset(query.offset);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.tickets)
      .where(where);

    // Enrich costs from opencode — batch by looking up all sessions at once
    const tickets = rows.map(deserializeTicket);
    const ticketIds = tickets.map((t) => t.id);
    if (ticketIds.length > 0) {
      const allSessions = await db
        .select()
        .from(schema.sessions)
        .where(sql`${schema.sessions.ticketId} IN (${ticketIds.join(",")})`);

      // Batch look up opencode session costs
      const ocSessionIds = allSessions.map((s) => s.opencodeSessionId).filter(Boolean) as string[];
      const ocCostMap = new Map<string, { cost: number; tokens: number }>();
      if (ocSessionIds.length > 0) {
        const ocDb = getOpencodeDb();
        if (ocDb) {
          try {
            const placeholders = ocSessionIds.map(() => "?").join(",");
            const rows = ocDb
              .query(
                `SELECT id, cost, tokens_input + tokens_output as tokens
                 FROM session WHERE id IN (${placeholders})`,
              )
              .all(...ocSessionIds) as { id: string; cost: number; tokens: number }[];
            for (const r of rows) ocCostMap.set(r.id, { cost: r.cost, tokens: r.tokens });
            ocDb.close();
          } catch {
            ocDb.close();
          }
        }
      }

      // Sum costs per ticket
      const costByTicket = new Map<string, { costUsd: number; totalTokens: number }>();
      for (const s of allSessions) {
        const oc = s.opencodeSessionId ? ocCostMap.get(s.opencodeSessionId) : null;
        const costUsd = oc?.cost ?? s.costUsd;
        const totalTokens = oc?.tokens ?? s.totalTokens;
        const existing = costByTicket.get(s.ticketId) ?? { costUsd: 0, totalTokens: 0 };
        existing.costUsd += costUsd;
        existing.totalTokens += totalTokens;
        costByTicket.set(s.ticketId, existing);
      }

      for (const t of tickets) {
        const c = costByTicket.get(t.id);
        if (c) {
          t.totalCostUsd = c.costUsd;
          t.totalTokens = c.totalTokens;
        }
      }
    }

    return {
      tickets,
      total: count,
      limit: query.limit,
      offset: query.offset,
    };
  });

  // Get ticket (with real costs from opencode)
  app.get("/api/tickets/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const [row] = await db.select().from(schema.tickets).where(eq(schema.tickets.id, id));
    if (!row) return reply.status(404).send({ error: "NOT_FOUND", message: "Ticket not found" });

    // Enrich cost from opencode by summing all sessions
    const sessions = await db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.ticketId, id));

    let realCost = 0;
    let realTokens = 0;
    for (const s of sessions) {
      const enriched = enrichFromOpencode(s.opencodeSessionId, { costUsd: s.costUsd, totalTokens: s.totalTokens });
      realCost += enriched.costUsd;
      realTokens += enriched.totalTokens;
    }

    const ticket = deserializeTicket(row);
    return { ...ticket, totalCostUsd: realCost, totalTokens: realTokens };
  });

  // Update ticket
  app.put("/api/tickets/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const input = ticketUpdateSchema.parse(req.body);

    const existing = await db.select().from(schema.tickets).where(eq(schema.tickets.id, id));
    if (!existing.length)
      return reply.status(404).send({ error: "NOT_FOUND", message: "Ticket not found" });

    const update: Record<string, unknown> = { updatedAt: Date.now() };
    if (input.title !== undefined) update.title = input.title;
    if (input.description !== undefined) update.description = input.description;
    if (input.status !== undefined) update.status = input.status;
    if (input.priority !== undefined) update.priority = input.priority;
    if (input.category !== undefined) update.category = input.category;
    if (input.notes !== undefined) update.notes = input.notes;
    if (input.tags !== undefined) update.tags = JSON.stringify(input.tags);

    if (input.status === "resolved") update.resolvedAt = Date.now();

    await db.update(schema.tickets).set(update).where(eq(schema.tickets.id, id));
    const [row] = await db.select().from(schema.tickets).where(eq(schema.tickets.id, id));
    return deserializeTicket(row!);
  });

  // Delete ticket
  app.delete("/api/tickets/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    await db.delete(schema.tickets).where(eq(schema.tickets.id, id));
    return reply.status(204).send();
  });

  // ── Batch operations ──

  // Batch update — change status/priority/category on multiple tickets
  app.post("/api/tickets/batch/update", async (req, reply) => {
    const body = z.object({
      ids: z.array(z.string().uuid()).min(1).max(100),
      input: ticketUpdateSchema,
    }).parse(req.body);

    const update: Record<string, unknown> = { updatedAt: Date.now() };
    if (body.input.status !== undefined) update.status = body.input.status;
    if (body.input.priority !== undefined) update.priority = body.input.priority;
    if (body.input.category !== undefined) update.category = body.input.category;
    if (body.input.notes !== undefined) update.notes = body.input.notes;
    if (body.input.tags !== undefined) update.tags = JSON.stringify(body.input.tags);
    if (body.input.status === "resolved") update.resolvedAt = Date.now();

    await db.update(schema.tickets).set(update).where(inArray(schema.tickets.id, body.ids));
    return reply.status(204).send();
  });

  // Batch delete
  app.post("/api/tickets/batch/delete", async (req, reply) => {
    const body = z.object({
      ids: z.array(z.string().uuid()).min(1).max(100),
    }).parse(req.body);

    await db.delete(schema.tickets).where(inArray(schema.tickets.id, body.ids));
    return reply.status(204).send();
  });
}

function deserializeTicket(row: typeof schema.tickets.$inferSelect) {
  return {
    ...row,
    sessionIds: JSON.parse(row.sessionIds),
    filesChanged: JSON.parse(row.filesChanged),
    tags: JSON.parse(row.tags),
    activeSessionId: row.activeSessionId,
    resolvedAt: row.resolvedAt,
  };
}
