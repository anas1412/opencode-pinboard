/**
 * Sync a ticket's worktree with its base branch.
 *
 * Assumes caller already ran `git fetch` (via checkSyncStatus).
 * Does NOT fetch — rebases directly using the cached remote refs.
 * Returns conflicts if the rebase hits a conflict — user must resolve manually.
 */
import { existsSync } from "fs";
import { db, schema } from "../db";
import { eq } from "drizzle-orm";

export interface SyncWorktreeResult {
  ok: boolean;
  message: string;
  /** Files with conflicts, if any. Empty if clean. */
  conflicts: string[];
}

export async function syncWorktree(ticketId: string): Promise<SyncWorktreeResult> {
  const [ticket] = await db.select().from(schema.tickets).where(eq(schema.tickets.id, ticketId));
  if (!ticket) throw new Error("Ticket not found");

  // Use worktree if available, otherwise fall back to main repo path
  const [repo] = await db.select().from(schema.repos).where(eq(schema.repos.id, ticket.repoId));
  if (!repo) throw new Error("Repo not found");

  const gitDir =
    ticket.worktreePath && existsSync(ticket.worktreePath)
      ? ticket.worktreePath
      : repo.localPath;

  const baseBranch = ticket.baseBranch || repo.defaultBranch || "main";

  // Rebase onto origin/base (no fetch — caller is responsible for fresh refs)
  const rebase = execGit(gitDir, ["rebase", `origin/${baseBranch}`]);
  if (rebase.exitCode === 0) {
    return {
      ok: true,
      message: `Synced with origin/${baseBranch}. Branch is up to date.`,
      conflicts: [],
    };
  }

  // Rebase failed — identify conflict files
  const conflicts = getConflictFiles(gitDir);

  // Abort the rebase to leave the worktree clean
  execGit(gitDir, ["rebase", "--abort"]);

  return {
    ok: false,
    message: `Rebase conflict against origin/${baseBranch}. Resolve conflicts then rebase manually.`,
    conflicts,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────

function execGit(
  cwd: string,
  args: string[],
): { exitCode: number; stdout: string; stderr: string } {
  const result = Bun.spawnSync(["git", ...args], { cwd });
  return {
    exitCode: result.exitCode,
    stdout: result.stdout.toString().trim(),
    stderr: result.stderr.toString().trim(),
  };
}

function getConflictFiles(cwd: string): string[] {
  // Use `git diff --name-only --diff-filter=U` to list unmerged files
  const result = execGit(cwd, ["diff", "--name-only", "--diff-filter=U"]);
  if (result.exitCode !== 0 || !result.stdout) return [];
  return result.stdout.split("\n").filter(Boolean);
}


