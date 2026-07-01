import { homedir } from "os";
import { join } from "path";

// ─── Opencode paths (follows xdg-basedir) ──────────────────────────

export function getOpencodeConfigDir(): string {
  return process.env.XDG_CONFIG_HOME
    ? join(process.env.XDG_CONFIG_HOME, "opencode")
    : join(homedir(), ".config", "opencode");
}

export function getOpencodeConfigPath(): string {
  return join(getOpencodeConfigDir(), "opencode.json");
}

export function getOpencodeTuiPath(): string {
  return join(getOpencodeConfigDir(), "tui.json");
}

export function getOpencodeDataDir(): string {
  return process.env.XDG_DATA_HOME
    ? join(process.env.XDG_DATA_HOME, "opencode")
    : join(homedir(), ".local", "share", "opencode");
}

export function getOpencodeDbPath(): string {
  return join(getOpencodeDataDir(), "opencode.db");
}

export function getOpencodeDataAgentsDir(): string {
  return join(getOpencodeDataDir(), "agents");
}

// ─── Pinboard own paths ────────────────────────────────────────────

/** Pinboard data directory (DB, repos, etc.) */
export function getPinboardDataDir(): string {
  return process.env.PINBOARD_DATA_DIR || join(homedir(), ".pinboard");
}

/** Pinboard SQLite database path */
export function getPinboardDbPath(): string {
  return process.env.PINBOARD_DB_PATH || join(getPinboardDataDir(), "db.sqlite");
}

/** Pinboard cloned repos directory */
export function getPinboardReposDir(): string {
  return join(getPinboardDataDir(), "repos");
}

/** Pinboard git worktrees root directory */
export function getPinboardWorktreesDir(): string {
  return join(homedir(), "pinboard-worktrees");
}

/** Pinboard install directory (source code) */
export function getPinboardInstallDir(): string {
  return process.env.PINBOARD_DIR || join(homedir(), ".pinboard");
}

export function getBunDir(): string {
  return join(homedir(), ".bun");
}

export function getOpencodeCliDir(): string {
  return join(homedir(), ".opencode");
}
