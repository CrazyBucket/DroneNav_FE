import React, { useCallback, useEffect, useRef, useState } from "react";
import { InputNumber, Button, message, Spin, Modal } from "antd";
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
import { SimulationStatus } from "@/store/simulationState";

interface CoordinateValue {
  x: number;
  y: number;
  z: number;
}

const DEBOUNCE_DELAY = 500;

const useTrajectory = () => {
  const scene = SceneManager.getInstance();
  const [plannedPath, setPlannedPath] = useState<THREE.Vector3[]>([]);

  // 更新计划路径
  const updatePlanned = useCallback(
    (points: THREE.Vector3[]) => {
      setPlannedPath(points.map(p => p.clone()));
      scene.setPlannedPath(points.map(p => p.clone()));
      scene.setTrajectoryVisibility("planned", true);
      scene.requestRender();
    },
    [scene]
  );

  // 清除路径
  const clearPaths = useCallback(() => {
    setPlannedPath([]);
    scene.clearTrajectories({
      clearPlanned: true,
      clearFlight: true,
      clearWind: true,
    });
    scene.requestRender();
  }, [scene]);

  return { plannedPath, updatePlanned, clearPaths };
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
    currentSceneId,
  } = useSimulationStore();
  const {
    showPlannedPath,
    showRealTimePath,
    applyAllSettings,
    applyViewModes,
    droneSize,
    droneSpeed,
  } = useSettingStore();
  const wsRef = useRef<DroneWebSocket | null>(null);
  const scene = SceneManager.getInstance();
  const [totalPoints, setTotalPoints] = useState(0);
  const isPathInitializedRef = useRef(false);
  const plannedPathArrayRef = useRef<(THREE.Vector3 | null)[]>([]);
  const safeMessage = useSafeMessage();

  const { updatePlanned, clearPaths, plannedPath } = useTrajectory();

  // 添加引用来存储最后接收的位置和进度
  const lastProgressRef = useRef<{
    current: number;
    total: number;
  } | null>(null);

  const convertCoordinates = useCallback((coords: CoordinateValue) => {
    return new THREE.Vector3(coords.x, coords.z, coords.y);
  }, []);

  const handlePositionUpdate = useCallback(
    (data: any) => {
      // 确保数据有效
      if (!data || !data.coordinates) {
        return;
      }

      // 转换当前坐标
      const targetPos = convertCoordinates(data.coordinates);

      // 首次接收时初始化计划路径数组
      if (!isPathInitializedRef.current && data.progress?.total) {
        const total = data.progress.total;
        setTotalPoints(total);
        isPathInitializedRef.current = true;
        plannedPathArrayRef.current = Array(total).fill(null);
      }

      // 更新计划路径（虚线）
      if (isPathInitializedRef.current && data.progress?.current) {
        const currentIndex = data.progress.current - 1;
        plannedPathArrayRef.current[currentIndex] = targetPos.clone();

        // 过滤有效点
        const validPoints = plannedPathArrayRef.current.filter(
          (point): point is THREE.Vector3 => point !== null
        );

        try {
          // 更新计划路径
          updatePlanned(validPoints);

          // 更新无人机实际位置和轨迹
          // 注意：只使用一种方式更新实际轨迹
          scene.addPositionToQueue(targetPos);

          // 确保轨迹可见并渲染
          scene.setTrajectoryVisibility("flight", true);
          scene.forceRefreshAnimations();
          scene.requestRender();
        } catch (error) {
          if (Math.random() < 0.05) {
            console.error("[SetTarget] 更新轨迹失败:", error);
          }
        }
      }
    },
    [convertCoordinates, updatePlanned, scene]
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

  // 提交坐标
  const handleSubmit = useCallback(async () => {
    // 防止重复提交
    if (isLoading || !isReachable || !currentCoordinate) return;

    try {
      // 定义仿真逻辑函数
      const startSimulation = async () => {
        // 获取最新的场景ID - 确保使用当前选择的场景
        const currentSelectedSceneId =
          useSimulationStore.getState().currentSceneId;

        // 设置加载状态
        setIsLoading(true);
        setSimulationStatus("planning" as SimulationStatus);

        // 应用所有设置（无人机大小、速度等）
        applyAllSettings();

        // 应用视图模式（包括轨迹显示设置）
        applyViewModes();

        // 开启强制渲染，确保轨迹平滑显示
        scene.setForceRender(true);

        // 添加页面可见性监听，确保在页面切换焦点后继续强制渲染
        const enableForcedRender = () => {
          if (document.visibilityState === "visible") {
            scene.setForceRender(true);
          }
        };
        document.addEventListener("visibilitychange", enableForcedRender);

        // 设置无人机速度
        scene.setDroneSpeed(droneSpeed);

        // 配置API参数 - 确保场景ID字段正确设置
        const params = {
          current: currentCoordinate,
          target: coordinates,
          speed: droneSpeed,
          droneSize: droneSize,
          scene_id: currentSelectedSceneId || undefined,
        };

        // 详细记录API请求信息
        console.log(
          "[SetTarget] 开始请求路径规划, 参数:",
          JSON.stringify(params, null, 2)
        );
        console.log(
          `[SetTarget] 当前场景ID: ${
            currentSelectedSceneId || "未设置 (将使用默认场景)"
          }`
        );

        // 调用API之前再次确认场景ID
        console.log(
          `[SetTarget] API请求前确认场景ID: ${params.scene_id || "未设置"}`
        );

        // 调用API
        const response = await apis.startSimulation(params);

        // 请求后的详细日志
        console.log(
          `[SetTarget] 路径规划响应: ${response.status}, 任务ID: ${
            response.task_id
          }, 当前场景ID: ${currentSelectedSceneId || "默认"}`
        );

        // 储存临时状态
        const loadingState = {
          isFirstUpdate: true,
          loadingStartTime: Date.now(),
          hasReceivedPositionUpdate: false,
          minimumLoadingTime: 800, // 缩短最小加载时间
        };

        // 确保轨迹可见性
        scene.setTrajectoryVisibility("planned", showPlannedPath);
        scene.setTrajectoryVisibility("flight", showRealTimePath);

        // 正确设置持久性
        scene.setPersistent("planned-trajectory", true);
        scene.setPersistent("flight-trajectory", true);

        // 初始化实际飞行轨迹状态
        const initialPos = convertCoordinates(currentCoordinate!);
        console.log("[SetTarget] 初始化飞行轨迹，起点:", initialPos);

        // 将起点加入飞行轨迹
        scene.addPositionToQueue(initialPos);

        // 确保场景进行渲染
        scene.requestRender();
        scene.forceRefreshAnimations();

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

        // 设置模拟状态为飞行中
        setSimulationStatus("flying");

        // 设置连接超时与自动重连机制
        let reconnectCount = 0;
        const maxReconnects = 3;
        let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

        // 设置重连机制
        const setupReconnect = () => {
          if (reconnectTimeout) clearTimeout(reconnectTimeout);

          reconnectTimeout = setTimeout(() => {
            if (
              wsRef.current &&
              simulationStatus === ("flying" as SimulationStatus) &&
              reconnectCount < maxReconnects
            ) {
              console.log(
                `[SetTarget] 尝试重新连接 WebSocket (${
                  reconnectCount + 1
                }/${maxReconnects})`
              );
              reconnectCount++;

              // 尝试重新连接
              try {
                wsRef.current.disconnect();
                wsRef.current.connect();
                setupReconnect();
              } catch (err) {
                console.error("重连失败:", err);

                // 如果重连全部失败，进入完成状态以避免卡住
                if (reconnectCount >= maxReconnects) {
                  setSimulationStatus("completed");
                  safeMessage.info("连接已断开，显示已接收的路径");
                }
              }
            }
          }, 15000); // 15秒无反应就尝试重连
        };

        // 初始化重连机制
        setupReconnect();

        // 初始设置WS连接超时
        const initialConnectTimeout = setTimeout(() => {
          if (
            wsRef.current &&
            simulationStatus === ("planning" as SimulationStatus)
          ) {
            safeMessage.error("WebSocket连接超时，请检查网络和证书设置");
            setIsLoading(false);
            setSimulationStatus("idle");
            if (wsRef.current) wsRef.current.disconnect();
          }
        }, 10000);

        // 位置更新处理
        const handlePositionUpdateWrapper = (data: any) => {
          // 处理第一次位置更新，关闭加载状态
          if (loadingState.isFirstUpdate) {
            loadingState.isFirstUpdate = false;
            loadingState.hasReceivedPositionUpdate = true;
            setIsLoading(false);
            setupReconnect();
          }

          // 存储最新的进度信息
          if (data.progress) {
            lastProgressRef.current = data.progress;
          }

          // 存储最新的位置信息
          if (data.coordinates) {
            lastPositionRef.current = data.coordinates;
          }

          // 处理位置更新
          handlePositionUpdate(data);

          // 强制渲染以确保更新可见
          scene.forceRefreshAnimations();
          scene.requestRender();
        };

        // 注册事件处理程序
        if (wsRef.current) {
          // 位置更新事件
          wsRef.current.subscribe(
            "position_update",
            handlePositionUpdateWrapper
          );

          // 连接建立事件
          wsRef.current.subscribe("connected", () => {
            console.log("WebSocket 连接成功");
            safeMessage.success("路径规划连接已建立", 2);
            // 清除初始连接超时
            clearTimeout(initialConnectTimeout);
            // 重置重连计数器
            reconnectCount = 0;
            // 重置重连超时
            setupReconnect();
          });

          // 连接断开事件
          wsRef.current.subscribe("disconnected", data => {
            console.log("WebSocket 断开连接:", data);

            // 确保关闭加载状态
            setIsLoading(false);

            // 如果是正常断开或已完成则不显示警告
            if (
              data.reason &&
              simulationStatus !== ("completed" as SimulationStatus)
            ) {
              safeMessage.warning(`连接断开: ${data.reason}`, 3);

              // 如果有进度信息，且进度接近完成，可以认为模拟已基本完成
              if (
                lastProgressRef.current &&
                lastProgressRef.current.current > 0
              ) {
                const completion =
                  lastProgressRef.current.current /
                  lastProgressRef.current.total;
                if (completion > 0.85) {
                  // 如果已完成85%以上，视为已完成
                  setSimulationStatus("completed");
                  safeMessage.info("模拟基本完成，显示当前路径");

                  // 更新当前位置为最后接收到的位置
                  if (lastPositionRef.current) {
                    useCoordinatesStore.setState({
                      currentCoordinate: lastPositionRef.current,
                    });
                  }
                } else {
                  // 否则，设置为空闲状态
                  setSimulationStatus("idle");
                }
              } else {
                // 无进度信息，设置为空闲状态
                setSimulationStatus("idle");
              }

              // 移除标记点
              scene.removeObject("user-input-marker");
              // 完成后关闭强制渲染模式，但继续保持渲染
              scene.setForceRender(false);
              scene.requestRender();
            }
          });

          // 任务完成事件
          wsRef.current.subscribe("mission_complete", () => {
            console.log("任务完成事件触发");

            // 如果从未收到过位置更新，确保关闭加载状态
            if (loadingState.hasReceivedPositionUpdate === false) {
              setIsLoading(false);
            }

            safeMessage.success("仿真完成");
            setSimulationStatus("completed");

            // 清除所有超时定时器
            if (reconnectTimeout) clearTimeout(reconnectTimeout);
            clearTimeout(initialConnectTimeout);

            // 确保在任务完成后仍然可以看到轨迹
            setTimeout(() => {
              // 强制设置轨迹可见性
              scene.setTrajectoryVisibility("planned", true);
              scene.setTrajectoryVisibility("flight", true);

              // 更新起点为终点
              if (lastPositionRef.current) {
                useCoordinatesStore.setState({
                  currentCoordinate: lastPositionRef.current,
                });
              }
              // 移除标记点
              scene.removeObject("user-input-marker");
              // 完成后关闭强制渲染模式，但继续保持渲染
              scene.setForceRender(false);
              scene.requestRender();
              scene.forceRefreshAnimations();

              // 移除页面可见性监听
              document.removeEventListener(
                "visibilitychange",
                enableForcedRender
              );
            }, 500);
          });

          // 错误处理事件
          wsRef.current.subscribe("error", error => {
            console.error("WebSocket 错误:", error);
            safeMessage.error(`连接错误: ${error.message || "未知错误"}`);

            // 确保关闭加载状态
            setIsLoading(false);

            // 如果是WSS证书问题，显示具体提示
            if (error.code === "CONNECTION_ERROR") {
              safeMessage.warning("请确保已接受WSS安全证书");
            }
          });

          // 尝试建立连接
          wsRef.current.connect();
        }
      };

      // 如果已经在模拟中，使用Modal询问是否要重新开始
      if (simulationStatus !== ("idle" as SimulationStatus)) {
        const startNewSimulation = () => {
          // 重置状态
          resetState();

          // 重置所有轨迹相关的状态
          isPathInitializedRef.current = false;
          plannedPathArrayRef.current = [];
          setTotalPoints(0);
          lastProgressRef.current = null;

          // 清除现有轨迹
          clearPaths();

          // 确保场景中的轨迹对象被完全清除
          scene.clearTrajectories({
            clearFlight: true,
            clearPlanned: true,
            clearWind: true,
          });

          // 强制刷新场景
          scene.forceRefreshAnimations();
          scene.requestRender();

          // 继续执行仿真逻辑
          startSimulation();
        };

        Modal.confirm({
          title: "重新开始仿真",
          content: "当前仿真尚未完成，重新开始将清除当前的轨迹。是否继续？",
          okText: "继续",
          cancelText: "取消",
          onOk: startNewSimulation,
          okButtonProps: {
            className: "bg-blue-500",
          },
        });
        return;
      }

      // 如果是第一次仿真，直接开始
      if (simulationStatus === ("idle" as SimulationStatus)) {
        await startSimulation();
      }
    } catch (error) {
      console.error("提交失败:", error);
      safeMessage.error("提交失败，请检查网络和证书设置");
    }
  }, [
    isReachable,
    currentCoordinate,
    coordinates,
    handlePositionUpdate,
    convertCoordinates,
    resetState,
    setIsLoading,
    setSimulationStatus,
    clearPaths,
    simulationStatus,
    applyAllSettings,
    applyViewModes,
    showPlannedPath,
    showRealTimePath,
    droneSize,
    droneSpeed,
    scene,
    currentSceneId,
  ]);

  // 添加轨迹调试功能
  useEffect(() => {
    // 定期检查轨迹状态
    const checkInterval = setInterval(() => {
      if (simulationStatus === ("flying" as SimulationStatus)) {
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
      // 清除位置队列
      SceneManager.getInstance().clearPositionQueue();
      // 确保组件卸载时关闭强制渲染模式
      SceneManager.getInstance().setForceRender(false);
      resetState(); // 组件卸载时重置状态
    };
  }, [resetState]);

  const handleClearTrajectories = useCallback(() => {
    scene.clearTrajectories({
      clearFlight: true,
      clearPlanned: true,
      clearWind: true,
    });
    safeMessage.success("轨迹已清除");
  }, [scene, safeMessage]);

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
          {simulationStatus === ("idle" as SimulationStatus)
            ? "开始仿真"
            : simulationStatus === ("planning" as SimulationStatus)
            ? "规划中..."
            : simulationStatus === ("flying" as SimulationStatus)
            ? "仿真中..."
            : "继续仿真"}
        </Button>
      </div>
      {/* 轨迹控制按钮 */}
      {plannedPath.length > 0 && (
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
