import Database from "bun:sqlite";
import { homedir } from "os";
import { existsSync } from "fs";

export function getOpencodeDb(): Database | null {
  const dbPath = `${homedir()}/.local/share/opencode/opencode.db`;
  if (!existsSync(dbPath)) return null;
  try {
    return new Database(dbPath, { readonly: true });
  } catch {
    return null;
  }
}

/**
 * Check whether an opencode session ID still exists in opencode's DB.
 * Returns false if the DB is unavailable or the ID wasn't found.
 */
export function verifyOpencodeSession(sessionId: string | null): boolean {
  if (!sessionId) return false;
  const ocDb = getOpencodeDb();
  if (!ocDb) return false;
  try {
    const row = ocDb
      .query(`SELECT 1 FROM session WHERE id = ?`)
      .get(sessionId) as unknown;
    return row !== undefined;
  } catch {
    return false;
  } finally {
    ocDb.close();
  }
}

/**
 * Look up real cost/token data from opencode's session table.
 * Returns enriched data or the original values if opencode DB is unavailable.
 */
export function enrichFromOpencode(
  opencodeSessionId: string | null,
  fallback: { costUsd: number; totalTokens: number },
): { costUsd: number; totalTokens: number } {
  if (!opencodeSessionId) return fallback;

  const ocDb = getOpencodeDb();
  if (!ocDb) return fallback;

  try {
    const row = ocDb
      .query(
        `SELECT cost, tokens_input + tokens_output as total_tokens
         FROM session WHERE id = ?`,
      )
      .get(opencodeSessionId) as { cost: number; total_tokens: number } | undefined;

    if (row) {
      return { costUsd: row.cost, totalTokens: row.total_tokens };
    }
    return fallback;
  } catch {
    return fallback;
  } finally {
    ocDb.close();
  }
}
