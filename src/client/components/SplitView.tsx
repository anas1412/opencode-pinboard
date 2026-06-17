import { useState, useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "../store/app";
import TicketDetail from "./TicketDetail";
import { ArrowLeft, Play, Square, ExternalLink, Loader2 } from "lucide-react";
import { createTicketSession, fetchTicket } from "../api/tickets";

type SessionPhase = "idle" | "starting" | "active" | "stopped" | "error";

/** UTF-8 → base64, matching opencode's pt() for directory slugs */
function encodeDirSlug(dir: string): string {
  const bytes = new TextEncoder().encode(dir);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export default function SplitView() {
  const { selectedTicketId, setSelectedTicketId } = useAppStore();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [opencodePort, setOpencodePort] = useState<number | null>(null);
  const [cwd, setCwd] = useState<string | null>(null);
  const [opencodeSessionId, setOpencodeSessionId] = useState<string | null>(null);
  const [phase, setPhase] = useState<SessionPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Session URL: /<base64-directory>/session/<session-id>
  // The SPA routes this via :dir parent + /session/:id? child
  const opencodeUrl =
    opencodePort && cwd && opencodeSessionId
      ? `http://127.0.0.1:${opencodePort}/${encodeDirSlug(cwd)}/session/${opencodeSessionId}`
      : null;

  // Track previous ticket to reset state when switching
  const prevTicketRef = useRef(selectedTicketId);
  useEffect(() => {
    if (prevTicketRef.current !== selectedTicketId) {
      setSessionId(null);
      setOpencodePort(null);
      setCwd(null);
      setOpencodeSessionId(null);
      setPhase("idle");
      setError(null);
      prevTicketRef.current = selectedTicketId;
    }
  }, [selectedTicketId]);

  // Auto-resume active session on mount or ticket switch
  // IMPORTANT: `phase` is deliberately NOT in deps — including it would cause the
  // effect cleanup (cancelled = true) to fire when we call setPhase("starting"),
  // which kills the in-flight async before it can set phase to "active".
  useEffect(() => {
    if (!selectedTicketId || phase !== "idle") return;

    let cancelled = false;
    (async () => {
      try {
        const ticket = await fetchTicket(selectedTicketId);
        if (cancelled) return;

        if (ticket.activeSessionId) {
          setPhase("starting");
          setError(null);
          const session = await createTicketSession(selectedTicketId);
          if (cancelled) return;
          setSessionId(session.id);
          setOpencodePort(session.opencodePort);
          setCwd(session.cwd);
          setOpencodeSessionId(session.opencodeSessionId ?? null);
          setPhase("active");
          queryClient.invalidateQueries({ queryKey: ["tickets"] });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not resume session");
          setPhase("idle");
        }
      }
    })();

    return () => { cancelled = true; };
  }, [selectedTicketId, queryClient]);

  const handleStartSession = useCallback(async () => {
    if (!selectedTicketId || phase === "starting") return;
    setPhase("starting");
    setError(null);

    try {
      const session = await createTicketSession(selectedTicketId);
      setSessionId(session.id);
      setOpencodePort(session.opencodePort);
      setCwd(session.cwd);
      setOpencodeSessionId(session.opencodeSessionId ?? null);
      setPhase("active");
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
    } catch (err) {
      setError((err as Error).message || "Failed to start session");
      setPhase("idle");
    }
  }, [selectedTicketId, phase, queryClient]);

  const handleStopSession = useCallback(async () => {
    if (!sessionId) return;
    try {
      await fetch(`/api/sessions/${sessionId}/stop`, { method: "POST" });
    } catch {
      // ignore
    }
    setPhase("stopped");
    queryClient.invalidateQueries({ queryKey: ["tickets"] });
  }, [sessionId, queryClient]);

  const handleBack = useCallback(() => {
    setSelectedTicketId(null);
  }, [setSelectedTicketId]);

  if (!selectedTicketId) return null;

  // ── Starting ──
  if (phase === "starting") {
    return (
      <div className="flex h-full">
        <div className="w-[380px] min-w-[380px] border-r border-zinc-800 flex flex-col bg-zinc-950">
          <HeaderBar onBack={handleBack} />
          <div className="flex-1 overflow-hidden">
            <TicketDetail ticketId={selectedTicketId} onStartSession={handleStartSession} sessionActive={false} />
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <Loader2 size={24} className="mx-auto animate-spin text-blue-400" />
            <p className="text-sm text-zinc-400">Starting opencode...</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Active session (shows opencode web UI for the repo) ──
  if (phase === "active" && opencodeUrl) {
    return (
      <div className="flex h-full">
        <div className="w-[380px] min-w-[380px] border-r border-zinc-800 flex flex-col bg-zinc-950">
          <HeaderBar onBack={handleBack} />
          <div className="flex-1 overflow-hidden">
            <TicketDetail ticketId={selectedTicketId} onStartSession={handleStartSession} sessionActive={true} />
          </div>
        </div>
        <div className="flex-1 flex flex-col bg-zinc-950">
          <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-950">
            <span className="text-xs text-zinc-500 font-mono">
              opencode · port {opencodePort}
            </span>
            <div className="flex items-center gap-2">
              <a
                href={opencodeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
              >
                <ExternalLink size={12} />
                Open in new tab
              </a>
              <button
                onClick={handleStopSession}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
              >
                <Square size={12} />
                Stop
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <iframe
              src={opencodeUrl}
              className="w-full h-full border-0"
              title="opencode"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            />
          </div>
        </div>
      </div>
    );
  }

  // ── Session ended ──
  if (phase === "stopped") {
    return (
      <div className="flex h-full">
        <div className="w-[380px] min-w-[380px] border-r border-zinc-800 flex flex-col bg-zinc-950">
          <HeaderBar onBack={handleBack} />
          <div className="flex-1 overflow-hidden">
            <TicketDetail ticketId={selectedTicketId} onStartSession={handleStartSession} sessionActive={false} />
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <p className="text-sm text-zinc-400">Session ended.</p>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button
              onClick={handleBack}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-medium text-zinc-300 transition-colors"
            >
              <ArrowLeft size={14} />
              Back to tickets
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Idle / error — before session starts ──
  return (
    <div className="flex h-full">
      <div className="w-[380px] min-w-[380px] border-r border-zinc-800 flex flex-col bg-zinc-950">
        <HeaderBar onBack={handleBack} />
        <div className="flex-1 overflow-hidden">
          <TicketDetail ticketId={selectedTicketId} onStartSession={handleStartSession} sessionActive={false} />
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-sm text-zinc-400">
            opencode will start working on this ticket
          </p>
          {error && <p className="text-xs text-red-400 max-w-sm">{error}</p>}
          <button
            onClick={handleStartSession}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium text-white transition-colors"
          >
            <Play size={16} />
            Start session
          </button>
        </div>
      </div>
    </div>
  );
}

/** Shared back button bar for the left panel */
function HeaderBar({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
      >
        <ArrowLeft size={14} />
        Back
      </button>
    </div>
  );
}
