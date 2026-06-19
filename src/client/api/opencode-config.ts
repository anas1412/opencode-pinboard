import { apiFetch } from "./client";
import type { OpencodeConfig, AgentEntry, OpencodeTuiConfig } from "../../shared/types";

export function fetchOpencodeConfig(): Promise<OpencodeConfig> {
  return apiFetch<OpencodeConfig>("/api/opencode/config");
}

export function updateOpencodeConfig(input: OpencodeConfig): Promise<OpencodeConfig> {
  return apiFetch<OpencodeConfig>("/api/opencode/config", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function fetchAgents(): Promise<AgentEntry[]> {
  return apiFetch<AgentEntry[]>("/api/opencode/agents");
}

export function fetchOpencodeTuiConfig(): Promise<OpencodeTuiConfig> {
  return apiFetch<OpencodeTuiConfig>("/api/opencode/tui-config");
}

export function updateOpencodeTuiConfig(input: OpencodeTuiConfig): Promise<OpencodeTuiConfig> {
  return apiFetch<OpencodeTuiConfig>("/api/opencode/tui-config", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}
