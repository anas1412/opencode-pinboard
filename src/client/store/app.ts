import { create } from "zustand";
import type { Theme } from "../../shared/types";

export interface GhUser {
  login: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  plan: string | null;
}

export type GhPhase = "checking" | "missing" | "no-token" | "authed" | "error" | null;

interface AppState {
  createOpen: boolean;
  setCreateOpen: (open: boolean) => void;
  selectedRepoId: string | null;
  setSelectedRepoId: (id: string | null) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  ghUser: GhUser | null;
  ghPhase: GhPhase;
  setGhAuth: (phase: GhPhase, user?: GhUser) => void;
}

export const useAppStore = create<AppState>((set) => ({
  createOpen: false,
  setCreateOpen: (open) => set({ createOpen: open }),
  selectedRepoId: null,
  setSelectedRepoId: (id) => set({ selectedRepoId: id }),
  theme: "amber",
  setTheme: (theme) => set({ theme }),
  ghUser: null,
  ghPhase: null,
  setGhAuth: (phase, user) => set({ ghPhase: phase, ghUser: user ?? null }),
}));
