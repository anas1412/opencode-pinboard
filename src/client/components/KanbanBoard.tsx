import { useMemo } from "react";
import { useTickets } from "../hooks/useTickets";
import { useRepos } from "../hooks/useRepos";
import { useAppStore } from "../store/app";
import type { Ticket, TicketStatus } from "../../shared/types";

const COLUMNS: { status: TicketStatus; label: string }[] = [
  { status: "open", label: "Open" },
  { status: "in_progress", label: "In Progress" },
  { status: "needs_review", label: "Needs Review" },
  { status: "changes_requested", label: "Changes Requested" },
  { status: "resolved", label: "Resolved" },
];

const STATUS_DOT_COLORS: Record<string, string> = {
  open: "bg-blue-500",
  in_progress: "bg-amber-500",
  needs_review: "bg-purple-500",
  changes_requested: "bg-red-500",
  resolved: "bg-green-500",
  closed: "bg-zinc-500",
};

function formatCost(cost: number): string {
  if (cost < 0.01) return "< $0.01";
  return `$${cost.toFixed(2)}`;
}

function TicketCard({
  ticket,
  repoName,
  onSelect,
}: {
  ticket: Ticket;
  repoName: string;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      onClick={() => onSelect(ticket.id)}
      className="w-full text-left bg-zinc-800 hover:bg-zinc-750 border border-zinc-700 hover:border-zinc-600 rounded-lg p-3 transition-colors cursor-pointer space-y-2"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-zinc-200 leading-snug line-clamp-2">
          {ticket.title}
        </p>
      </div>
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <span>{repoName}</span>
        <span className="text-zinc-700">·</span>
        <span className="font-mono">{formatCost(ticket.totalCostUsd)}</span>
      </div>
    </button>
  );
}

interface KanbanBoardProps {
  repoId?: string;
}

export default function KanbanBoard({ repoId }: KanbanBoardProps) {
  const { data, isLoading, isError } = useTickets({ repoId });
  const { data: repos } = useRepos();
  const { setSelectedTicketId } = useAppStore();

  const repoMap = useMemo(
    () => new Map(repos?.map((r) => [r.id, r.name]) ?? []),
    [repos],
  );

  const grouped = useMemo(() => {
    const map: Record<string, Ticket[]> = {};
    for (const col of COLUMNS) map[col.status] = [];
    for (const ticket of data?.tickets ?? []) {
      if (ticket.status !== "closed") {
        map[ticket.status]?.push(ticket);
      }
    }
    return map;
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex gap-4 h-full">
        {COLUMNS.map((col) => (
          <div key={col.status} className="flex-1 space-y-3">
            <div className="h-5 w-24 bg-zinc-800 rounded animate-pulse" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 bg-zinc-800/50 rounded-lg animate-pulse" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-12">
        <p className="text-red-400 text-sm">Could not load board.</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-3 text-xs text-blue-400 hover:text-blue-300 underline"
        >
          Retry
        </button>
      </div>
    );
  }

  const anyTickets = (data?.tickets?.length ?? 0) > 0;

  if (!anyTickets) {
    return (
      <div className="text-center text-zinc-500 mt-20">
        <p className="text-lg">No tickets yet</p>
        <p className="text-sm mt-1">
          Create a ticket to see it on the board
        </p>
      </div>
    );
  }

  return (
    <div className="flex gap-4 h-full overflow-x-auto pb-4">
      {COLUMNS.map((col) => {
        const tickets = grouped[col.status] ?? [];

        return (
          <div key={col.status} className="flex-1 min-w-[220px] flex flex-col">
            {/* Column header */}
            <div className="flex items-center gap-2 mb-3 px-1">
              <span
                className={`w-2 h-2 rounded-full ${STATUS_DOT_COLORS[col.status]}`}
              />
              <h3 className="text-sm font-medium text-zinc-300">{col.label}</h3>
              <span className="text-xs text-zinc-600 font-mono">{tickets.length}</span>
            </div>

            {/* Cards */}
            <div className="flex-1 space-y-2 overflow-y-auto">
              {tickets.map((ticket) => (
                <TicketCard
                  key={ticket.id}
                  ticket={ticket}
                  repoName={repoMap.get(ticket.repoId) ?? ticket.repoId.slice(0, 8)}
                  onSelect={setSelectedTicketId}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
