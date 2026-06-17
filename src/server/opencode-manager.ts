import { spawn, type ChildProcess } from "child_process";

interface ServerInstance {
  proc: ChildProcess;
  port: number;
  repoPath: string;
}

// One opencode serve process per repo path
const servers = new Map<string, ServerInstance>();

/**
 * Start (or return existing) opencode serve for a repo directory.
 * Waits until the server is listening before resolving.
 */
export async function startServer(repoPath: string): Promise<number> {
  const existing = servers.get(repoPath);
  if (existing && existing.proc.exitCode === null) {
    return existing.port;
  }
  // Clean up dead entry
  if (existing) servers.delete(repoPath);

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
        servers.set(repoPath, { proc, port, repoPath });
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
      servers.delete(repoPath);
    });
  });
}

/** Kill the opencode serve for a repo path */
export function stopServer(repoPath: string): void {
  const inst = servers.get(repoPath);
  if (inst && inst.proc.exitCode === null) {
    inst.proc.kill("SIGTERM");
    setTimeout(() => {
      if (inst.proc.exitCode === null) inst.proc.kill("SIGKILL");
    }, 3000);
  }
  servers.delete(repoPath);
}

/** Kill all running servers (call on shutdown) */
export function stopAll(): void {
  for (const [path, inst] of servers) {
    if (inst.proc.exitCode === null) {
      inst.proc.kill("SIGTERM");
    }
  }
  servers.clear();
}

/** Get the port for a running server, or undefined */
export function getPort(repoPath: string): number | undefined {
  return servers.get(repoPath)?.port;
}
