import { useState } from "react";
import { useAppStore } from "../store/app";
import { useRepos, useDeleteRepo } from "../hooks/useRepos";
import { useTickets } from "../hooks/useTickets";
import { useCostSummary } from "../hooks/useCostSummary";
import AddRepoModal from "./AddRepoModal";
import { GitBranch, FolderPlus, Trash2, Layers, ArrowRight, Settings2, Pin } from "lucide-react";

export default function Sidebar() {
  const { selectedRepoId, setSelectedRepoId, setSelectedTicketId, setView } = useAppStore();
  const { data: repos } = useRepos();
  const { data: ticketsData } = useTickets();
  const { data: costs } = useCostSummary();
  const deleteRepo = useDeleteRepo();
  const [addRepoOpen, setAddRepoOpen] = useState(false);

  const activeTickets =
    ticketsData?.tickets?.filter((t) => t.activeSessionId !== null) ?? [];

  return (
    <aside className="w-[220px] min-w-[220px] border-r border-zinc-800/60 flex flex-col bg-zinc-950 relative">
      {/* Accent glow line */}
      <div className="absolute top-0 left-0 w-px h-full pointer-events-none" style={{ background: `linear-gradient(to bottom, var(--accent) 0%, color-mix(in srgb, var(--accent) 50%, transparent) 40%, transparent 100%)` }} />
      <div className="p-4 flex justify-center">
        <button
          onClick={() => {
            setSelectedRepoId(null);
            setSelectedTicketId(null);
            setView("dashboard");
          }}
          className="flex items-center gap-2 text-lg font-bold tracking-tight text-white transition-colors duration-150 hover:[color:var(--accent-text)]"
        >
          <Pin size={18} className="-rotate-45" />
          OpenTack
        </button>
      </div>

      {/* Active sessions section — scrollable */}
      <div className="flex-1 px-2 space-y-0.5 overflow-auto min-h-0">
        <div className="px-2 py-2">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full" style={{ backgroundColor: 'var(--accent)' }} />
            Active
          </p>
        </div>
        {activeTickets.map((ticket) => (
          <button
            key={ticket.id}
            onClick={() => {
              setSelectedTicketId(ticket.id);
              setView("list");
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 rounded-md transition-colors text-left"
          >
            <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-green-400" />
            <span className="truncate flex-1 min-w-0 text-left">{ticket.title}</span>
            <ArrowRight size={12} className="shrink-0 text-zinc-600" />
          </button>
        ))}
        {activeTickets.length === 0 && (
          <p className="px-3 py-1.5 text-xs text-zinc-600 italic">None running</p>
        )}
      </div>

      {/* Repos section */}
      <div className="flex items-center justify-between px-4 py-2 mt-1">
        <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
          <span className="w-1 h-1 rounded-full" style={{ backgroundColor: 'var(--accent)' }} />
          Repos
        </p>
        <button
          onClick={() => setAddRepoOpen(true)}
          className="p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
          title="Add repo"
        >
          <FolderPlus size={14} />
        </button>
      </div>
      <div className="px-2 space-y-0.5 overflow-auto max-h-[40vh]">
        <button
          onClick={() => {
            setSelectedRepoId(null);
            setSelectedTicketId(null);
            setView("dashboard");
          }}
          className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-all duration-150 ${
            selectedRepoId === null
              ? "nav-active"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
          }`}
        >
          <Layers size={14} className="shrink-0" />
          <span className="truncate">All repos</span>
        </button>

        {repos?.map((repo) => (
          <div key={repo.id} className="group flex items-center">
            <button
              onClick={() => {
                setSelectedRepoId(repo.id);
                setSelectedTicketId(null);
                setView("dashboard");
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-all duration-150 flex-1 min-w-0 ${
                selectedRepoId === repo.id
                  ? "nav-active"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
              }`}
            >
              <GitBranch size={14} className="shrink-0" />
              <span className="truncate">{repo.name}</span>
            </button>
            <button
              onClick={() => {
                if (confirm(`Remove "${repo.name}"?`)) deleteRepo.mutate(repo.id);
              }}
              className="opacity-0 group-hover:opacity-100 p-1 mr-1 rounded text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0"
              title="Remove repo"
            >
              <Trash2 size={11} />
            </button>
          </div>
        ))}
        {(!repos || repos.length === 0) && (
          <p className="px-3 py-2 text-xs text-zinc-600 italic">No repos added</p>
        )}
      </div>

      {/* Cost — compact */}
      <div className="px-4 py-3 border-t border-zinc-800 mt-auto">
        <div className="flex items-baseline justify-between">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Week</p>
          <p className="text-sm text-zinc-300 font-mono">
            {costs ? `$${costs.weekTotalUsd.toFixed(2)}` : "—"}
          </p>
        </div>
        <div className="flex items-baseline justify-between mt-0.5">
          <p className="text-[11px] text-zinc-600">Tokens</p>
          <p className="text-[11px] text-zinc-500 font-mono">
            {costs ? costs.weekTotalTokens.toLocaleString() : "—"}
          </p>
        </div>
      </div>

      <button
        onClick={() => setView("settings")}
        className="flex items-center gap-2 px-4 py-2 text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors border-t border-zinc-800"
      >
        <Settings2 size={13} />
        Settings
      </button>

      <AddRepoModal open={addRepoOpen} onClose={() => setAddRepoOpen(false)} />
    </aside>
  );
}
