import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { db, schema } from "../../db";

export function registerSessionRoutes(app: FastifyInstance) {
  // List sessions for a ticket
  app.get("/api/tickets/:ticketId/sessions", async (req, reply) => {
    const { ticketId } = req.params as { ticketId: string };

    const [ticket] = await db
      .select()
      .from(schema.tickets)
      .where(eq(schema.tickets.id, ticketId));

    if (!ticket)
      return reply.status(404).send({ error: "NOT_FOUND", message: "Ticket not found" });

    const rows = await db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.ticketId, ticketId))
      .orderBy(schema.sessions.createdAt);

    return rows.map(deserializeSession);
  });

  // Get session
  app.get("/api/sessions/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const [row] = await db.select().from(schema.sessions).where(eq(schema.sessions.id, id));
    if (!row)
      return reply.status(404).send({ error: "NOT_FOUND", message: "Session not found" });
    return deserializeSession(row);
  });
}

function deserializeSession(row: typeof schema.sessions.$inferSelect) {
  return {
    ...row,
    transcript: JSON.parse(row.transcript),
    diff: JSON.parse(row.diff),
    filesChanged: JSON.parse(row.filesChanged),
  };
}
