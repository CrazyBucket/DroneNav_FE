import { create } from "zustand";

interface Coordinate {
  x: number;
  y: number;
  z: number;
}

interface CoordinatesStore {
  currentCoordinate: Coordinate | null;
  setCurrentCoordinate: (coordinate: Coordinate) => void;
}

export const useCoordinatesStore = create<CoordinatesStore>(set => ({
  currentCoordinate: null,
  setCurrentCoordinate: coordinate => set({ currentCoordinate: coordinate }),
}));
