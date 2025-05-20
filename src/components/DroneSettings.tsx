import React, { useState } from "react";
import {
  Slider,
  Switch,
  InputNumber,
  Typography,
  Divider,
  Tooltip,
  Select,
  Space,
} from "antd";
import { useSettingStore } from "@/store/setting";
import { InfoCircleOutlined, CompassOutlined } from "@ant-design/icons";

const { Text } = Typography;
const { Option } = Select;

interface DroneSettingsProps {
  collapsed?: boolean;
}

// 风向选项
const windDirections = [
  { label: "东风", value: "east", vector: { x: 1, y: 0, z: 0 } }, // 从东向西吹
  { label: "西风", value: "west", vector: { x: -1, y: 0, z: 0 } }, // 从西向东吹
  { label: "南风", value: "south", vector: { x: 0, y: 0, z: 1 } }, // 从南向北吹
  { label: "北风", value: "north", vector: { x: 0, y: 0, z: -1 } }, // 从北向南吹
  { label: "东北风", value: "northeast", vector: { x: 0.7, y: 0, z: -0.7 } },
  { label: "西北风", value: "northwest", vector: { x: -0.7, y: 0, z: -0.7 } },
  { label: "东南风", value: "southeast", vector: { x: 0.7, y: 0, z: 0.7 } },
  { label: "西南风", value: "southwest", vector: { x: -0.7, y: 0, z: 0.7 } },
  { label: "上升气流", value: "updraft", vector: { x: 0, y: 1, z: 0 } }, // 从下向上吹
  { label: "下沉气流", value: "downdraft", vector: { x: 0, y: -1, z: 0 } }, // 从上向下吹
  { label: "自定义", value: "custom", vector: { x: 1, y: 0, z: 0 } }, // 自定义风向
];

// 设置项组件
const SettingCard: React.FC<{
  title: string;
  description: string;
  children: React.ReactNode;
  className?: string;
  tooltip?: string;
}> = ({ title, description, children, className, tooltip }) => (
  <div
    className={`
      p-3 transition-all duration-300 rounded-lg
      hover:bg-white/5 cursor-pointer
      border border-transparent hover:border-white/10
      ${className || ""}
    `}
  >
    <div className="flex items-center justify-between">
      <div className="flex-1">
        <div className="text-white/80 flex items-center">
          {title}
          {tooltip && (
            <Tooltip title={tooltip} placement="topLeft">
              <InfoCircleOutlined className="ml-1 text-white/60 text-xs" />
            </Tooltip>
          )}
        </div>
        <span className="text-white/60 text-xs">{description}</span>
      </div>
      <div className="ml-2 flex items-center mb-0">{children}</div>
    </div>
  </div>
);

// 带滑块的设置项
const SliderSettingCard: React.FC<{
  title: string;
  description: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  className?: string;
  tooltip?: string;
  unit?: string;
}> = ({
  title,
  description,
  value,
  min,
  max,
  step,
  onChange,
  className,
  tooltip,
  unit,
}) => (
  <div className={`${className || ""}`}>
    <SettingCard title={title} description={description} tooltip={tooltip}>
      <div className="flex items-center w-32">
        <Slider
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={onChange}
          className="flex-1 mr-2"
        />
        <InputNumber
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={v => v !== null && onChange(v)}
          style={{ width: 60 }}
          size="small"
          suffix={unit}
          className="bg-transparent text-white/80 border-white/20"
        />
      </div>
    </SettingCard>
  </div>
);

