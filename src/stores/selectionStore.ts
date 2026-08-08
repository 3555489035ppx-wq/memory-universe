import { create } from 'zustand';

interface SelectionState {
  selectedIds: string[];
  multiSelect: boolean;
  toggle: (memoryId: string, forceMulti?: boolean) => void;
  setMultiSelect: (active: boolean) => void;
  clear: () => void;
}

export const useSelectionStore = create<SelectionState>((set) => ({
  selectedIds: [],
  multiSelect: false,
  toggle: (memoryId, forceMulti = false) =>
    set((state) => {
      const multiSelect = state.multiSelect || forceMulti;
      const exists = state.selectedIds.includes(memoryId);
      const selectedIds = multiSelect
        ? exists
          ? state.selectedIds.filter((id) => id !== memoryId)
          : [...state.selectedIds, memoryId]
        : [memoryId];
      return { selectedIds, multiSelect };
    }),
  setMultiSelect: (multiSelect) => set({ multiSelect }),
  clear: () => set({ selectedIds: [], multiSelect: false }),
}));
