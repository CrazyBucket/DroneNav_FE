import React, { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "antd";
import {
  AppstoreOutlined,
  SettingOutlined,
  ControlOutlined,
  SecurityScanOutlined,
  LeftOutlined,
} from "@ant-design/icons";
import clsx from "clsx";
import "./index.css";
import { MIN_RIGHT_PANE_WIDTH } from "@/store/state";
import Setting from "@/components/Setting";
import Operations from "@/components/Operations";
import SceneSelector from "@/components/SceneSelector";
import SecurityMonitor from "@/components/SecurityMonitor";
import { useSettingStore } from "@/store/setting";
import { RenderHandle } from "@/components/Render/Render";

type FunctionArea = "views" | "settings" | "controls" | "security";

interface SidebarProps {
  className?: string;
  onCollapse?: (collapsed: boolean) => void;
  collapsed?: boolean;
  scene: any;
  renderRef?: React.RefObject<RenderHandle>;
}

const Sidebar: React.FC<SidebarProps> = ({
  className,
  onCollapse,
  collapsed,
  scene,
  renderRef,
}) => {
  const [activeArea, setActiveArea] = useState<FunctionArea>("views");
  const { showPlannedPath, showRealTimePath } = useSettingStore();
  const previousCollapsedRef = useRef(collapsed);

  // 使用useEffect监听场景轨迹可见性变化
  useEffect(() => {
    if (!scene) return;

    // 只有当场景存在时才应用轨迹可见性设置
    scene.setTrajectoryVisibility("planned", showPlannedPath);
    scene.setTrajectoryVisibility("flight", showRealTimePath);

    // 请求一次渲染以更新显示
    scene.requestRender();
  }, [showPlannedPath, showRealTimePath, scene]);

  // 监听折叠状态变化
  useEffect(() => {
    // 避免首次渲染时触发
    if (previousCollapsedRef.current !== collapsed) {
      // 延迟更新场景大小，等待侧边栏动画完成
      const timer = setTimeout(() => {
        const container = document.getElementById("scene-container");
        if (container) {
          // 无论renderRef.current是否存在，都记录宽高
          const width = container.clientWidth;
          const height = container.clientHeight;
          console.log(
            `侧边栏状态变化，容器尺寸: ${width}x${height}, renderRef存在: ${!!renderRef?.current}`
          );

          // 尝试调用resize方法，即使当前renderRef.current为null
          if (renderRef?.current) {
            renderRef.current.resize(width, height, true); // 使用immediate参数
          } else {
            console.warn("Sidebar: renderRef.current为null，无法调整大小");
            // 记录DOM元素信息以便调试
            console.log("scene-container元素:", container);
          }
        } else {
          console.error("找不到scene-container元素");
        }
      }, 350); // 等待动画完成

      return () => clearTimeout(timer);
    }

    // 更新ref值以便下次比较
    previousCollapsedRef.current = collapsed;
  }, [collapsed, renderRef]);

  // 处理面板折叠逻辑
  const handleCollapseClick = useCallback(() => {
    if (onCollapse) {
      // 短暂延迟处理以避免事件冲突
      setTimeout(() => {
        onCollapse(!collapsed);
      }, 0);
    }
  }, [onCollapse, collapsed]);

  const navButtons = [
    {
      key: "views",
      icon: <AppstoreOutlined />,
      title: "场景选择",
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
    {
      key: "security",
      icon: <SecurityScanOutlined />,
      title: "安全监控",
    },
  ];

  const renderContent = () => {
    return (
      <div className="text-white/80">
        {activeArea === "views" && <SceneSelector renderRef={renderRef} />}
        {activeArea === "settings" && <Setting />}
        {activeArea === "controls" && <Operations />}
        {activeArea === "security" && <SecurityMonitor />}
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
          onClick={handleCollapseClick}
        />
      </div>

      {/* 右侧功能区 - 使用pointer-events-none防止过渡动画期间的交互 */}
      <div
        className={clsx(
          "flex flex-col",
          "rounded-xl backdrop-blur-md bg-white/10 border border-gray-600/50",
          "shadow-lg shadow-black/10",
          "transition-all duration-300 ease-out",
          "overflow-hidden",
          collapsed
            ? "w-0 opacity-0 ml-[-16px] pointer-events-none"
            : "flex-1 opacity-100"
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
