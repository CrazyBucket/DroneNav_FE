import React from "react";
import { Menu, Button } from "antd";
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PlusOutlined,
  AppstoreOutlined,
} from "@ant-design/icons";

interface SidebarProps {
  collapsed: boolean;
  onCollapse: (collapsed: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ collapsed, onCollapse }) => {
  return (
    <aside className="h-full bg-white border-r border-gray-200 flex flex-col">
      <div className="flex justify-between items-center border-b border-gray-200">
        <div className={`pl-4 ${collapsed ? "hidden" : "block"}`}>操作面板</div>
        <Button
          type="text"
          onClick={() => onCollapse(!collapsed)}
          className="flex items-center justify-center w-[48px] h-[48px]"
        >
          {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
        </Button>
      </div>

      <Menu
        mode="inline"
        inlineCollapsed={collapsed}
        style={{ width: collapsed ? 48 : undefined }}
        className="flex-1"
        items={[
          {
            key: "addView",
            icon: <PlusOutlined />,
            label: "添加新视图",
          },
          {
            key: "viewList",
            icon: <AppstoreOutlined />,
            label: "视图列表",
            children: [
              {
                key: "view1",
                label: "视图 1",
              },
              {
                key: "view2",
                label: "视图 2",
              },
            ],
          },
        ]}
      />
    </aside>
  );
};

export default Sidebar;
