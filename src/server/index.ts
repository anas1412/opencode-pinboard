import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import path from "path";
import { eq, isNull } from "drizzle-orm";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { db, schema } from "../db";
import { registerRepoRoutes } from "./routes/repo";
import { registerTicketRoutes } from "./routes/ticket";
import { registerSessionRoutes } from "./routes/session";
import { registerCostRoutes } from "./routes/cost";
import { registerSettingsRoutes } from "./routes/settings";
import { registerOpencodeConfigRoutes } from "./routes/opencode-config";
import { isSessionAlive, registerRecoveredSession } from "./opencode-manager";
import { sseEmitter, SSE_EVENT, type SseEvent } from "./sse";

let _app: Awaited<ReturnType<typeof buildApp>> | null = null;

export function getApp() {
  return _app;
}

async function buildApp() {
  const app = Fastify({ logger: true, forceCloseConnections: true });

  // ── Plugins ──────────────────────────────────────────────────────
  await app.register(cors, { origin: true });

  // ── Static files (built client) ──────────────────────────────────
  const clientDist = path.resolve(import.meta.dir, "../../dist/client");
  await app.register(fastifyStatic, {
    root: clientDist,
    prefix: "/",
    wildcard: true,
  });

  // ── Health ───────────────────────────────────────────────────────
  app.get("/api/health", async () => ({ status: "ok", version: "0.1.0" }));

  // ── SSE endpoint ─────────────────────────────────────────────────
  app.get("/events", (req, reply) => {
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    const onEvent = (event: SseEvent) => {
      reply.raw.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    };

    sseEmitter.on(SSE_EVENT, onEvent);

    req.raw.on("close", () => {
      sseEmitter.off(SSE_EVENT, onEvent);
    });
  });

  // ── API routes ───────────────────────────────────────────────────
  registerRepoRoutes(app);
  registerTicketRoutes(app);
  registerSessionRoutes(app);
  registerCostRoutes(app);
  registerSettingsRoutes(app);
  registerOpencodeConfigRoutes(app);

  // ── SPA fallback ─────────────────────────────────────────────────
  app.setNotFoundHandler((_req, reply) => {
    reply.sendFile("index.html");
  });

  return app;
}

/**
 * On startup, recover orphaned sessions that were left running when OpenTack crashed.
 * Scans sessions with no endedAt, checks if the original PID+port is still alive,
 * and re-registers healthy ones in the in-memory server map. Cleans up dead ones.
 */
async function recoverOrphanedSessions() {
  const active = await db
    .select()
    .from(schema.sessions)
    .where(isNull(schema.sessions.endedAt));

  let recovered = 0;
  let cleaned = 0;

  for (const session of active) {
    if (session.pid != null && session.serverPort != null) {
      if (isSessionAlive(session.pid, session.serverPort, session.cwd)) {
        registerRecoveredSession(session.id, session.serverPort, session.cwd);
        console.log(`[recovery] Session ${session.id} recovered on port ${session.serverPort}`);
        recovered++;
      } else {
        await cleanupDeadSession(session.id, session.ticketId);
        cleaned++;
      }
    } else {
      // Session has no PID/port but is marked active — stale row from before migration
      await cleanupDeadSession(session.id, session.ticketId);
      cleaned++;
    }
  }

  if (recovered > 0 || cleaned > 0) {
    console.log(`[recovery] ${recovered} sessions recovered, ${cleaned} stale sessions cleaned`);
  }
}

async function cleanupDeadSession(sessionId: string, ticketId: string) {
  await db
    .update(schema.sessions)
    .set({ exitCode: -1, exitReason: "error", endedAt: Date.now(), pid: null, serverPort: null })
    .where(eq(schema.sessions.id, sessionId));

  await db
    .update(schema.tickets)
    .set({ activeSessionId: null, updatedAt: Date.now() })
    .where(eq(schema.tickets.id, ticketId));
}

export async function startServer(port: number = 3000) {
  // Run migrations on startup
  migrate(db, { migrationsFolder: path.resolve(import.meta.dir, "../../drizzle") });

  // Recover orphaned sessions from previous crashes
  await recoverOrphanedSessions();

  const app = await buildApp();
  _app = app;

  await app.listen({ port, host: "127.0.0.1" });
  app.log.info(`OpenTack running at http://localhost:${port}`);

  return app;
}
