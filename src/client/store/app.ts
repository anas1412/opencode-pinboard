import { create } from "zustand";
import type { Theme } from "../../shared/types";

interface AppState {
  createOpen: boolean;
  setCreateOpen: (open: boolean) => void;
  selectedRepoId: string | null;
  setSelectedRepoId: (id: string | null) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export const useAppStore = create<AppState>((set) => ({
  createOpen: false,
  setCreateOpen: (open) => set({ createOpen: open }),
  selectedRepoId: null,
  setSelectedRepoId: (id) => set({ selectedRepoId: id }),
  theme: "amber",
  setTheme: (theme) => set({ theme }),
}));
