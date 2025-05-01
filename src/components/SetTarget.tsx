import React, { useCallback, useEffect, useRef, useState } from "react";
import { InputNumber, Button, message } from "antd";
import * as THREE from "three";
import { debounce } from "lodash-es";
import { SceneManager } from "@/core/SceneManager";
import { apis } from "@/services/api";
import { DroneWebSocket } from "@/services/ws";
import { useCoordinatesStore } from "@/store/coordinates";

interface CoordinateValue {
  x: number;
  y: number;
  z: number;
}

const DEBOUNCE_DELAY = 500;

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
  const [flightPath, setFlightPath] = useState<THREE.Vector3[]>([]);
  const [isFlying, setIsFlying] = useState(false);
  const wsRef = useRef<DroneWebSocket | null>(null);
  const scene = SceneManager.getInstance();
  const convertCoordinates = useCallback((coords: CoordinateValue) => {
    return new THREE.Vector3(coords.x, coords.z, coords.y);
  }, []);

  const renderTrajectory = useCallback((path: THREE.Vector3[]) => {
    scene.removeObject("flight-trajectory"); // 清理旧路径

    const geometry = new THREE.BufferGeometry().setFromPoints(path);
    const material = new THREE.LineDashedMaterial({
      color: 0x00ff00,
      dashSize: 0.5,
      gapSize: 0.2,
    });

    const line = new THREE.Line(geometry, material);
    line.computeLineDistances();

    scene.addObject({
      id: "flight-trajectory",
      object: line,
      selectable: false,
      static: true,
    });
  }, []);

  const handlePositionUpdate = useCallback(
    (data: any) => {
      console.log("收到位置更新:", data); // 添加调试日志
      const targetPos = convertCoordinates(data.coordinates);
      console.log("转换后坐标:", targetPos); // 确认坐标转换正确

      // 更新无人机位置
      scene.smartAnimate("drone-model", targetPos, {
        duration: 0.5,
        lookAtTarget: true,
        addToQueue: true,
      });

      // 更新轨迹路径
      setFlightPath(prev => {
        const newPath = [...prev, targetPos];
        if (newPath.length > 1) renderTrajectory(newPath);
        return newPath;
      });
    },
    [convertCoordinates, renderTrajectory]
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
    if (!isReachable) {
      message.error("当前位置不可达，无法提交");
      return;
    }

    try {
      setIsFlying(true);
      const { ws_endpoint } = await apis.startSimulation({
        current: currentCoordinate!,
        target: lastPositionRef.current,
      });

      // 初始化WebSocket
      wsRef.current = new DroneWebSocket({
        url: `ws://localhost:8000${ws_endpoint}`,
      });

      // 事件订阅
      wsRef.current.subscribe("position_update", handlePositionUpdate);
      wsRef.current.subscribe("mission_complete", () => {
        message.success("路径规划完成");
        setIsFlying(false);
      });

      wsRef.current.connect();

      // 初始化轨迹
      const initialPos = convertCoordinates(currentCoordinate!);
      const drone = scene.getObject("drone-model");
      setFlightPath([initialPos]);
    } catch (err) {
      message.error("任务启动失败: " + (err as Error).message);
      setIsFlying(false);
    }
  }, [
    isReachable,
    currentCoordinate,
    handlePositionUpdate,
    convertCoordinates,
  ]);

  useEffect(() => {
    return () => {
      wsRef.current?.disconnect();
      SceneManager.getInstance().removeObject("flight-trajectory");
    };
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <CoordinateInput value={coordinates} onChange={handleCoordinateChange} />
      <div className="flex gap-4">
        <Button
          type="primary"
          ghost
          className="text-xs h-8 flex-1"
          onClick={() => console.log("场景选点逻辑")}
        >
          场景内选点
        </Button>
        <Button type="primary" className="h-8 flex-1" onClick={handleSubmit}>
          提交坐标
        </Button>
      </div>
    </div>
  );
};
