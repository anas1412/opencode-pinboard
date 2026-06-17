import type { FastifyInstance } from "fastify";
import { and, eq, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "../../db";
import { startServer } from "../opencode-manager";
import { emitSse } from "../sse";

const createSessionSchema = z.object({
  ticketId: z.string().uuid(),
});

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

  // Create or re-use session (starts opencode serve for the repo)
  app.post("/api/sessions", async (req, reply) => {
    const input = createSessionSchema.parse(req.body);

    // Load ticket + repo
    const [ticket] = await db
      .select()
      .from(schema.tickets)
      .where(eq(schema.tickets.id, input.ticketId));

    if (!ticket)
      return reply.status(404).send({ error: "NOT_FOUND", message: "Ticket not found" });

    const [repo] = await db
      .select()
      .from(schema.repos)
      .where(eq(schema.repos.id, ticket.repoId));

    if (!repo)
      return reply.status(404).send({ error: "NOT_FOUND", message: "Repo not found" });

    // Check if ticket already has an active (non-ended) session to re-use
    if (ticket.activeSessionId) {
      const [existing] = await db
        .select()
        .from(schema.sessions)
        .where(eq(schema.sessions.id, ticket.activeSessionId));

      if (existing && existing.exitCode === null) {
        // Ensure opencode serve is running for this repo
        let port: number;
        try {
          port = await startServer(repo.localPath);
        } catch (err) {
          app.log.error({ err }, "Failed to start opencode serve");
          return reply.status(500).send({
            error: "SERVER_START_FAILED",
            message: "Could not start opencode server.",
          });
        }

        return {
          id: existing.id,
          ticketId: input.ticketId,
          cwd: repo.localPath,
          branch: ticket.branch,
          opencodeSessionId: existing.opencodeSessionId,
          opencodePort: port,
        };
      }
    }

    // No re-usable session — create a new one
    const sessionId = crypto.randomUUID();

    const session = {
      id: sessionId,
      ticketId: input.ticketId,
      opencodeVersion: "latest",
      model: "unknown",
      cwd: repo.localPath,
      branch: ticket.branch,
      initialPrompt: ticket.description,
      opencodeSessionId: null as string | null,
      transcript: "[]",
      diff: "[]",
      filesChanged: "[]",
      exitCode: null,
      exitReason: null,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      costUsd: 0,
      createdAt: Date.now(),
      endedAt: null,
      durationMs: null,
      approved: null,
      revisionNote: null,
    };

    await db.insert(schema.sessions).values(session);

    // Update ticket status + active session
    await db
      .update(schema.tickets)
      .set({
        status: "in_progress",
        activeSessionId: sessionId,
        updatedAt: Date.now(),
      })
      .where(eq(schema.tickets.id, input.ticketId));

    // Emit SSE event
    emitSse({ type: "session.started", sessionId, ticketId: input.ticketId });

    // Start opencode serve for the repo (idempotent if already running)
    let port: number;
    try {
      port = await startServer(repo.localPath);
    } catch (err) {
      app.log.error({ err, sessionId }, "Failed to start opencode server");
      await db
        .update(schema.sessions)
        .set({ exitCode: -1, exitReason: "error", endedAt: Date.now() })
        .where(eq(schema.sessions.id, sessionId));

      await db
        .update(schema.tickets)
        .set({ status: "open", activeSessionId: null, updatedAt: Date.now() })
        .where(eq(schema.tickets.id, input.ticketId));

      return reply.status(500).send({
        error: "SERVER_START_FAILED",
        message: "Could not start opencode server. Check that opencode is installed and in your PATH.",
      });
    }

    // Reuse previous opencode session if available (preserves conversation history).
    // The POST /session API does NOT accept an `id` body field — it always creates
    // a new session. So we skip the API call and reuse the existing session ID directly.
    const [prevSession] = await db
      .select()
      .from(schema.sessions)
      .where(
        and(
          eq(schema.sessions.ticketId, input.ticketId),
          isNotNull(schema.sessions.opencodeSessionId),
        ),
      )
      .orderBy(schema.sessions.createdAt)
      .limit(1);

    if (prevSession?.opencodeSessionId) {
      // Reuse the existing opencode session — history stays intact
      const ocSessionId = prevSession.opencodeSessionId;
      await db
        .update(schema.sessions)
        .set({ opencodeSessionId: ocSessionId })
        .where(eq(schema.sessions.id, sessionId));
      session.opencodeSessionId = ocSessionId;
    } else {
      // No previous session — create a fresh one via opencode's API
      try {
        const ocSessionId = await createOpencodeSession(port, repo.localPath, ticket.title);
        await db
          .update(schema.sessions)
          .set({ opencodeSessionId: ocSessionId })
          .where(eq(schema.sessions.id, sessionId));
        session.opencodeSessionId = ocSessionId;
      } catch (err) {
        // Non-fatal: session works without opencode session ID,
        // but messages won't persist across restarts
        app.log.warn({ err, sessionId }, "Could not create opencode session — messages won't persist");
      }
    }

    return {
      id: sessionId,
      ticketId: input.ticketId,
      cwd: repo.localPath,
      branch: ticket.branch,
      opencodeSessionId: session.opencodeSessionId,
      opencodePort: port,
    };
  });

  // Stop session (marks ended, clears ticket.activeSessionId, does NOT kill opencode serve)
  app.post("/api/sessions/:id/stop", async (req, reply) => {
    const { id } = req.params as { id: string };

    const [session] = await db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.id, id));
    if (!session)
      return reply.status(404).send({ error: "NOT_FOUND", message: "Session not found" });

    await db
      .update(schema.sessions)
      .set({ exitCode: 0, exitReason: "user_stopped", endedAt: Date.now() })
      .where(eq(schema.sessions.id, id));

    // Clear ticket's activeSessionId so sidebar updates and auto-resume is clean
    await db
      .update(schema.tickets)
      .set({ activeSessionId: null, updatedAt: Date.now() })
      .where(eq(schema.tickets.id, session.ticketId));

    emitSse({ type: "session.stopped", sessionId: id, ticketId: session.ticketId });

    return reply.status(204).send();
  });

}

/**
 * Create a session on the opencode server for message persistence.
 */
async function createOpencodeSession(
  port: number,
  repoPath: string,
  title?: string,
): Promise<string> {
  const url = `http://127.0.0.1:${port}/session?directory=${encodeURIComponent(repoPath)}`;
  const body: Record<string, unknown> = {};
  if (title) body.title = title;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "unknown");
    throw new Error(`Failed to create opencode session: ${res.status} ${text.slice(0, 200)}`);
  }

  const session = await res.json() as { id: string };
  return session.id;
}

function deserializeSession(row: typeof schema.sessions.$inferSelect) {
  return {
    ...row,
    transcript: JSON.parse(row.transcript),
    diff: JSON.parse(row.diff),
    filesChanged: JSON.parse(row.filesChanged),
  };
}
