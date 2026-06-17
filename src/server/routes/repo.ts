import { execSync } from "child_process";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { db, schema } from "../../db";
import { repoCreateSchema, repoUpdateSchema } from "../validators";

export function registerRepoRoutes(app: FastifyInstance) {
  // Create repo
  app.post("/api/repos", async (req, reply) => {
    const input = repoCreateSchema.parse(req.body);
    const id = crypto.randomUUID();

    // Auto-discover path if not provided
    let localPath = input.localPath;
    let defaultBranch = input.defaultBranch;
    if (!localPath) {
      try {
        const home = process.env.HOME || "/home";
        const result = execSync(
          `find "${home}" -maxdepth 5 -type d -name "${input.name}" -exec test -d "{}/.git" \\; -print 2>/dev/null | head -1`,
          { timeout: 5000, encoding: "utf-8" },
        ).trim();
        if (result) {
          localPath = result;
          app.log.info({ name: input.name, localPath }, "Auto-discovered repo path");
        } else {
          return reply.status(400).send({
            error: "PATH_NOT_FOUND",
            message: `Could not find a git repo named "${input.name}" under ${home}. Specify the path manually.`,
          });
        }
      } catch (err) {
        return reply.status(400).send({
          error: "DISCOVERY_FAILED",
          message: `Could not auto-discover repo path for "${input.name}". Specify the path manually.`,
        });
      }
    }

    // Verify path exists and is a git repo
    try {
      execSync(`git -C "${localPath}" rev-parse --git-dir 2>/dev/null`, {
        timeout: 3000,
        encoding: "utf-8",
      });
    } catch {
      return reply.status(400).send({
        error: "NOT_A_GIT_REPO",
        message: `"${localPath}" is not a valid git repository.`,
      });
    }

    // Auto-detect default branch if not explicitly provided (beyond the default "main")
    if (!defaultBranch || defaultBranch === "main") {
      try {
        const branch = execSync(
          `git -C "${localPath}" symbolic-ref --short HEAD 2>/dev/null || git -C "${localPath}" rev-parse --abbrev-ref HEAD`,
          { timeout: 3000, encoding: "utf-8" },
        ).trim();
        if (branch) defaultBranch = branch;
      } catch {
        // fall back to "main"
      }
    }

    const repoRow = {
      id,
      name: input.name,
      localPath,
      defaultBranch,
      envVars: JSON.stringify(input.envVars),
      createdAt: Date.now(),
      lastUsedAt: null,
    };

    await db.insert(schema.repos).values(repoRow);
    return { ...repoRow, envVars: input.envVars };
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
