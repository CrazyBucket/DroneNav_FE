import React from "react";
import { Switch, Divider, Typography } from "antd";
import { useSettingStore } from "@/store/setting";
import type { SettingItem } from "@/types/settingItem";
import DroneSettings from "./DroneSettings";

// 配置项数据层
const useSettings = () => {
  const {
    showDebugView,
    setDebugView,
    showPlannedPath,
    showRealTimePath,
    setShowPlannedPath,
    setShowRealTimePath,
  } = useSettingStore();

  const settings: SettingItem[] = [
    {
      id: "debug-view",
      title: "调试视图",
      description: "显示辅助线",
      checked: showDebugView,
      onChange: setDebugView,
      renderControl: (checked, onChange) => (
        <Switch checked={checked} onChange={onChange} />
      ),
    },
    {
      id: "planned-path",
      title: "计划轨迹",
      description: "显示规划好的飞行路径",
      checked: showPlannedPath,
      onChange: setShowPlannedPath,
      renderControl: (checked, onChange) => (
        <Switch checked={checked} onChange={onChange} />
      ),
    },
    {
      id: "real-time-path",
      title: "实时轨迹",
      description: "显示无人机实际飞行路径",
      checked: showRealTimePath,
      onChange: setShowRealTimePath,
      renderControl: (checked, onChange) => (
        <Switch checked={checked} onChange={onChange} />
      ),
    },
  ];

  return { settings };
};

interface SettingCardProps extends SettingItem {
  className?: string;
}

const SettingCard: React.FC<SettingCardProps> = ({
  title,
  description,
  checked,
  onChange,
  renderControl,
  className,
}) => (
  <div
    className={`
      p-3 transition-all duration-300 rounded-lg
      hover:bg-white/5 cursor-pointer
      border border-transparent hover:border-white/10
      ${className}
    `}
  >
    <div className="flex items-center justify-between">
      <div className="flex-1">
        <div className="text-white/80">{title}</div>
        <span className="text-white/60 text-xs">{description}</span>
      </div>
      <div className="ml-2 flex items-center mb-0">
        {renderControl ? (
          renderControl(checked, onChange)
        ) : (
          <Switch checked={checked} onChange={onChange} />
        )}
      </div>
    </div>
  </div>
);

// 主组件
const Setting: React.FC = () => {
  const { settings } = useSettings();

  return (
    <div className="p-2 w-full">
      {settings.map((item, index) => (
        <React.Fragment key={item.id}>
          <SettingCard {...item} />
          {index !== settings.length - 1 && (
            <Divider className="!my-3 !border-white/10" />
          )}
        </React.Fragment>
      ))}

      <Divider className="!my-3 !border-white/10" />

      {/* 无人机设置部分 */}
      <DroneSettings />
    </div>
  );
};

export default Setting;
