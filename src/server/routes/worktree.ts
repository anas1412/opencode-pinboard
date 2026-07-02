import { existsSync, mkdirSync, rmSync, readdirSync } from "fs";
import path from "path";
import { homedir } from "os";
import type { FastifyInstance } from "fastify";
import { eq, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "../../db";
import { stopSessionServer } from "../opencode-manager";
import { getPinboardWorktreesDir, getPinboardReposDir } from "../../paths";

const WORKTREES_ROOT = getPinboardWorktreesDir();

/** Cross-platform git runner — no shell, works on Windows. */
function git(args: string[], opts?: { cwd?: string }): { stdout: string; exitCode: number } {
  if (opts?.cwd && !existsSync(opts.cwd)) {
    throw new Error(`GIT_FAILED: cwd does not exist — "${opts.cwd}"`);
  }
  const result = Bun.spawnSync(["git", ...args], { cwd: opts?.cwd });
  return { stdout: result.stdout.toString().trim(), exitCode: result.exitCode };
}

type Ticket = typeof schema.tickets.$inferSelect;
type Repo = typeof schema.repos.$inferSelect;

/**
 * Scan common directories for a repo by name.
 * Checks up to depth 3, skips hidden dirs and node_modules.
 */
function scanForRepo(name: string, root: string, depth = 0): string | null {
  if (depth > 3) return null;
  try {
    const entries = readdirSync(root, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".") || entry.name === "node_modules") continue;
      const fullPath = path.join(root, entry.name);
      if (entry.name === name && existsSync(path.join(fullPath, ".git"))) {
        return fullPath;
      }
      const found = scanForRepo(name, fullPath, depth + 1);
      if (found) return found;
    }
  } catch {}
  return null;
}

/** Try to find a repo that moved, update DB and return the new path. */
async function healRepoPath(repo: Repo): Promise<string | null> {
  const scanned = new Set<string>();
  const dirs = [
    homedir(),
    getPinboardReposDir(),
  ];
  for (const dir of dirs) {
    if (!dir || scanned.has(dir)) continue;
    scanned.add(dir);
    if (!existsSync(dir)) continue;
    const found = scanForRepo(repo.name, dir);
    if (found) {
      await db.update(schema.repos).set({ localPath: found }).where(eq(schema.repos.id, repo.id));
      return found;
    }
  }
  return null;
}

/**
 * Look for an existing worktree by slug.
 * Checks: current repo name, repo ID, then all subdirs of WORKTREES_ROOT.
 */
export async function healWorktreePath(repo: Repo, slug: string): Promise<string | null> {
  // Fast checks: current name and repo ID
  const fast = [
    path.join(WORKTREES_ROOT, repo.name.replace(/[^a-zA-Z0-9_-]/g, "-"), slug),
    path.join(WORKTREES_ROOT, repo.id, slug),
  ];
  for (const c of fast) {
    if (existsSync(c) && existsSync(path.join(c, ".git"))) return c;
  }
  // Fallback: scan all subdirs (catches renames)
  try {
    const entries = readdirSync(WORKTREES_ROOT, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const candidate = path.join(WORKTREES_ROOT, entry.name, slug);
      if (existsSync(candidate) && existsSync(path.join(candidate, ".git"))) return candidate;
    }
  } catch {}
  return null;
}

/**
 * Create a git branch + worktree for a ticket. Throws on failure.
 * Returns the worktree path that was created.
 */
export async function createWorktreeForTicket(
  ticket: Ticket,
  repo: Repo,
  log?: Pick<FastifyInstance["log"], "warn" | "info">,
): Promise<string> {
  const branchName = ticket.branch;
  const repoDirName = repo.name.replace(/[^a-zA-Z0-9_-]/g, "-");
  const slug = branchName.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 64);
  const worktreePath = path.join(WORKTREES_ROOT, repoDirName, slug);

  // Check if worktree already exists under name or ID path
  const healed = await healWorktreePath(repo, slug);
  if (healed) {
    await db.update(schema.tickets).set({ worktreePath: healed, updatedAt: Date.now() }).where(eq(schema.tickets.id, ticket.id));
    log?.info?.({ ticketId: ticket.id, branchName, worktreePath: healed }, "Worktree re-linked (healed)");
    return healed;
  }

  mkdirSync(path.dirname(worktreePath), { recursive: true });

  if (!existsSync(repo.localPath)) {
    const healed = await healRepoPath(repo);
    if (healed) {
      log?.info?.({ repoId: repo.id, oldPath: repo.localPath, newPath: healed }, "Repo path healed");
      repo.localPath = healed;
    } else {
      throw new Error(`GIT_FAILED: repo path does not exist — "${repo.localPath}". Auto-scan also found nothing. Move the repo back there or update it in Settings.`);
    }
  }

  // 1. Fetch latest base branch
  git(["fetch", "origin", ticket.baseBranch!], { cwd: repo.localPath });

  // 2. Create the branch from base branch (without switching to it)
  const exists = git(["rev-parse", "--verify", branchName], { cwd: repo.localPath });
  if (exists.exitCode !== 0) {
    git(["branch", branchName, `origin/${ticket.baseBranch}`], { cwd: repo.localPath });
  }

  // 3. Create the worktree
  git(["worktree", "add", worktreePath, branchName], { cwd: repo.localPath });

  // 4. Run bun install
  if (existsSync(path.join(worktreePath, "package.json"))) {
    try {
      Bun.spawnSync(["bun", "install", "--cwd", worktreePath]);
    } catch {
      log?.warn?.({ worktreePath }, "bun install failed in worktree — continuing");
    }
  }

  // 5. Save worktreePath on the ticket
  await db
    .update(schema.tickets)
    .set({ worktreePath, updatedAt: Date.now() })
    .where(eq(schema.tickets.id, ticket.id));

  log?.info?.({ ticketId: ticket.id, branchName, worktreePath }, "Worktree created");
  return worktreePath;
}

