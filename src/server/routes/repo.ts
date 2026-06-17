import { execSync } from "child_process";
import { existsSync } from "fs";
import path from "path";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { z } from "zod";
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

  // Clone repo from a git URL (GitHub, etc.)
  app.post("/api/repos/clone", async (req, reply) => {
    const { gitUrl } = z
      .object({ gitUrl: z.string().min(1, "Git URL is required") })
      .parse(req.body);

    const repoName = extractRepoName(gitUrl);
    if (!repoName) {
      return reply.status(400).send({
        error: "INVALID_URL",
        message: `Could not extract repo name from "${gitUrl}". Use a GitHub URL like git@github.com:user/repo.git or https://github.com/user/repo.git`,
      });
    }

    const dataDir = process.env.OPENTACK_DB_PATH
      ? path.dirname(process.env.OPENTACK_DB_PATH)
      : path.join(process.env.HOME || "/home", ".opentack");
    const cloneDest = path.join(dataDir, "repos", repoName);

    // Check if already exists
    if (existsSync(cloneDest)) {
      return reply.status(409).send({
        error: "ALREADY_CLONED",
        message: `Repo already cloned at ${cloneDest}. Remove it first or add it manually.`,
      });
    }

    // Clone
    try {
      app.log.info({ gitUrl, cloneDest }, "Cloning repo");
      execSync(`git clone --depth 1 "${gitUrl}" "${cloneDest}"`, {
        timeout: 120_000,
        stdio: "pipe",
      });
    } catch (err) {
      const stderr = (err as { stderr?: string }).stderr || "";

      // Detect private-repo / auth errors and give actionable advice
      const isPrivateRepo =
        stderr.includes("Repository not found") ||
        stderr.includes("Permission denied") ||
        stderr.includes("Authentication failed") ||
        stderr.includes("could not read Username") ||
        stderr.includes("not permitted");

      let hint = stderr.slice(0, 300);
      if (isPrivateRepo) {
        const isSsh = gitUrl.startsWith("git@");
        if (isSsh) {
          hint +=
            "\n\nThis looks like a private repo. Make sure your SSH key is added to GitHub:\n" +
            "  1. Check: ssh -T git@github.com\n" +
            "  2. List keys: ssh-add -l\n" +
            "  3. Add key to agent: ssh-add ~/.ssh/id_ed25519\n" +
            "  4. Add key to GitHub: https://github.com/settings/keys\n" +
            "\nOr use an HTTPS URL with a personal access token:\n" +
            "  https://<username>:<token>@github.com/user/repo.git";
        } else {
          hint +=
            "\n\nThis looks like a private repo. For HTTPS, use a personal access token:\n" +
            "  https://<username>:<token>@github.com/user/repo.git\n" +
            "\nCreate a token at: https://github.com/settings/tokens\n" +
            "Then re-run with the token embedded in the URL.";
        }
      }

      return reply.status(400).send({
        error: "CLONE_FAILED",
        message: hint,
      });
    }

    // Auto-detect default branch
    let defaultBranch = "main";
    try {
      const branch = execSync(
        `git -C "${cloneDest}" symbolic-ref --short HEAD 2>/dev/null || git -C "${cloneDest}" rev-parse --abbrev-ref HEAD`,
        { timeout: 3000, encoding: "utf-8" },
      ).trim();
      if (branch) defaultBranch = branch;
    } catch {
      // fall back
    }

    const id = crypto.randomUUID();
    const repoRow = {
      id,
      name: repoName,
      localPath: cloneDest,
      defaultBranch,
      envVars: "{}",
      createdAt: Date.now(),
      lastUsedAt: null,
    };

    await db.insert(schema.repos).values(repoRow);
    app.log.info({ id, name: repoName, cloneDest }, "Repo cloned and added");

    return { ...repoRow, envVars: {} };
  });
}

/**
 * Extract repo name from common git URL formats:
 *   git@github.com:user/repo.git   → repo
 *   https://github.com/user/repo   → repo
 *   https://github.com/user/repo.git → repo
 */
function extractRepoName(gitUrl: string): string | null {
  // SSH: git@github.com:user/repo.git
  let m = gitUrl.match(/:([^\/]+)\.git$/);
  if (m) return m[1];
  // SSH without .git: git@github.com:user/repo
  m = gitUrl.match(/:([^\/]+)$/);
  if (m) return m[1];
  // HTTPS: https://github.com/user/repo.git
  m = gitUrl.match(/\/([^\/]+?)\.git$/);
  if (m) return m[1];
  // HTTPS without .git: https://github.com/user/repo
  m = gitUrl.match(/\/([^\/]+?)$/);
  if (m) return m[1];
  return null;
}

function deserializeRepo(row: typeof schema.repos.$inferSelect) {
  return {
    ...row,
    envVars: JSON.parse(row.envVars),
  };
}
