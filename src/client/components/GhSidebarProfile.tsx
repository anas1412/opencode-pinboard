import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { request } from "../api/rpc-client";
import { useAppStore, type GhUser } from "../store/app";
import { GitBranch, Loader2, CheckCircle } from "lucide-react";

export default function GhSidebarProfile() {
  const navigate = useNavigate();
  const { ghUser, ghPhase, setGhAuth } = useAppStore();

  // Silently check auth in background — never show a loading state
  useEffect(() => {
    if (ghPhase !== null) return;

    request("ghTest")
      .then((res) => {
        if (res.ok && res.user) {
          setGhAuth("authed", res.user as GhUser);
        } else if (res.error?.includes("not found")) {
          setGhAuth("missing");
        } else {
          setGhAuth("no-token");
        }
      })
      .catch(() => { /* will retry on next app launch */ });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Connected profile ────────────────────────────────────────────────
  if (ghPhase === "authed" && ghUser) {
    return (
      <button
        onClick={() => navigate({ to: "/settings/github" })}
        className="flex items-center gap-2.5 w-full px-4 py-2 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 transition-colors border-t border-zinc-800"
      >
        <div className="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center overflow-hidden shrink-0">
          {ghUser.avatarUrl ? (
            <img
              src={ghUser.avatarUrl}
              alt=""
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
                (e.target as HTMLImageElement).parentElement!.textContent = ghUser.login[0].toUpperCase();
              }}
            />
          ) : (
            <span className="text-[10px] font-medium text-zinc-400">
              {ghUser.login[0].toUpperCase()}
            </span>
          )}
        </div>
        <span className="truncate flex-1 min-w-0 text-left">
          {ghUser.name || ghUser.login}
        </span>
        <CheckCircle size={10} className="text-emerald-400 shrink-0" />
      </button>
    );
  }

  // ── Checking state (non-blocking — app rendered, spinner only) ──────
  if (ghPhase === null || ghPhase === "checking") {
    return (
      <button
        onClick={() => navigate({ to: "/settings/github" })}
        className="flex items-center gap-2 w-full px-4 py-2 text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors border-t border-zinc-800"
      >
        <Loader2 size={11} className="animate-spin shrink-0" />
        <span className="truncate">GitHub...</span>
      </button>
    );
  }

  // ── Not connected ────────────────────────────────────────────────────
  return (
    <button
      onClick={() => navigate({ to: "/settings/github" })}
      className="flex items-center gap-2 w-full px-4 py-2 text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors border-t border-zinc-800"
    >
      <GitBranch size={13} className="shrink-0" />
      <span className="truncate">Connect GitHub</span>
    </button>
  );
}
