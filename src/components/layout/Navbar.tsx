import React, { useState } from "react";
import { Dropdown, Avatar, Space, Button, Tooltip } from "antd";
import {
  UserOutlined,
  LogoutOutlined,
  SettingOutlined,
  SafetyOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import type { MenuProps } from "antd";
import "./index.css";

const Navbar: React.FC = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [showSecurityInfo, setShowSecurityInfo] = useState(false);

  // 处理退出登录
  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  // 获取用户首字母
  const getUserInitial = () => {
    return user?.username ? user.username.charAt(0).toUpperCase() : "?";
  };

  // 获取角色中文名称
  const getRoleName = () => {
    switch (user?.role) {
      case "admin":
        return "管理员";
      case "user":
        return "普通用户";
      default:
        return "未知角色";
    }
  };

  // 下拉菜单项
  const dropdownItems: MenuProps["items"] = [
    {
      key: "profile",
      label: (
        <div className="py-2 px-1 min-w-[120px]">
          <div className="font-bold text-white">
            {user?.username || "未登录"}
          </div>
          <div className="text-xs text-gray-400">{user?.email}</div>
          <div className="text-xs mt-1 bg-green-900/30 text-green-400 rounded px-2 py-0.5 inline-block">
            {getRoleName()}
          </div>
        </div>
      ),
      disabled: true,
    },
    {
      type: "divider",
    },
    {
      key: "settings",
      label: "账号设置",
      icon: <SettingOutlined />,
    },
    {
      key: "security",
      label: "安全信息",
      icon: <SafetyOutlined />,
      onClick: () => setShowSecurityInfo(!showSecurityInfo),
    },
    {
      type: "divider",
    },
    {
      key: "logout",
      label: "退出登录",
      icon: <LogoutOutlined />,
      onClick: handleLogout,
      danger: true,
    },
  ];

  return (
    <header className="nav-header h-[48px] backdrop-blur-md bg-white/10 border border-gray-600/50 text-white p-4 mx-2 mt-2 flex items-center justify-between rounded-xl transition-all duration-300 shadow-lg shadow-black/10 overflow-hidden hover:border-emerald-400/30 group">
      <span className="text-xl font-bold text-white/90 tracking-wider relative z-10">
        DroneNav
      </span>

      {/* 用户信息 */}
      <div className="flex items-center gap-2 z-10">
        {showSecurityInfo && (
          <Tooltip title="设备指纹已启用，安全连接已建立">
            <Button
              type="text"
              icon={<SafetyOutlined />}
              className="text-green-400 hover:text-green-300"
              size="small"
            />
          </Tooltip>
        )}

        <Dropdown
          menu={{ items: dropdownItems }}
          trigger={["click"]}
          placement="bottomRight"
        >
          <a onClick={e => e.preventDefault()}>
            <Space>
              <Avatar
                style={{
                  backgroundColor: user ? "#11482a" : "#ccc",
                  cursor: "pointer",
                }}
                size="small"
              >
                {user ? getUserInitial() : <UserOutlined />}
              </Avatar>
            </Space>
          </a>
        </Dropdown>
      </div>

      {/* 烟雾背景元素 */}
      <div className="absolute inset-0 overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity duration-500">
        {/* 基础烟雾层 */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(0,30,15,0.4)_0%,_transparent_70%)] animate-smoke-1" />

        {/* 流动纹理层 */}
        <div className="absolute inset-0 bg-[linear-gradient(30deg,_transparent_45%,_rgba(0,255,200,0.05)_50%,_transparent_55%)] animate-smoke-2" />

        {/* 高光闪烁层 */}
        <div className="absolute inset-0 bg-[radial-gradient(circle,_rgba(255,255,255,0.03)_10%,_transparent_30%)] animate-twinkle" />
      </div>
    </header>
  );
};

export default Navbar;
