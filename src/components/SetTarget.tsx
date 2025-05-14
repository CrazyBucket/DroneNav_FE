import React, { useCallback, useEffect, useRef, useState } from "react";
import { InputNumber, Button, message, Spin } from "antd";
import * as THREE from "three";
import { debounce } from "lodash-es";
import { SceneManager } from "@/core/SceneManager";
import { apis } from "@/services/api";
import { DroneWebSocket } from "@/services/ws";
import { useCoordinatesStore } from "@/store/coordinates";
import { useSimulationStore } from "@/store/simulationState";
import { useSettingStore } from "@/store/setting";
import { WS_BASE_URL } from "@/services/config";
import { prepareForWSSConnection, useSafeMessage } from "@/utils/certificate";

interface CoordinateValue {
  x: number;
  y: number;
  z: number;
}

const DEBOUNCE_DELAY = 500;

const useTrajectory = () => {
  const scene = SceneManager.getInstance();
  const [plannedPath, setPlannedPath] = useState<THREE.Vector3[]>([]);
  const [flightPath, setFlightPath] = useState<THREE.Vector3[]>([]);
  const flightPointsRef = useRef<THREE.Vector3[]>([]);

  // 更新计划路径
  const updatePlanned = useCallback(
    (points: THREE.Vector3[]) => {
      setPlannedPath(points.map(p => p.clone()));
      scene.setPlannedPath(points.map(p => p.clone()));
    },
    [scene]
  );

  // 更新实时路径
  const updateFlight = useCallback(
    (point: THREE.Vector3) => {
      // 将点添加到本地状态
      flightPointsRef.current.push(point.clone());
      const pathCopy = [...flightPointsRef.current];
      setFlightPath(pathCopy);

      // 先确保轨迹可见
      scene.setTrajectoryVisibility("flight", true);

      // 两种方式更新轨迹：直接添加单点或设置整个路径
      if (flightPointsRef.current.length === 1) {
        // 如果只有一个点，先添加起点和终点相同的线段，使其能显示
        scene.setFlightPath([point.clone(), point.clone()]);
      } else if (flightPointsRef.current.length === 2) {
        // 如果有两个点，重建轨迹
        scene.setFlightPath(pathCopy);
      } else {
        // 如果有多个点，直接添加点
        scene.addFlightPoint(point.clone());
      }

      // 请求重新渲染
      scene.requestRender();

      console.log(
        `[SetTarget] 添加飞行点: (${point.x}, ${point.y}, ${point.z}), 当前点数: ${flightPointsRef.current.length}`
      );
    },
    [scene]
  );

  // 清除路径
  const clearPaths = useCallback(() => {
    setPlannedPath([]);
    setFlightPath([]);
    flightPointsRef.current = [];
    scene.clearTrajectories({ clearPlanned: true, clearFlight: true });
    scene.setPlannedPath([]);
    scene.setFlightPath([]);
  }, [scene]);

  return { plannedPath, flightPath, updatePlanned, updateFlight, clearPaths };
};

const CoordinateInput: React.FC<{
  value: CoordinateValue;
  onChange?: (value: CoordinateValue) => void;
}> = ({ value, onChange }) => {
  const handleChange = (axis: "x" | "y" | "z") => (val: number | null) => {
    const newValue = { ...value, [axis]: val || 0 };
    onChange?.(newValue);
  };

  return (
    <div className="flex gap-3 w-full max-w-[350px]">
      {/* X 坐标输入 */}
      <div className="flex items-center flex-1">
        <span className="text-sm text-white mr-2 w-6">X:</span>
        <InputNumber
          min={-Infinity}
          max={Infinity}
          value={value.x}
          onChange={handleChange("x")}
          className="w-full [&_.ant-input-number]:bg-emerald-900/20 [&_.ant-input-number]:border-emerald-800 [&_.ant-input-number]:text-emerald-50"
          controls={false}
          style={{ borderRadius: 6 }}
          placeholder="0.00"
        />
      </div>

      {/* Y 坐标输入 */}
      <div className="flex items-center flex-1">
        <span className="text-sm text-white mr-2 w-6">Y:</span>
        <InputNumber
          min={-Infinity}
          max={Infinity}
          value={value.y}
          onChange={handleChange("y")}
          className="w-full [&_.ant-input-number]:bg-emerald-900/20 [&_.ant-input-number]:border-emerald-800 [&_.ant-input-number]:text-emerald-50"
          controls={false}
          style={{ borderRadius: 6 }}
          placeholder="0.00"
        />
      </div>

      {/* Z 坐标输入 */}
      <div className="flex items-center flex-1">
        <span className="text-sm text-white mr-2 w-6">Z:</span>
        <InputNumber
          min={0}
          max={Infinity}
          value={value.z}
          onChange={handleChange("z")}
          className="w-full [&_.ant-input-number]:bg-emerald-900/20 [&_.ant-input-number]:border-emerald-800 [&_.ant-input-number]:text-emerald-50"
          controls={false}
          style={{ borderRadius: 6 }}
          placeholder="0.00"
        />
      </div>
    </div>
  );
};

