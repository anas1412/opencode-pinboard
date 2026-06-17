import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { db, schema } from "../../db";
import { repoCreateSchema, repoUpdateSchema } from "../validators";

export function registerRepoRoutes(app: FastifyInstance) {
  // Create repo
  app.post("/api/repos", async (req, reply) => {
    const input = repoCreateSchema.parse(req.body);
    const id = crypto.randomUUID();

    const repo = {
      id,
      name: input.name,
      localPath: input.localPath,
      defaultBranch: input.defaultBranch,
      envVars: JSON.stringify(input.envVars),
      createdAt: Date.now(),
      lastUsedAt: null,
    };

    await db.insert(schema.repos).values(repo);
    return { ...repo, envVars: input.envVars };
  });

  // List repos
  app.get("/api/repos", async () => {
    const rows = await db.select().from(schema.repos).orderBy(schema.repos.name);
    return rows.map(deserializeRepo);
  });

  // Get repo
  app.get("/api/repos/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const [row] = await db.select().from(schema.repos).where(eq(schema.repos.id, id));
    if (!row) return reply.status(404).send({ error: "NOT_FOUND", message: "Repo not found" });
    return deserializeRepo(row);
  });

  // Update repo
  app.put("/api/repos/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const input = repoUpdateSchema.parse(req.body);

    const existing = await db.select().from(schema.repos).where(eq(schema.repos.id, id));
    if (!existing.length) return reply.status(404).send({ error: "NOT_FOUND", message: "Repo not found" });

    const update: Record<string, unknown> = {};
    if (input.name !== undefined) update.name = input.name;
    if (input.localPath !== undefined) update.localPath = input.localPath;
    if (input.defaultBranch !== undefined) update.defaultBranch = input.defaultBranch;
    if (input.envVars !== undefined) update.envVars = JSON.stringify(input.envVars);

    await db.update(schema.repos).set(update).where(eq(schema.repos.id, id));
    const [row] = await db.select().from(schema.repos).where(eq(schema.repos.id, id));
    return deserializeRepo(row!);
  });

  // Delete repo
  app.delete("/api/repos/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    await db.delete(schema.repos).where(eq(schema.repos.id, id));
    return reply.status(204).send();
  });
}

function deserializeRepo(row: typeof schema.repos.$inferSelect) {
  return {
    ...row,
    envVars: JSON.parse(row.envVars),
  };
}
