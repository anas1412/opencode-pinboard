import { useSearch, useNavigate } from "@tanstack/react-router";
import TicketList from "./TicketList";
import KanbanBoard from "./KanbanBoard";
import { LayoutList, Columns } from "lucide-react";

const VIEW_STORAGE_KEY = "tickets-view";

function loadView(urlView?: string): "list" | "board" {
  if (urlView === "list" || urlView === "board") return urlView;
  const saved = typeof window !== "undefined" ? localStorage.getItem(VIEW_STORAGE_KEY) : null;
  if (saved === "list" || saved === "board") return saved;
  return "list";
}

export default function TicketsView() {
  const search = useSearch({ strict: false }) as { repoId?: string; view?: string };
  const navigate = useNavigate();
  const view = loadView(search.view);

  const setView = (newView: "list" | "board") => {
    localStorage.setItem(VIEW_STORAGE_KEY, newView);
    navigate({
      to: "/tickets",
      search: { repoId: search.repoId, view: newView },
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* View toggle */}
      <div className="flex items-center gap-0.5 bg-zinc-900/80 rounded-lg p-0.5 border border-[var(--border-subtle)] self-end mb-4 shrink-0">
        <button
          onClick={() => setView("list")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${
            view === "list"
              ? "tab-active"
              : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
          }`}
        >
          <LayoutList size={13} />
          List
        </button>
        <button
          onClick={() => setView("board")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${
            view === "board"
              ? "tab-active"
              : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
          }`}
        >
          <Columns size={13} />
          Board
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-auto">
        {view === "list" ? <TicketList /> : <KanbanBoard />}
      </div>
    </div>
  );
}
