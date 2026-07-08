import { create } from "zustand";

interface UiState {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  dataMode: "auto" | "mock";
  setDataMode: (dataMode: "auto" | "mock") => void;
  selectedProjectId?: string;
  setSelectedProjectId: (selectedProjectId?: string) => void;
  projectOptions: Array<{ value: string; label: string }>;
  setProjectOptions: (projectOptions: Array<{ value: string; label: string }>) => void;
}

export const useUiStore = create<UiState>((set) => ({
  collapsed: false,
  setCollapsed: (collapsed) => set({ collapsed }),
  dataMode: "auto",
  setDataMode: (dataMode) => set({ dataMode }),
  selectedProjectId: undefined,
  setSelectedProjectId: (selectedProjectId) => set({ selectedProjectId }),
  projectOptions: [],
  setProjectOptions: (projectOptions) => set({ projectOptions }),
}));
