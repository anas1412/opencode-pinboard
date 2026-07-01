/**
 * Lightweight sync status check — just counts behind/ahead.
 * Uses `git fetch --quiet` + `git rev-list --count`.
 */
import { existsSync } from "fs";
import { db, schema } from "../db";
import { eq } from "drizzle-orm";

export interface SyncStatusResult {
  behind: number;
  ahead: number;
  error?: string;
}

export async function checkSyncStatus(ticketId: string): Promise<SyncStatusResult> {
  const [ticket] = await db.select().from(schema.tickets).where(eq(schema.tickets.id, ticketId));
  if (!ticket) return { behind: 0, ahead: 0, error: "Ticket not found" };

  const [repo] = await db.select().from(schema.repos).where(eq(schema.repos.id, ticket.repoId));
  if (!repo) return { behind: 0, ahead: 0, error: "Repo not found" };

  const gitDir =
    ticket.worktreePath && existsSync(ticket.worktreePath)
      ? ticket.worktreePath
      : repo.localPath;

  const baseBranch = ticket.baseBranch || repo.defaultBranch || "main";

  // Quiet fetch (no output)
  execGit(gitDir, ["fetch", "origin", baseBranch, "--quiet", "--recurse-submodules=no"]);

  // Count behind: commits on origin/base not in our branch
  const behind = countGit(gitDir, `HEAD..origin/${baseBranch}`);

  // Count ahead: commits on our branch not on origin/base
  const ahead = countGit(gitDir, `origin/${baseBranch}..HEAD`);

  return { behind, ahead };
}

function execGit(cwd: string, args: string[]): { exitCode: number } {
  const result = Bun.spawnSync(["git", ...args], { cwd });
  return { exitCode: result.exitCode };
}

function countGit(cwd: string, range: string): number {
  const result = Bun.spawnSync(["git", "rev-list", "--count", range], { cwd });
  if (result.exitCode !== 0) return 0;
  return parseInt(result.stdout.toString().trim(), 10) || 0;
}
