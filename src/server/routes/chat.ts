import type { FastifyInstance } from "fastify";
import { eq, isNull, and } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "../../db";
import { startSessionServer, stopSessionServer, getSessionPort, getSessionPid } from "../opencode-manager";
import { finalizeSessionCost, markSessionEnded } from "../../shared/session-lifecycle";
import { emitSse } from "../sse";
import { ASK_SYSTEM_PROMPT } from "../../shared/ask-prompt";

async function createOpencodeChatSession(
  port: number,
  repoPath: string,
  label: string,
): Promise<string> {
  const url = `http://127.0.0.1:${port}/session?directory=${encodeURIComponent(repoPath)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: label }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "unknown");
    throw new Error(`Failed to create opencode chat session: ${res.status} ${text.slice(0, 200)}`);
  }
  const session = await res.json() as { id: string };
  return session.id;
}

export function registerChatRoutes(app: FastifyInstance) {
  // Create a chat session (no ticket, no worktree — just opencode in a repo)
  app.post("/api/chats", async (req, reply) => {
    const body = z.object({ repoId: z.string().uuid() }).parse(req.body);

    const [repo] = await db.select().from(schema.repos).where(eq(schema.repos.id, body.repoId));
    if (!repo)
      return reply.status(404).send({ error: "NOT_FOUND", message: "Repo not found" });

    const sessionId = crypto.randomUUID();

    // Start opencode serve in the repo directory
    let port: number;
    try {
      port = await startSessionServer(sessionId, repo.localPath);
    } catch {
      return reply.status(500).send({
        error: "SERVER_START_FAILED",
        message: "Could not start opencode server. Check that opencode is installed and in your PATH.",
      });
    }

    // Create an opencode session for messaging
    let opencodeSessionId: string;
    try {
      opencodeSessionId = await createOpencodeChatSession(port, repo.localPath, `Chat: ${repo.name}`);
    } catch (err) {
      stopSessionServer(sessionId);
      return reply.status(500).send({
        error: "SESSION_CREATE_FAILED",
        message: err instanceof Error ? err.message : "Could not create opencode session",
      });
    }

    // Insert session row (no ticketId — it's a chat)
    await db.insert(schema.sessions).values({
      id: sessionId,
      ticketId: null,
      opencodeVersion: "latest",
      model: "unknown",
      cwd: repo.localPath,
      branch: "",
      initialPrompt: "",
      opencodeSessionId,
      transcript: "[]",
      diff: "[]",
      filesChanged: "[]",
      exitCode: null,
      exitReason: null,
      createdAt: Date.now(),
      endedAt: null,
      durationMs: null,
      pid: null,
      serverPort: port,
      approved: null,
      revisionNote: null,
    });

    app.log.info({ sessionId, repo: repo.name }, "Chat session started");

    return {
      id: sessionId,
      opencodePort: port,
      cwd: repo.localPath,
      opencodeSessionId,
      repoName: repo.name,
    };
  });

  // List active chat sessions (only non-ended)
  app.get("/api/chats", async () => {
    const rows = await db
      .select()
      .from(schema.sessions)
      .where(
        and(isNull(schema.sessions.ticketId), isNull(schema.sessions.endedAt)),
      )
      .orderBy(schema.sessions.createdAt);

    return rows.map((row) => ({
      id: row.id,
      cwd: row.cwd,
      opencodeSessionId: row.opencodeSessionId,
      createdAt: row.createdAt,
    }));
  });

  // Get a single chat session
  app.get("/api/chats/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const [row] = await db.select().from(schema.sessions).where(eq(schema.sessions.id, id));
    if (!row)
      return reply.status(404).send({ error: "NOT_FOUND", message: "Chat not found" });

    return {
      id: row.id,
      cwd: row.cwd,
      serverPort: row.serverPort,
      opencodeSessionId: row.opencodeSessionId,
      createdAt: row.createdAt,
      endedAt: row.endedAt,
    };
  });

  // Resume a stopped chat session (restart server + create new opencode session)
  app.post("/api/chats/:id/resume", async (req, reply) => {
    const { id } = req.params as { id: string };

    const [session] = await db.select().from(schema.sessions).where(eq(schema.sessions.id, id));
    if (!session)
      return reply.status(404).send({ error: "NOT_FOUND", message: "Chat not found" });
    if (session.ticketId)
      return reply.status(400).send({ error: "NOT_A_CHAT", message: "Session is a ticket session, not a chat" });

    // If already running, return current info
    const existingPort = getSessionPort(id);
    if (existingPort && session.serverPort && session.opencodeSessionId) {
      return { opencodePort: existingPort, cwd: session.cwd, opencodeSessionId: session.opencodeSessionId };
    }

    // Start server (reuse existing opencodeSessionId so history is preserved)
    let opencodePort: number;
    try {
      opencodePort = await startSessionServer(id, session.cwd);
    } catch {
      return reply.status(500).send({
        error: "SERVER_START_FAILED",
        message: "Could not start opencode server. Check that opencode is installed and in your PATH.",
      });
    }

    // Reset end state and update
    const now = Date.now();
    await db
      .update(schema.sessions)
      .set({
        exitCode: null,
        exitReason: null,
        endedAt: null,
        durationMs: null,
        serverPort: opencodePort,
        createdAt: now,
      })
      .where(eq(schema.sessions.id, id));

    const pid = getSessionPid(id);
    if (pid) {
      await db.update(schema.sessions).set({ pid }).where(eq(schema.sessions.id, id));
    }

    emitSse({ type: "session.started", sessionId: id, ticketId: null });
    return { opencodePort, cwd: session.cwd, opencodeSessionId: session.opencodeSessionId };
  });

  // Stop a chat session and record cost
  app.post("/api/chats/:id/stop", async (req, reply) => {
    const { id } = req.params as { id: string };

    const [session] = await db.select().from(schema.sessions).where(eq(schema.sessions.id, id));
    if (!session)
      return reply.status(404).send({ error: "NOT_FOUND", message: "Chat not found" });

    finalizeSessionCost(session.opencodeSessionId);
    await markSessionEnded(id, null, null);

    return reply.status(204).send();
  });

  // ─── Ask (app-aware chat) ──────────────────────────────────────────────

  // Shared ask server — lazily started
  let askPort: number | null = null;
  let askCwd: string | null = null;

  async function ensureAskServerRoute(): Promise<{ port: number; cwd: string }> {
    if (askPort && askCwd) {
      const existing = getSessionPort("__ask__");
      if (existing) return { port: existing, cwd: askCwd };
    }
    const [repo] = await db.select().from(schema.repos).limit(1);
    if (!repo) throw new Error("No repos found");
    askCwd = repo.localPath;
    askPort = await startSessionServer("__ask__", askCwd);
    return { port: askPort, cwd: askCwd };
  }

  app.post("/api/ask", async (req, reply) => {
    try {
      const { port, cwd } = await ensureAskServerRoute();
      const now = Date.now();
      const opencodeSessionId = await createOpencodeChatSession(port, cwd, "");

      // Inject system prompt as invisible context (noReply=true so the AI doesn't respond yet)
      await fetch(`http://127.0.0.1:${port}/session/${opencodeSessionId}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: ASK_SYSTEM_PROMPT,
          noReply: true,
          parts: [{ type: "text", text: "" }],
        }),
      });
      const id = crypto.randomUUID();
      const chatName = `Ask · ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
      await db.insert(schema.sessions).values({
        id,
        ticketId: "__ask__",
        opencodeVersion: "latest",
        model: "",
        cwd,
        branch: "",
        initialPrompt: chatName,
        opencodeSessionId,
        transcript: "[]",
        diff: "[]",
        filesChanged: "[]",
        exitCode: null,
        exitReason: null,
        createdAt: now,
        endedAt: null,
        durationMs: null,
        pid: null,
        serverPort: port,
        approved: null,
        revisionNote: null,
      });
      return { id, opencodePort: port, cwd, opencodeSessionId };
    } catch (err) {
      return reply.status(500).send({ error: "ASK_FAILED", message: err instanceof Error ? err.message : "Unknown error" });
    }
  });

  app.get("/api/ask", async () => {
    const rows = await db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.ticketId, "__ask__"))
      .orderBy(schema.sessions.createdAt);
    return rows.map((r) => ({ id: r.id, name: r.initialPrompt || r.id.slice(0, 8), createdAt: r.createdAt, opencodeSessionId: r.opencodeSessionId ?? "" }));
  });

  app.patch("/api/ask/:id/rename", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = z.object({ name: z.string().min(1) }).parse(req.body);
    await db.update(schema.sessions).set({ initialPrompt: body.name }).where(eq(schema.sessions.id, id));
    return reply.status(204).send();
  });

  app.delete("/api/ask/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    await db.delete(schema.sessions).where(eq(schema.sessions.id, id));
    return reply.status(204).send();
  });

}
