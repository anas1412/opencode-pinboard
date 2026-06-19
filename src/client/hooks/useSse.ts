import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

type SessionRow = {
  id: string;
  exitCode: number | null;
  endedAt: number | null;
  totalTokens: number;
  costUsd: number;
  [key: string]: unknown;
};

/**
 * Singleton SSE connection that patches React Query caches directly on push events.
 * Eliminates client-side polling for ticket list, session data, and recent sessions.
 *
 * Call once at app root (under QueryClientProvider). Reconnection is handled
 * automatically by the browser EventSource API.
 */
export function useSse() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const es = new EventSource("/events");

    es.addEventListener("session.cost", (e: MessageEvent) => {
      const { sessionId, ticketId, costUsd, tokens } = JSON.parse(e.data) as {
        sessionId: string;
        ticketId: string;
        costUsd: number;
        tokens: number;
      };

      // Patch the ticket's session cache with latest cost/tokens (no refetch)
      queryClient.setQueryData<SessionRow[]>(
        ["ticket", ticketId, "sessions"],
        (old) =>
          old?.map((s) =>
            s.id === sessionId
              ? { ...s, totalTokens: tokens, costUsd }
              : s,
          ),
      );

      // Refresh recent sessions (costs changed)
      queryClient.invalidateQueries({ queryKey: ["sessions", "recent"] });
    });

    es.addEventListener("session.stopped", (e: MessageEvent) => {
      const { sessionId, ticketId } = JSON.parse(e.data) as {
        sessionId: string;
        ticketId: string;
      };

      // Mark session inactive in cache
      queryClient.setQueryData<SessionRow[]>(
        ["ticket", ticketId, "sessions"],
        (old) =>
          old?.map((s) =>
            s.id === sessionId
              ? { ...s, exitCode: 0, endedAt: Date.now() }
              : s,
          ),
      );

      // Refresh ticket list (active session changed)
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      queryClient.invalidateQueries({ queryKey: ["sessions", "recent"] });
    });

    es.addEventListener("session.started", () => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      queryClient.invalidateQueries({ queryKey: ["sessions", "recent"] });
    });

    es.addEventListener("ticket.created", () => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
    });

    es.addEventListener("ticket.updated", (e: MessageEvent) => {
      const { ticketId } = JSON.parse(e.data) as { ticketId: string };
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      queryClient.invalidateQueries({ queryKey: ["ticket", ticketId] });
    });

    es.addEventListener("ticket.deleted", () => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
    });

    return () => {
      es.close();
    };
  }, [queryClient]);
}
