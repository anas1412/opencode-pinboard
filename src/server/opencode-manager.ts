import { spawn, type ChildProcess } from "child_process";

interface ServerInstance {
  proc: ChildProcess;
  port: number;
  sessionId: string;
  repoPath: string;
}

// One opencode serve process per session — isolates web UI origins for parallel use
const servers = new Map<string, ServerInstance>();

/**
 * Start (or return existing) opencode serve for a session.
 * Each session gets its own process on a unique OS-assigned port.
 * Waits until the server is listening before resolving.
 */
export async function startSessionServer(sessionId: string, repoPath: string): Promise<number> {
  const existing = servers.get(sessionId);
  if (existing && existing.proc.exitCode === null) {
    return existing.port;
  }
  // Clean up dead entry
  if (existing) servers.delete(sessionId);

  return new Promise((resolve, reject) => {
    const proc = spawn("opencode", ["serve", "--port", "0"], {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env },
    });

    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        proc.kill();
        reject(new Error("opencode serve did not start within 15s"));
      }
    }, 15000);

    const onData = (data: Buffer) => {
      const text = data.toString();
      const match = text.match(/listening on http:\/\/[^:]+:(\d+)/);
      if (match && !resolved) {
        resolved = true;
        clearTimeout(timeout);
        const port = parseInt(match[1], 10);
        servers.set(sessionId, { proc, port, sessionId, repoPath });
        resolve(port);
      }
    };

    proc.stdout?.on("data", onData);
    proc.stderr?.on("data", onData);

    proc.on("error", (err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        reject(err);
      }
    });

    proc.on("exit", () => {
      servers.delete(sessionId);
    });
  });
}

/** Kill the opencode serve for a session */
export function stopSessionServer(sessionId: string): void {
  const inst = servers.get(sessionId);
  if (inst && inst.proc.exitCode === null) {
    inst.proc.kill("SIGTERM");
    setTimeout(() => {
      if (inst.proc.exitCode === null) inst.proc.kill("SIGKILL");
    }, 3000);
  }
  servers.delete(sessionId);
}

/** Kill all running servers (call on shutdown) */
export function stopAll(): void {
  for (const [, inst] of servers) {
    if (inst.proc.exitCode === null) {
      inst.proc.kill("SIGTERM");
    }
  }
  servers.clear();
}

/** Get the port for a running session's server, or undefined */
export function getSessionPort(sessionId: string): number | undefined {
  return servers.get(sessionId)?.port;
}
