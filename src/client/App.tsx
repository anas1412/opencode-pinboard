import { useState } from "react";
import { LayoutDashboard, ListTodo, Settings, Plus } from "lucide-react";

type View = "list" | "kanban" | "settings";

export default function App() {
  const [view, setView] = useState<View>("list");

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100">
      {/* Sidebar */}
      <aside className="w-[220px] min-w-[220px] border-r border-zinc-800 flex flex-col">
        <div className="p-4">
          <h1 className="text-lg font-bold tracking-tight">OpenDev</h1>
        </div>

        <nav className="flex-1 px-2 space-y-1">
          <button
            onClick={() => setView("list")}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
              view === "list"
                ? "bg-zinc-800 text-white"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <ListTodo size={16} />
            List
          </button>
          <button
            onClick={() => setView("kanban")}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
              view === "kanban"
                ? "bg-zinc-800 text-white"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <LayoutDashboard size={16} />
            Kanban
          </button>
        </nav>

        <div className="border-t border-zinc-800 p-4">
          <button
            onClick={() => setView("settings")}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <Settings size={16} />
            Settings
          </button>
        </div>
      </aside>

      {/* Main area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between px-6 py-3 border-b border-zinc-800">
          <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
            {view === "list" ? "Tickets" : view === "kanban" ? "Board" : "Settings"}
          </h2>
          {view !== "settings" && (
            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-md text-sm font-medium transition-colors">
              <Plus size={14} />
              New ticket
            </button>
          )}
        </header>

        <div className="flex-1 overflow-auto p-6">
          {view === "list" && (
            <div className="text-center text-zinc-500 mt-20">
              <p className="text-lg">No tickets yet</p>
              <p className="text-sm mt-1">
                Create your first ticket — press <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-xs">N</kbd>
              </p>
            </div>
          )}
          {view === "kanban" && (
            <div className="text-center text-zinc-500 mt-20">
              <p className="text-lg">No tickets yet</p>
              <p className="text-sm mt-1">Create a ticket to see it on the board</p>
            </div>
          )}
          {view === "settings" && (
            <div className="max-w-lg mx-auto text-zinc-500">
              <p className="text-lg text-zinc-300 font-medium">Settings</p>
              <p className="text-sm mt-2">Repo configuration and app preferences coming here.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
