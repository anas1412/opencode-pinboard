import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { useSyncStatus, useSyncWorktree } from "../hooks/useTickets";

interface SyncBannerProps {
  ticketId: string;
  /** If true, shows in a more compact form (for use inside SplitView) */
  compact?: boolean;
}

export default function SyncBanner({ ticketId, compact }: SyncBannerProps) {
  const { data: status, isLoading } = useSyncStatus(ticketId);
  const syncMutation = useSyncWorktree();
  const [lastResult, setLastResult] = useState<{ ok: boolean; message: string } | null>(null);

  const behind = status?.behind ?? 0;
  const isBehind = behind > 0;

  // If still loading or errored, show nothing
  if (isLoading) return null;
  if (status?.error) return null;
  if (!isBehind) return null;

  // Show sync result briefly
  if (lastResult) {
    return (
      <div
        className={`${compact ? "mb-3" : "mb-4"} rounded-lg px-3 py-2 text-xs ${
          lastResult.ok
            ? "bg-green-900/20 text-green-400 border border-green-800/30"
            : "bg-red-900/20 text-red-400 border border-red-800/30"
        }`}
      >
        <p>{lastResult.message}</p>
      </div>
    );
  }

  return (
    <div
      className={`${compact ? "mb-3" : "mb-4"} flex items-center gap-2 rounded-lg px-3 py-2 text-xs bg-amber-900/20 text-amber-400 border border-amber-800/30`}
    >
      <span className="flex-1">
        Your branch is <strong>{behind}</strong> commit{behind > 1 ? "s" : ""} behind origin
      </span>
      <button
        onClick={async () => {
          setLastResult(null);
          try {
            const result = await syncMutation.mutateAsync(ticketId);
            setLastResult(result);
          } catch (err) {
            setLastResult({
              ok: false,
              message: err instanceof Error ? err.message : "Sync failed",
            });
          }
        }}
        disabled={syncMutation.isPending}
        className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 hover:text-amber-300 transition-colors disabled:opacity-50"
      >
        <RefreshCw size={10} className={syncMutation.isPending ? "animate-spin" : ""} />
        {syncMutation.isPending ? "Syncing..." : "Sync"}
      </button>
    </div>
  );
}