export const SetTarget: React.FC = () => {
  const [coordinates, setCoordinates] = useState<CoordinateValue>({
    x: 0,
    y: 0,
    z: 0,
  });
  const [isReachable, setIsReachable] = useState(false);
  const lastPositionRef = React.useRef<CoordinateValue>({ x: 0, y: 0, z: 0 });
  const { currentCoordinate } = useCoordinatesStore();
  const {
    isLoading,
    setIsLoading,
    simulationStatus,
    setSimulationStatus,
    resetState,
  } = useSimulationStore();
  const { showPlannedPath, showRealTimePath } = useSettingStore();
  const wsRef = useRef<DroneWebSocket | null>(null);
  const scene = SceneManager.getInstance();
  const [totalPoints, setTotalPoints] = useState(0);
  const isPathInitializedRef = useRef(false);
  const plannedPathArrayRef = useRef<(THREE.Vector3 | null)[]>([]);
  const safeMessage = useSafeMessage(); // 使用安全的消息API

  const convertCoordinates = useCallback((coords: CoordinateValue) => {
    return new THREE.Vector3(coords.x, coords.z, coords.y);
  }, []);

  const { updatePlanned, updateFlight, clearPaths, plannedPath, flightPath } =
    useTrajectory();

  const handlePositionUpdate = useCallback(
    (data: any) => {
      // 转换当前坐标
      const targetPos = convertCoordinates(data.coordinates);

      // 首次接收时初始化计划路径数组(收到一点更新一点，保持完整的预测虚线)
      if (!isPathInitializedRef.current && data.progress?.total) {
        const total = data.progress.total;
        setTotalPoints(total);
        isPathInitializedRef.current = true;
        // 初始化一个空数组，将随着接收到的点逐步构建计划路径
        plannedPathArrayRef.current = Array(total).fill(null);
      }

      // 更新无人机位置并队列动画，飞行轨迹由 smartAnimate 的 addFlightPoint 添加
      scene.smartAnimate("drone-model", targetPos, {
        duration: 0.5,
        lookAtTarget: true,
        addToQueue: true,
      });
      // 飞行轨迹将在每次动画完成后由 SceneManager.addFlightPoint 自动添加

      // 更新计划路径（虚线）
      if (isPathInitializedRef.current && data.progress?.current) {
        const currentIndex = data.progress.current - 1;

        // 更新当前位置的点
        plannedPathArrayRef.current[currentIndex] = targetPos.clone();

        // 过滤掉null值，转换为非空数组
        const validPoints = plannedPathArrayRef.current.filter(
          (point): point is THREE.Vector3 => point !== null
        );

        // 直接使用已知的有效点更新计划轨迹
        try {
          scene.setPlannedPath(validPoints.map(p => p.clone()));
        } catch (error) {
          console.error("调试: 设置计划路径失败:", error);
        }

        // 直接使用updatePlanned函数更新状态
        updatePlanned(validPoints);

        // 确保轨迹可见
        try {
          scene.setTrajectoryVisibility("planned", true);
          scene.setTrajectoryVisibility("flight", true);
          // 强制渲染一次
          scene.requestRender();
        } catch (error) {
          console.error("调试: 设置轨迹可见性失败:", error);
        }
      }
    },
    [
      convertCoordinates,
      currentCoordinate,
      updatePlanned,
      scene,
      showPlannedPath,
      showRealTimePath,
    ]
  );

  const updateSceneMarker = useCallback(
    (coords: CoordinateValue) => {
      if (!scene) return;

      const threePosition = convertCoordinates(coords);
      const reachable = scene.addMarker(threePosition, "user-input-marker");
      setIsReachable(reachable);
      lastPositionRef.current = coords;
    },
    [convertCoordinates]
  );

  const handleCoordinateChange = useCallback(
    (newValue: CoordinateValue) => {
      setCoordinates(newValue);
      debounce(updateSceneMarker, DEBOUNCE_DELAY)(newValue);
    },
    [updateSceneMarker]
  );

  const handleSubmit = useCallback(async () => {
    // 每次新仿真前清空上一次轨迹
    clearPaths();
    plannedPathArrayRef.current = [];
    isPathInitializedRef.current = false;
    setTotalPoints(0);

    if (!isReachable) {
      safeMessage.error("当前位置不可达，无法提交");
      return;
    }
    if (currentCoordinate === lastPositionRef.current) {
      safeMessage.error("当前位置与上次位置相同");
      return;
    }

    try {
      // 如果有现有连接，先断开
      if (wsRef.current) {
        wsRef.current.disconnect();
        wsRef.current = null;
      }

      // 检查WSS证书状态
      try {
        await prepareForWSSConnection();
      } catch (error) {
        console.warn("WSS证书准备失败，但我们将继续尝试连接:", error);
      }

      setIsLoading(true);
      setSimulationStatus("planning");
      safeMessage.info("正在规划路径...");

      // 设置请求超时
      const requestTimeout = setTimeout(() => {
        if (simulationStatus === "planning") {
          safeMessage.warning("路径规划请求超时，请检查后端服务是否正常运行");
          setIsLoading(false);
          setSimulationStatus("idle");
        }
      }, 10000);

      // 设置强制渲染模式，确保即使失去焦点也能渲染
      scene.setForceRender(true);

      // 添加页面可见性监听，确保页面始终渲染
      const enableForcedRender = () => {
        if (document.hidden) {
          // 如果页面不可见，强制渲染
          scene.setForceRender(true);
        }
      };

      // 添加监听器
      document.addEventListener("visibilitychange", enableForcedRender);

      try {
        const response = await apis.startSimulation({
          current: currentCoordinate!,
          target: lastPositionRef.current,
        });

        // 清除超时
        clearTimeout(requestTimeout);

        setSimulationStatus("flying");

        // 确保轨迹可见性
        scene.setTrajectoryVisibility("planned", true);
        scene.setTrajectoryVisibility("flight", true);

        // 正确设置持久性
        scene.setPersistent("planned-trajectory", true);
        scene.setPersistent("flight-trajectory", true);

        // 初始化实际飞行轨迹状态
        const initialPos = convertCoordinates(currentCoordinate!);
        console.log("[SetTarget] 初始化飞行轨迹，起点:", initialPos);

        // 将起点加入飞行轨迹
        updateFlight(initialPos);

        // 确保场景进行渲染
        scene.requestRender();

        // 验证响应中是否有WS端点
        if (!response.ws_endpoint) {
          throw new Error("后端未返回WebSocket端点");
        }

        // 确保WebSocket URL使用wss协议
        let wsUrl = `${WS_BASE_URL}${response.ws_endpoint}`;
        if (wsUrl.startsWith("ws://")) {
          wsUrl = wsUrl.replace("ws://", "wss://");
          console.warn("已将WebSocket URL从ws://转换为wss://");
        }

        // 初始化WebSocket
        wsRef.current = new DroneWebSocket({
          url: wsUrl,
        });

        // 事件订阅
        wsRef.current.subscribe("position_update", (data: any) => {
          handlePositionUpdate(data);
        });

        wsRef.current.subscribe("mission_complete", () => {
          safeMessage.success("仿真完成");
          setSimulationStatus("completed");
          setIsLoading(false);

          // 确保在任务完成后仍然可以看到轨迹
          setTimeout(() => {
            scene.setTrajectoryVisibility("planned", showPlannedPath);
            scene.setTrajectoryVisibility("flight", showRealTimePath);
            // 更新起点为终点
            useCoordinatesStore.setState({
              currentCoordinate: lastPositionRef.current,
            });
            // 移除标记点
            scene.removeObject("user-input-marker");
            // 完成后关闭强制渲染模式，但继续保持渲染
            scene.setForceRender(false);
            scene.requestRender();

            // 移除页面可见性监听
            document.removeEventListener(
              "visibilitychange",
              enableForcedRender
            );
          }, 500); // 增加延迟时间，确保状态更新完成
        });

        // 添加错误处理
        wsRef.current.subscribe("error", error => {
          console.error("WebSocket 错误:", error);
          safeMessage.error(`连接错误: ${error.message || "未知错误"}`);

          // 如果是WSS证书问题，显示具体提示
          if (error.code === "CONNECTION_ERROR") {
            safeMessage.warning("请确保已接受WSS安全证书");
          }
        });

        // 添加断开连接处理
        wsRef.current.subscribe("disconnected", data => {
          console.log("WebSocket 断开连接:", data);
          if (data.reason && simulationStatus !== "completed") {
            safeMessage.warning(`连接断开: ${data.reason}`, 3);
          }
        });

        // 添加连接成功回调
        wsRef.current.subscribe("connected", () => {
          console.log("WebSocket 连接成功");
          safeMessage.success("路径规划连接已建立", 2);
        });

        // 设置WS连接超时
        const wsTimeout = setTimeout(() => {
          if (wsRef.current && simulationStatus === "planning") {
            safeMessage.error("WebSocket连接超时，请检查网络和证书设置");
            setIsLoading(false);
            setSimulationStatus("idle");
            wsRef.current.disconnect();
          }
        }, 10000);

        // 尝试建立连接
        wsRef.current.connect();

        // 连接建立后清除超时
        wsRef.current.subscribe("connected", () => {
          clearTimeout(wsTimeout);
        });
      } catch (apiError) {
        // API调用错误处理
        console.error("API调用失败:", apiError);
        safeMessage.error(
          `任务启动失败: ${(apiError as Error).message || "无法连接到服务器"}`
        );
        setIsLoading(false);
        setSimulationStatus("idle");

        // 出错时关闭强制渲染模式
        scene.setForceRender(false);
        // 移除页面可见性监听
        document.removeEventListener("visibilitychange", enableForcedRender);
      }
    } catch (err) {
      console.error("整体错误:", err);
      safeMessage.error(
        "任务启动失败: " + ((err as Error).message || "未知错误")
      );
      setIsLoading(false);
      setSimulationStatus("idle");
      // 出错时关闭强制渲染模式
      scene.setForceRender(false);
      // 移除所有页面可见性监听
      const enableForcedRender = () => scene.setForceRender(true);
      document.removeEventListener("visibilitychange", enableForcedRender);
    }
  }, [
    isReachable,
    currentCoordinate,
    handlePositionUpdate,
    convertCoordinates,
    setIsLoading,
    setSimulationStatus,
    showPlannedPath,
    showRealTimePath,
    clearPaths,
    simulationStatus, // 添加simulationStatus依赖
  ]);

  // 添加轨迹调试功能
  useEffect(() => {
    // 定期检查轨迹状态
    const checkInterval = setInterval(() => {
      if (simulationStatus === "flying") {
        // 调试输出轨迹状态
        scene.debugTrajectoryStatus();
      }
    }, 5000); // 每5秒检查一次

    return () => {
      clearInterval(checkInterval);
    };
  }, [simulationStatus, scene]);

  useEffect(() => {
    return () => {
      wsRef.current?.disconnect();
      // 清除标记点
      SceneManager.getInstance().removeObject("user-input-marker");
      // 确保组件卸载时关闭强制渲染模式
      SceneManager.getInstance().setForceRender(false);
      resetState(); // 组件卸载时重置状态
    };
  }, [resetState]);

  // 添加清除轨迹按钮
  const handleClearTrajectories = useCallback(() => {
    scene.clearTrajectories({ clearFlight: true, clearPlanned: true });
    safeMessage.success("轨迹已清除");
  }, []);

  return (
    <div className="flex flex-col gap-4 relative">
      <CoordinateInput value={coordinates} onChange={handleCoordinateChange} />
      <div className="flex gap-4">
        <Button
          type="primary"
          className="h-8 flex-1"
          onClick={handleSubmit}
          disabled={isLoading || !isReachable}
        >
          {simulationStatus === "idle"
            ? "提交坐标"
            : simulationStatus === "planning"
            ? "规划中..."
            : simulationStatus === "flying"
            ? "仿真中..."
            : "已完成"}
        </Button>
      </div>
      {/* 轨迹控制按钮 */}
      {(plannedPath.length > 0 || flightPath.length > 0) && (
        <Button
          type="default"
          danger
          className="h-8 text-xs mt-1"
          onClick={handleClearTrajectories}
        >
          清除轨迹
        </Button>
      )}
    </div>
  );
};
