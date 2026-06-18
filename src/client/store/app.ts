import { create } from "zustand";

type View = "dashboard" | "list" | "kanban" | "settings";

interface AppState {
  view: View;
  setView: (view: View) => void;
  createOpen: boolean;
  setCreateOpen: (open: boolean) => void;
  selectedTicketId: string | null;
  setSelectedTicketId: (id: string | null) => void;
  selectedRepoId: string | null;
  setSelectedRepoId: (id: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  view: "dashboard",
  setView: (view) => set({ view }),
  createOpen: false,
  setCreateOpen: (open) => set({ createOpen: open }),
  selectedTicketId: null,
  setSelectedTicketId: (id) => set({ selectedTicketId: id }),
  selectedRepoId: null,
  setSelectedRepoId: (id) => set({ selectedRepoId: id }),
}));