export function registerWorktreeRoutes(app: FastifyInstance) {
  // Create worktree for a ticket (manual, e.g. via curl)
  app.post("/api/worktrees", async (req, reply) => {
    const { ticketId } = z
      .object({ ticketId: z.string().uuid() })
      .parse(req.body);

    const [ticket] = await db
      .select()
      .from(schema.tickets)
      .where(eq(schema.tickets.id, ticketId));
    if (!ticket)
      return reply.status(404).send({ error: "NOT_FOUND", message: "Ticket not found" });
    if (ticket.worktreePath)
      return reply.status(409).send({ error: "ALREADY_EXISTS", message: "Worktree already exists for this ticket" });

    const [repo] = await db
      .select()
      .from(schema.repos)
      .where(eq(schema.repos.id, ticket.repoId));
    if (!repo)
      return reply.status(404).send({ error: "NOT_FOUND", message: "Repo not found" });
    if (!existsSync(repo.localPath))
      return reply.status(400).send({ error: "PATH_NOT_FOUND", message: `Repo path does not exist: ${repo.localPath}` });

    try {
      const worktreePath = await createWorktreeForTicket(ticket, repo, app.log);
      return { worktreePath, branch: ticket.branch };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      return reply.status(500).send({ error: "GIT_FAILED", message: msg });
    }
  });

  // List all worktrees (tickets with worktreePath set)
  app.get("/api/worktrees", async () => {
    const rows = await db
      .select()
      .from(schema.tickets)
      .where(isNotNull(schema.tickets.worktreePath))
      .orderBy(schema.tickets.updatedAt);

    const tickets = rows.map((r) => ({
      id: r.id,
      title: r.title,
      branch: r.branch,
      repoId: r.repoId,
      worktreePath: r.worktreePath,
      status: r.status,
      worktreeExists: r.worktreePath ? existsSync(r.worktreePath) : false,
    }));

    return tickets;
  });

  // Remove worktree for a ticket
  app.delete("/api/worktrees/:ticketId", async (req, reply) => {
    const { ticketId } = req.params as { ticketId: string };

    const [ticket] = await db
      .select()
      .from(schema.tickets)
      .where(eq(schema.tickets.id, ticketId));
    if (!ticket)
      return reply.status(404).send({ error: "NOT_FOUND", message: "Ticket not found" });
    if (!ticket.worktreePath)
      return reply.status(404).send({ error: "NO_WORKTREE", message: "No worktree exists for this ticket" });

    await removeWorktreeForTicket(ticketId);
    return reply.status(204).send();
  });
}

/**
 * Remove the git worktree and branch for a ticket, then clear worktreePath.
 * Safe to call even if the ticket has no worktree (no-op).
 */
export async function removeWorktreeForTicket(ticketId: string): Promise<void> {
  const [ticket] = await db
    .select()
    .from(schema.tickets)
    .where(eq(schema.tickets.id, ticketId));
  if (!ticket || !ticket.worktreePath) return;

  // 1. Stop any active opencode session
  const [activeSession] = await db
    .select()
    .from(schema.sessions)
    .where(eq(schema.sessions.ticketId, ticketId))
    .limit(1);
  if (activeSession) {
    stopSessionServer(activeSession.id);
    await db
      .update(schema.sessions)
      .set({ exitCode: 0, exitReason: "user_stopped", endedAt: Date.now() })
      .where(eq(schema.sessions.id, activeSession.id));
    await db
      .update(schema.tickets)
      .set({ activeSessionId: null, updatedAt: Date.now() })
      .where(eq(schema.tickets.id, ticketId));
  }

  // 2. Remove the git worktree
  const [repo] = await db
    .select()
    .from(schema.repos)
    .where(eq(schema.repos.id, ticket.repoId));

  if (repo && existsSync(repo.localPath)) {
    // 2. Remove the worktree (git prune + force remove, fallback to fs.rm)
    git(["worktree", "remove", ticket.worktreePath], { cwd: repo.localPath });
    if (existsSync(ticket.worktreePath)) {
      git(["worktree", "remove", "--force", ticket.worktreePath], { cwd: repo.localPath });
    }
    if (existsSync(ticket.worktreePath)) {
      rmSync(ticket.worktreePath, { recursive: true, force: true });
    }

    // 3. Prune orphaned worktree registrations
    git(["worktree", "prune"], { cwd: repo.localPath });

    // 4. Delete the branch
    git(["branch", "-D", ticket.branch], { cwd: repo.localPath });
  }

  // 4. Clear worktreePath on the ticket
  await db
    .update(schema.tickets)
    .set({ worktreePath: null, updatedAt: Date.now() })
    .where(eq(schema.tickets.id, ticketId));
}
