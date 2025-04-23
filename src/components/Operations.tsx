import React, { useCallback, useEffect, useRef, useState } from "react";
import { InputNumber, Button, Form, Divider, Typography } from "antd";
import { SettingItem } from "@/types/settingItem";
import { ControlOutlined } from "@ant-design/icons";
import { SceneManager } from "@/core/SceneManager";
import { Vector3 } from "three";
import { debounce } from "lodash-es";

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
          min={-Infinity}
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

const useOperations = () => {
  const [coordinates, setCoordinates] = useState<CoordinateValue>({
    x: 0,
    y: 0,
    z: 0,
  });

  const debounceRef = useRef<{
    updateSceneMarker: (coords: CoordinateValue) => void;
  }>();

  // 坐标转换方法
  const convertCoordinates = useCallback((coords: CoordinateValue) => {
    return new Vector3(coords.x, coords.z, -coords.y);
  }, []);
  const updateSceneMarker = useCallback(
    (coords: CoordinateValue) => {
      const sceneManager = SceneManager.getInstance();
      sceneManager?.addMarker(convertCoordinates(coords), "user-input-marker");
    },
    [convertCoordinates]
  );
  const handleCoordinateChange = useCallback((newValue: CoordinateValue) => {
    setCoordinates(newValue);
    debounceRef.current?.updateSceneMarker(newValue);
  }, []);
  useEffect(() => {
    const debouncedUpdate = debounce(updateSceneMarker, DEBOUNCE_DELAY);
    debounceRef.current = {
      updateSceneMarker: debouncedUpdate,
    };

    return () => {
      debouncedUpdate.cancel(); // 清理防抖
    };
  }, [updateSceneMarker]);

  const handleSubmit = () => {
    console.log("当前坐标值：", coordinates);
    // 提交逻辑
  };

  const operations: SettingItem[] = [
    {
      id: "target-coordinates",
      title: "目标坐标",
      description: "设置无人机目标位置",
      renderControl: () => (
        <div className="flex flex-col gap-4">
          <CoordinateInput
            value={coordinates}
            onChange={handleCoordinateChange}
          />
          <div className="flex gap-4">
            <Button
              type="primary"
              ghost
              className="text-xs h-8 flex-1"
              onClick={() => console.log("场景选点逻辑")}
            >
              场景内选点
            </Button>
            <Button
              type="primary"
              className="h-8 flex-1"
              onClick={handleSubmit}
            >
              提交坐标
            </Button>
          </div>
        </div>
      ),
    },
  ];

  return {
    operations,
    coordinates,
    setCoordinates,
  };
};

// 操作卡片组件
const OperationCard: React.FC<SettingItem> = ({
  title,
  description,
  renderControl,
}) => (
  <div className="p-3 transition-all duration-300 rounded-lg hover:bg-white/5 border border-transparent hover:border-white/10">
    <div className="flex flex-col gap-2">
      <div className="text-white/80">{title}</div>
      <span className="text-white/60 text-xs">{description}</span>
      <div className="mt-2">{renderControl?.()}</div>
    </div>
  </div>
);

// 主组件
const Operations: React.FC = () => {
  const { operations } = useOperations();
  const sceneManager = SceneManager.getInstance();

  return (
    <div className="p-2 w-full">
      {operations.map((item, index) => (
        <React.Fragment key={item.id}>
          <OperationCard {...item} />
          {index !== operations.length - 1 && (
            <Divider className="!my-3 !border-white/10" />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

export default Operations;
