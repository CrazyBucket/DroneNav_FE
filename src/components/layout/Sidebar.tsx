import React, { useState } from "react";
import { Button } from "antd";
import {
  AppstoreOutlined,
  SettingOutlined,
  ControlOutlined,
} from "@ant-design/icons";

// 定义功能区类型
type FunctionArea = "views" | "settings" | "controls";

interface SidebarProps {
  className?: string;
}

const Sidebar: React.FC<SidebarProps> = ({ className }) => {
  const [activeArea, setActiveArea] = useState<FunctionArea>("views");

  // 导航按钮配置
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

  // 渲染功能区内容
  const renderContent = () => {
    switch (activeArea) {
      case "views":
        return <div className="p-4">视图管理区域</div>;
      case "settings":
        return <div className="p-4">系统设置区域</div>;
      case "controls":
        return <div className="p-4">操作面板区域</div>;
    }
  };

  return (
    <div className={`h-full flex ${className}`}>
      {/* 左侧导航区 */}
      <div className="w-14 bg-white border-r border-gray-200 flex flex-col items-center py-2 gap-4">
        {navButtons.map(({ key, icon, title }) => (
          <Button
            key={key}
            type="text"
            icon={icon}
            className={`h-10 flex items-center justify-center ${
              activeArea === key
                ? "bg-blue-100 text-blue-600"
                : "hover:bg-gray-100"
            }`}
            style={{ width: "36px" }}
            onClick={() => setActiveArea(key as FunctionArea)}
            title={title}
          />
        ))}
      </div>

      {/* 右侧功能区 */}
      <div className="flex-1 bg-white flex flex-col">
        <div className="h-12 border-b border-gray-200 flex items-center px-4">
          {navButtons.find(btn => btn.key === activeArea)?.title}
        </div>
        {renderContent()}
      </div>
    </div>
  );
};

export default Sidebar;
