import type { FastifyInstance } from "fastify";
import { eq, like, and, desc, sql } from "drizzle-orm";
import { db, schema } from "../../db";
import { ticketCreateSchema, ticketUpdateSchema, ticketListQuerySchema } from "../validators";

export function registerTicketRoutes(app: FastifyInstance) {
  // Create ticket
  app.post("/api/tickets", async (req, reply) => {
    const input = ticketCreateSchema.parse(req.body);
    const id = crypto.randomUUID();

    // Resolve repo for branch info
    const [repo] = await db.select().from(schema.repos).where(eq(schema.repos.id, input.repoId));
    if (!repo) return reply.status(404).send({ error: "NOT_FOUND", message: "Repo not found" });

    const slug = input.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48);
    const branch = `feat/${slug}-${id.slice(0, 8)}`;

    const ticket = {
      id,
      title: input.title,
      description: input.description,
      status: "open" as const,
      priority: input.priority,
      category: input.category,
      repoId: input.repoId,
      branch,
      baseBranch: repo.defaultBranch,
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

    return {
      tickets: rows.map(deserializeTicket),
      total: count,
      limit: query.limit,
      offset: query.offset,
    };
  });

  // Get ticket
  app.get("/api/tickets/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const [row] = await db.select().from(schema.tickets).where(eq(schema.tickets.id, id));
    if (!row) return reply.status(404).send({ error: "NOT_FOUND", message: "Ticket not found" });
    return deserializeTicket(row);
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
