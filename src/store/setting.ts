import { create } from 'zustand';

interface SettingState {
  showDebugView: boolean;
  toggleDebugView: () => void;
  setDebugView: (show: boolean) => void;
  
  // 轨迹显示设置
  showPlannedPath: boolean;
  showRealTimePath: boolean;
  setShowPlannedPath: (show: boolean) => void;
  setShowRealTimePath: (show: boolean) => void;
}

export const useSettingStore = create<SettingState>((set) => ({
  showDebugView: false, // 默认不显示调试视图
  toggleDebugView: () => set((state) => ({ showDebugView: !state.showDebugView })),
  setDebugView: (show: boolean) => set({ showDebugView: show }),
  
  // 轨迹显示设置
  showPlannedPath: true, // 默认显示计划轨迹
  showRealTimePath: true, // 默认显示实时轨迹
  setShowPlannedPath: (show: boolean) => set({ showPlannedPath: show }),
  setShowRealTimePath: (show: boolean) => set({ showRealTimePath: show }),
}));
