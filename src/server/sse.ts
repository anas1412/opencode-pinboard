import { EventEmitter } from "events";

export type SseEvent =
  | { type: "session.started"; sessionId: string; ticketId: string }
  | { type: "session.stopped"; sessionId: string; ticketId: string }
  | { type: "session.ended"; sessionId: string; ticketId: string; exitCode: number | null }
  | { type: "session.cost"; sessionId: string; costUsd: number; tokens: number }
  | { type: "session.file_changed"; sessionId: string; file: string }
  | { type: "pr.created"; sessionId: string; ticketId: string; prUrl: string }
  | { type: "ticket.resolved"; ticketId: string }
  | { type: "system.opencode_upgraded"; version: string };

const emitter = new EventEmitter();
emitter.setMaxListeners(100);

export const sseEmitter = emitter;
export const SSE_EVENT = "sse";

export function emitSse(event: SseEvent): void {
  emitter.emit(SSE_EVENT, event);
}
