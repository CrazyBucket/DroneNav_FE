import { createContext, useContext, useRef, useEffect } from "react";
import { SceneManager } from "./SceneManager";

type SceneContextType = {
  manager: React.MutableRefObject<SceneManager | null>;
  containerRef: React.RefObject<HTMLDivElement>;
};

const SceneContext = createContext<SceneContextType | null>(null);

export const SceneProvider = ({ children }: { children: React.ReactNode }) => {
  const manager = useRef<SceneManager | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current && !manager.current) {
      manager.current = SceneManager.getInstance(containerRef.current);
    }
  }, []);

  return (
    <SceneContext.Provider value={{ manager, containerRef }}>
      {children}
    </SceneContext.Provider>
  );
};
export const useScene = () => {
  const context = useContext(SceneContext);
  if (!context) throw new Error("useScene must be used within SceneProvider");
  return context;
};
