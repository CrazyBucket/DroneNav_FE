import { create } from 'zustand';

interface SettingState {
  showDebugView: boolean;
  toggleDebugView: () => void;
  setDebugView: (show: boolean) => void;
}

export const useSettingStore = create<SettingState>((set) => ({
  showDebugView: false, // 默认不显示调试视图
  toggleDebugView: () => set((state) => ({ showDebugView: !state.showDebugView })),
  setDebugView: (show: boolean) => set({ showDebugView: show }),
}));

