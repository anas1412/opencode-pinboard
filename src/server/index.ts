import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import websocket from "@fastify/websocket";
import path from "path";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { db } from "../db";

let _app: Awaited<ReturnType<typeof buildApp>> | null = null;

export function getApp() {
  return _app;
}

async function buildApp() {
  const app = Fastify({ logger: true });

  // ── Plugins ──────────────────────────────────────────────────────
  await app.register(cors, { origin: true });
  await app.register(websocket);

  // ── Static files (built client) ──────────────────────────────────
  const clientDist = path.resolve(import.meta.dir, "../../dist/client");
  await app.register(fastifyStatic, {
    root: clientDist,
    prefix: "/",
    wildcard: false,
  });

  // ── Health ───────────────────────────────────────────────────────
  app.get("/api/health", async () => ({ status: "ok", version: "0.1.0" }));

  // ── API routes ───────────────────────────────────────────────────
  // TODO: register route modules

  // ── SPA fallback ─────────────────────────────────────────────────
  app.setNotFoundHandler((_req, reply) => {
    reply.sendFile("index.html");
  });

  return app;
}

export async function startServer(port: number = 3000) {
  // Run migrations on startup
  migrate(db, { migrationsFolder: path.resolve(import.meta.dir, "../../drizzle") });

  const app = await buildApp();
  _app = app;

  await app.listen({ port, host: "127.0.0.1" });
  app.log.info(`OpenDev running at http://localhost:${port}`);

  return app;
}
