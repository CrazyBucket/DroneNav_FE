import React, {
  createContext,
  useContext,
  useRef,
  useEffect,
  useState,
} from "react";
import { DroneWebSocket } from "@/services/ws";
import { SceneManager } from "./SceneManager";
import { useSimulationStore } from "@/store/simulationState";

// 定义全局持久化存储的操作面板状态
interface DroneContextType {
  // WebSocket连接引用
  wsRef: React.MutableRefObject<DroneWebSocket | null>;
  // 是否正在飞行中的标志
  isFlying: boolean;
  // 设置飞行状态
  setIsFlying: (flying: boolean) => void;
  // 存储最后一个位置更新回调
  setPositionUpdateCallback: (callback: ((data: any) => void) | null) => void;
  // 启动模拟
  startSimulation: (taskId: string, wsEndpoint: string) => Promise<void>;
  // 停止模拟
  stopSimulation: () => void;
}

// 创建Context
const DroneContext = createContext<DroneContextType | null>(null);

// 持久化存储的回调函数
let globalPositionUpdateCallback: ((data: any) => void) | null = null;
// 全局渲染定时器
let globalRenderInterval: ReturnType<typeof setInterval> | null = null;

export const DroneProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const wsRef = useRef<DroneWebSocket | null>(null);
  const [isFlying, setIsFlying] = useState(false);
  const setSimulationStatus = useSimulationStore(
    state => state.setSimulationStatus
  );

  // 在组件卸载时保持定时器运行
  useEffect(() => {
    // 如果已有计时器，先清理
    if (globalRenderInterval) {
      clearInterval(globalRenderInterval);
    }

    // 创建全局定期刷新渲染的定时器
    globalRenderInterval = setInterval(() => {
      try {
        if (isFlying) {
          const scene = SceneManager.getInstance();
          scene.setForceRender(true);
          scene.forceRefreshAnimations();
          scene.requestRender();
        }
      } catch (error) {
        console.error("[DroneContext] 渲染刷新出错:", error);
      }
    }, 1000); // 每秒刷新一次

    // 组件卸载时不清理全局定时器，确保仿真继续
    return () => {
      // 不清理globalRenderInterval，让它继续运行
    };
  }, [isFlying]);

  // 添加场景ID切换监听
  useEffect(() => {
    const currentSceneId = useSimulationStore.getState().currentSceneId;

    // 当场景ID变更时的监听器
    const unsubscribe = useSimulationStore.subscribe((state, prevState) => {
      // 如果场景ID变更且当前正在飞行
      if (state.currentSceneId !== prevState.currentSceneId && isFlying) {
        console.log(
          `[DroneContext] 检测到场景切换: ${prevState.currentSceneId} -> ${state.currentSceneId}，确保连接保持活跃`
        );

        // 确保WebSocket连接保持活跃
        if (wsRef.current && wsRef.current.isConnected()) {
          wsRef.current.keepAlive();

          // 当切换场景时，确保场景渲染持续进行
          const scene = SceneManager.getInstance();
          scene.setForceRender(true);
          scene.forceRefreshAnimations();
          scene.requestRender();
        }
      }
    });

    // 组件卸载时取消监听
    return () => {
      unsubscribe();
    };
  }, [isFlying]);

  // 监听页面可见性变化，确保切回页面时继续渲染
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && isFlying) {
        console.log("[DroneContext] 页面可见性恢复，确保场景继续渲染");
        const scene = SceneManager.getInstance();
        scene.setForceRender(true);
        scene.forceRefreshAnimations();
        scene.requestRender();

        // 确保WebSocket连接保持活跃
        if (wsRef.current) {
          wsRef.current.keepAlive();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isFlying]);

  // 设置位置更新回调
  const setPositionUpdateCallback = (
    callback: ((data: any) => void) | null
  ) => {
    globalPositionUpdateCallback = callback;
  };

  // 启动模拟，连接WebSocket并设置回调
  const startSimulation = async (taskId: string, wsEndpoint: string) => {
    try {
      // 断开旧连接
      if (wsRef.current) {
        wsRef.current.disconnect();
      }

      // 确保WS链接使用wss协议
      let wsUrl = wsEndpoint;
      if (wsUrl.startsWith("ws://")) {
        wsUrl = wsUrl.replace("ws://", "wss://");
      }
      if (wsUrl.startsWith("http://")) {
        wsUrl = wsUrl.replace("http://", "wss://");
      }

      // 创建新的WebSocket连接
      const ws = new DroneWebSocket({
        url: wsUrl,
      });

      // 保存到引用
      wsRef.current = ws;

      // 注册事件处理程序
      ws.subscribe("position_update", data => {
        // 调用全局回调函数
        if (globalPositionUpdateCallback) {
          globalPositionUpdateCallback(data);
        }
      });

      ws.subscribe("connected", () => {
        console.log("[DroneContext] WebSocket连接已建立");
        setIsFlying(true);
        setSimulationStatus("flying");

        // 确保场景持续渲染
        const scene = SceneManager.getInstance();
        scene.setForceRender(true);

        // 标记连接为需要保持
        ws.keepAlive();
      });

      ws.subscribe("disconnected", data => {
        console.log("[DroneContext] WebSocket断开连接:", data);
      });

      ws.subscribe("mission_complete", () => {
        console.log("[DroneContext] 任务完成");
        setIsFlying(false);
        setSimulationStatus("completed");
      });

      ws.subscribe("error", error => {
        console.error("[DroneContext] WebSocket错误:", error);
      });

      // 连接WebSocket
      ws.connect();

      return;
    } catch (error) {
      console.error("[DroneContext] 启动模拟失败:", error);
      throw error;
    }
  };

  // 停止模拟
  const stopSimulation = () => {
    if (wsRef.current) {
      wsRef.current.disconnect();
      wsRef.current = null;
    }
    setIsFlying(false);
    setSimulationStatus("idle");
  };

  // 提供Context值
  const contextValue: DroneContextType = {
    wsRef,
    isFlying,
    setIsFlying,
    setPositionUpdateCallback,
    startSimulation,
    stopSimulation,
  };

  return (
    <DroneContext.Provider value={contextValue}>
      {children}
    </DroneContext.Provider>
  );
};

// 自定义Hook，用于访问DroneContext
export const useDrone = () => {
  const context = useContext(DroneContext);
  if (!context) {
    throw new Error("useDrone must be used within a DroneProvider");
  }
  return context;
};
