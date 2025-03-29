import React, { useRef, useState } from "react";
import { Button } from "antd";
import {
  AppstoreOutlined,
  SettingOutlined,
  ControlOutlined,
  LeftOutlined,
  RightOutlined,
} from "@ant-design/icons";
import clsx from "clsx";
import "./index.css";

type FunctionArea = "views" | "settings" | "controls";

interface SidebarProps {
  className?: string;
  onCollapse?: (collapsed: boolean) => void;
  collapsed?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({
  className,
  onCollapse,
  collapsed,
}) => {
  const [activeArea, setActiveArea] = useState<FunctionArea>("views");
  const containerRef = useRef<HTMLDivElement>(null);
  const [panelWidth, setPanelWidth] = useState("100%");

  const navButtons = [
    {
      key: "views",
      icon: <AppstoreOutlined />,
      title: "视图管理",
    },
    {
      key: "settings",
      icon: <SettingOutlined />,
      title: "系统设置",
    },
    {
      key: "controls",
      icon: <ControlOutlined />,
      title: "操作面板",
    },
  ];

  const renderContent = () => {
    return (
      <div className="p-4 text-white/80">
        {activeArea === "views" && "视图管理区域"}
        {activeArea === "settings" && "系统设置区域"}
        {activeArea === "controls" && "操作面板区域"}
      </div>
    );
  };

  return (
    <div className={`flex h-full p-2 ${className}`}>
      {/* 左侧导航区 */}
      <div className="w-14 backdrop-blur-md bg-white/10 border border-gray-600/50 rounded-xl flex flex-col items-center py-2 gap-4 mr-2 shadow-lg shadow-black/10">
        {navButtons.map(({ key, icon, title }) => (
          <Button
            key={key}
            type="text"
            icon={React.cloneElement(icon, {
              className: "transition-transform duration-300 hover:scale-120",
              style: {
                color:
                  activeArea === key
                    ? "rgba(255,255,255,0.9)"
                    : "rgba(255,255,255,0.7)",
              },
            })}
            className={clsx(
              "h-10 flex items-center justify-center transition-all",
              activeArea === key
                ? "!bg-white/20 backdrop-blur-sm hover:!bg-white/20"
                : "hover:!bg-white/15"
            )}
            style={{ width: "36px" }}
            onClick={() => setActiveArea(key as FunctionArea)}
            title={title}
          />
        ))}
        <Button
          type="text"
          icon={
            collapsed ? (
              <RightOutlined
                style={{
                  color: "rgba(255,255,255,0.8)",
                  fontSize: "16px",
                  transition: "all 0.3s",
                }}
              />
            ) : (
              <LeftOutlined
                style={{
                  color: "rgba(255,255,255,0.8)",
                  fontSize: "16px",
                  transition: "all 0.3s",
                }}
              />
            )
          }
          className="mt-auto h-10 flex items-center justify-center transition-all hover:bg-white/15"
          style={{ width: "36px" }}
          onClick={() => onCollapse?.(!collapsed)}
        />
      </div>

      {/* 右侧功能区 */}
      <div
        className={clsx(
          "sidebar-content", // 添加动画类
          "rounded-xl backdrop-blur-md bg-white/10 border border-gray-600/50",
          "flex flex-col shadow-lg shadow-black/10",
          collapsed ? "w-0 opacity-0 ml-[-16px]" : "flex-1 opacity-100"
        )}
      >
        <div className="h-12 border-b border-gray-600/50 flex items-center px-4 text-white/90 font-medium">
          {navButtons.find(btn => btn.key === activeArea)?.title}
        </div>
        {renderContent()}
      </div>
    </div>
  );
};

export default Sidebar;
