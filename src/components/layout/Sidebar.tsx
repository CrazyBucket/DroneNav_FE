import React, { useRef, useState } from "react";
import { Button } from "antd";
import {
  AppstoreOutlined,
  SettingOutlined,
  ControlOutlined,
  LeftOutlined,
} from "@ant-design/icons";
import clsx from "clsx";
import "./index.css";
import { MIN_RIGHT_PANE_WIDTH } from "@/store/state";
import Setting from "@/components/Setting";

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
      <div className="text-white/80">
        {activeArea === "views" && <div className="p-4">视图管理区域</div>}
        {activeArea === "settings" && <Setting />}
        {activeArea === "controls" && <div className="p-4">操作面板区域</div>}
      </div>
    );
  };

  return (
    <div className={`flex h-full p-2 ${className}`}>
      {/* 左侧导航区 */}
      <div className="w-14 flex-shrink-0 backdrop-blur-md bg-white/10 border border-gray-600/50 rounded-xl flex flex-col items-center py-2 gap-4 mr-2 shadow-lg shadow-black/10">
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
              "h-10 w-10 flex items-center justify-center transition-all",
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
            <LeftOutlined
              style={{
                color: "rgba(255,255,255,0.8)",
                fontSize: "16px",
                transition: "transform 0.3s",
                transform: `rotate(${collapsed ? 180 : 0}deg)`,
                transformOrigin: "center",
              }}
            />
          }
          className="mt-auto h-10 flex items-center justify-center transition-all hover:bg-white/15"
          style={{ width: "36px" }}
          onClick={() => onCollapse?.(!collapsed)}
        />
      </div>

      {/* 右侧功能区 */}
      <div
        className={clsx(
          "flex flex-col",
          "rounded-xl backdrop-blur-md bg-white/10 border border-gray-600/50",
          "shadow-lg shadow-black/10",
          "transition-all duration-300 ease-out",
          "overflow-hidden",
          collapsed ? "w-0 opacity-0 ml-[-16px]" : "flex-1 opacity-100"
        )}
        style={{
          minWidth: collapsed ? 0 : `${MIN_RIGHT_PANE_WIDTH}px`,
          willChange: "width, opacity, margin",
        }}
      >
        <div className="min-w-[280px] h-full flex flex-col">
          <div className="h-12 border-b border-gray-600/50 flex items-center px-4 text-white/90 font-medium">
            {navButtons.find(btn => btn.key === activeArea)?.title}
          </div>
          <div className="flex-1 overflow-auto">{renderContent()}</div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