const DroneSettings: React.FC<DroneSettingsProps> = ({ collapsed = false }) => {
  const {
    droneSize,
    droneSpeed,
    followDroneView,
    firstPersonView,
    gravityEffect,
    windEffect,
    windDirection,
    setDroneSize,
    setDroneSpeed,
    setFollowDroneView,
    setFirstPersonView,
    setGravityEffect,
    setWindEffect,
    setWindDirection,
  } = useSettingStore();

  // 添加风向选择状态
  const [selectedDirection, setSelectedDirection] = useState<string>(() => {
    // 检查当前风向是否匹配预设风向
    for (const dir of windDirections) {
      if (
        Math.abs(dir.vector.x - windDirection.x) < 0.1 &&
        Math.abs(dir.vector.y - windDirection.y) < 0.1 &&
        Math.abs(dir.vector.z - windDirection.z) < 0.1
      ) {
        return dir.value;
      }
    }
    return "custom"; // 如果不匹配预设，使用自定义
  });

  // 处理风向变化
  const handleWindDirectionChange = (value: string) => {
    setSelectedDirection(value);

    // 查找选定的风向向量
    const direction = windDirections.find(dir => dir.value === value);
    if (direction) {
      setWindDirection(direction.vector);
    }
  };

  // 默认尺寸（米转厘米）
  const defaultSize = {
    width: 50,
    height: 12,
    depth: 40,
  };

  // 若组件处于折叠状态，则不显示具体选项
  if (collapsed) {
    return null;
  }

  // 处理无人机尺寸变更（接收厘米值，转换为米存储）
  const handleSizeChange = (
    dimension: "width" | "height" | "depth",
    valueCm: number
  ) => {
    // 厘米转米
    const valueM = valueCm / 100;

    // 更新无人机尺寸
    setDroneSize({
      ...droneSize,
      [dimension]: valueM,
    });
  };

  // 将米转换为厘米用于显示
  const getDroneSizeCm = (dimension: "width" | "height" | "depth"): number => {
    return Math.round(droneSize[dimension] * 100);
  };

  return (
    <div>
      <Text className="text-white/80 font-medium">无人机设置</Text>

      <SettingCard
        title="飞行速度"
        description="调整无人机的飞行速度"
        className="mt-2"
        tooltip="更高的速度会使无人机移动更快，但可能会降低准确性"
      >
        <div className="flex items-center w-32">
          <Slider
            min={0.5}
            max={3}
            step={0.1}
            value={droneSpeed}
            onChange={setDroneSpeed}
            className="flex-1 mr-2"
          />
          <InputNumber
            min={0.5}
            max={3}
            step={0.1}
            value={droneSpeed}
            onChange={v => v !== null && setDroneSpeed(v)}
            style={{ width: 60 }}
            size="small"
            className="bg-transparent text-white/80 border-white/20"
            suffix="倍"
          />
        </div>
      </SettingCard>

      <Divider className="!my-3 !border-white/10" />

      <Text className="text-white/80 font-medium">视角控制</Text>

      <SettingCard
        title="第一人称视角"
        description="使用无人机摄像头向前看的视角"
        className="mt-2"
        tooltip="启用后将从无人机位置向前方看，无法看到无人机本身"
      >
        <Switch checked={firstPersonView} onChange={setFirstPersonView} />
      </SettingCard>

      <SettingCard
        title="跟随视角"
        description="让相机跟随无人机移动"
        className="mt-2"
        tooltip="启用后相机将跟随无人机移动，但仍然可以看到无人机"
      >
        <Switch
          checked={followDroneView}
          onChange={setFollowDroneView}
          disabled={firstPersonView} // 第一人称视角开启时禁用
        />
      </SettingCard>

      <Divider className="!my-3 !border-white/10" />

      <Text className="text-white/80 font-medium">物理效果</Text>

      <SettingCard
        title="重力影响"
        description="考虑重力对无人机飞行的影响"
        className="mt-2"
        tooltip="启用后无人机会模拟重力影响，更加真实但可能更难控制"
      >
        <Switch checked={gravityEffect} onChange={setGravityEffect} />
      </SettingCard>

      <SettingCard
        title="风力影响"
        description="模拟风对无人机的影响"
        className="mt-2"
        tooltip="启用后环境会有风力，对飞行轨迹产生影响"
      >
        <Switch
          checked={windEffect > 0}
          onChange={checked => setWindEffect(checked ? 1 : 0)}
        />
      </SettingCard>

      {windEffect > 0 && (
        <>
          <SliderSettingCard
            title="风力强度"
            description="调整风对无人机的影响程度"
            value={windEffect}
            min={0}
            max={10}
            step={0.5}
            onChange={setWindEffect}
            className="mt-2 ml-4"
            unit="级"
            tooltip="数值越大，风对无人机飞行的影响越明显"
          />

          <SettingCard
            title="风向"
            description="设置风的方向"
            className="mt-2 ml-4"
            tooltip="不同风向将从不同方向吹向无人机"
          >
            <Select
              value={selectedDirection}
              onChange={handleWindDirectionChange}
              style={{ width: 120 }}
              dropdownStyle={{ background: "#1a2233" }}
              size="small"
              className="bg-transparent text-white/80 border-white/20"
              suffixIcon={
                <CompassOutlined style={{ color: "rgba(255,255,255,0.6)" }} />
              }
            >
              {windDirections.map(dir => (
                <Option key={dir.value} value={dir.value}>
                  {dir.label}
                </Option>
              ))}
            </Select>
          </SettingCard>

          {selectedDirection === "custom" && (
            <div className="mt-2 ml-8 bg-white/5 p-2 rounded-md">
              <Text className="text-white/70 text-xs">自定义风向向量</Text>
              <Space className="mt-1">
                <InputNumber
                  size="small"
                  min={-1}
                  max={1}
                  step={0.1}
                  value={windDirection.x}
                  onChange={v =>
                    setWindDirection({ ...windDirection, x: v || 0 })
                  }
                  className="bg-transparent !w-16 text-white/80 border-white/20"
                  addonBefore="X"
                />
                <InputNumber
                  size="small"
                  min={-1}
                  max={1}
                  step={0.1}
                  value={windDirection.y}
                  onChange={v =>
                    setWindDirection({ ...windDirection, y: v || 0 })
                  }
                  className="bg-transparent !w-16 text-white/80 border-white/20"
                  addonBefore="Y"
                />
                <InputNumber
                  size="small"
                  min={-1}
                  max={1}
                  step={0.1}
                  value={windDirection.z}
                  onChange={v =>
                    setWindDirection({ ...windDirection, z: v || 0 })
                  }
                  className="bg-transparent !w-16 text-white/80 border-white/20"
                  addonBefore="Z"
                />
              </Space>
            </div>
          )}
        </>
      )}

      <Divider className="!my-3 !border-white/10" />

      <Text className="text-white/80 font-medium">无人机尺寸（碰撞体积）</Text>

      <SliderSettingCard
        title="宽度"
        description="无人机宽度"
        value={getDroneSizeCm("width")}
        min={5}
        max={defaultSize.width * 3} // 最大为默认值的3倍
        step={1}
        onChange={v => handleSizeChange("width", v)}
        className="mt-2"
        unit="cm"
        tooltip="影响碰撞检测的宽度，较大的值会使无人机更难穿过狭窄空间"
      />

      <SliderSettingCard
        title="高度"
        description="无人机高度"
        value={getDroneSizeCm("height")}
        min={1}
        max={defaultSize.height * 3} // 最大为默认值的3倍
        step={1}
        onChange={v => handleSizeChange("height", v)}
        className="mt-2"
        unit="cm"
        tooltip="影响碰撞检测的高度，较大的值需要更高的飞行高度避开障碍物"
      />

      <SliderSettingCard
        title="深度"
        description="无人机深度"
        value={getDroneSizeCm("depth")}
        min={5}
        max={defaultSize.depth * 3} // 最大为默认值的3倍
        step={1}
        onChange={v => handleSizeChange("depth", v)}
        className="mt-2"
        unit="cm"
        tooltip="影响碰撞检测的深度，较大的值会使无人机更难穿过狭窄空间"
      />
    </div>
  );
};

export default DroneSettings;
