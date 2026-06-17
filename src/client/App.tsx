import { useAppStore } from "./store/app";
import Sidebar from "./components/Sidebar";
import TicketList from "./components/TicketList";
import KanbanBoard from "./components/KanbanBoard";
import TicketCreate from "./components/TicketCreate";
import { Plus } from "lucide-react";

export default function App() {
  const { view, setView, setCreateOpen } = useAppStore();

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100">
      <Sidebar />

      {/* Main area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between px-6 py-3 border-b border-zinc-800">
          <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
            {view === "list" ? "Tickets" : view === "kanban" ? "Board" : "Settings"}
          </h2>
          {view !== "settings" && (
            <button
              onClick={() => setCreateOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-md text-sm font-medium transition-colors"
            >
              <Plus size={14} />
              New ticket
            </button>
          )}
        </header>

        <div className="flex-1 overflow-auto p-6">
          {view === "list" && <TicketList />}
          {view === "kanban" && <KanbanBoard />}
          {view === "settings" && (
            <div className="max-w-lg mx-auto text-zinc-500">
              <p className="text-lg text-zinc-300 font-medium">Settings</p>
              <p className="text-sm mt-2">Repo configuration and app preferences coming here.</p>
            </div>
          )}
        </div>
      </main>

      {/* Slide-over create panel */}
      <TicketCreate />
    </div>
  );
}
