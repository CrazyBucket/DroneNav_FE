import React, { useCallback, useRef, useState } from "react";
import { InputNumber, Button, message } from "antd";
import { Vector3 } from "three";
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

  const convertCoordinates = useCallback((coords: CoordinateValue) => {
    return new Vector3(coords.x, coords.z, -coords.y);
  }, []);

  const updateSceneMarker = useCallback(
    (coords: CoordinateValue) => {
      const sceneManager = SceneManager.getInstance();
      if (!sceneManager) return;

      const threePosition = convertCoordinates(coords);
      const reachable = sceneManager.addMarker(
        threePosition,
        "user-input-marker"
      );
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

  const handleSubmit = useCallback(async (): Promise<() => void> => {
    if (!isReachable) {
      message.error("当前位置不可达，无法提交");
      return () => {};
    }
    try {
      if (currentCoordinate) {
        try {
          const { ws_endpoint } = await apis.startSimulation({
            current: currentCoordinate,
            target: lastPositionRef.current,
          });

          const ws = new DroneWebSocket({
            url: `ws://localhost:8000${ws_endpoint}`,
          });

          ws.connect();
          // 订阅关键事件
          ws.subscribe("connected", data => {
            console.log("连接成功，任务ID:", data.taskId);
            message.success("仿真任务已开始");
          });

          const cleanup = ws.subscribe("position_update", data => {
            console.log("位置更新:", data);
            // 更新前端状态或动画...
          });

          ws.subscribe("error", err => {
            message.error(`发生错误: ${err.message}`);
          });

          return () => {
            cleanup();
            ws.disconnect();
          };
        } catch (error) {
          message.error("提交坐标失败，请重试");
          return () => {};
        }
      }
      return () => {};
    } catch (error) {
      message.error("提交坐标失败，请重试");
      return () => {};
    }
  }, [isReachable]);

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
