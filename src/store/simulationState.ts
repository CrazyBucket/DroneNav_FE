import { create } from 'zustand';

export type SimulationStatus = 'idle' | 'planning' | 'flying' | 'completed';

interface SimulationState {
  // 全局加载状态
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  
  // 仿真状态
  simulationStatus: SimulationStatus;
  setSimulationStatus: (status: SimulationStatus) => void;
  
  // 清理状态
  resetState: () => void;
}

export const useSimulationStore = create<SimulationState>((set) => ({
  isLoading: false,
  setIsLoading: (loading) => set({ isLoading: loading }),
  
  simulationStatus: 'idle',
  setSimulationStatus: (simulationStatus) => set({ simulationStatus }),
  
  resetState: () => set({ 
    isLoading: false, 
    simulationStatus: 'idle' 
  }),
})); 