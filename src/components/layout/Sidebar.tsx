import React from "react";

const Sidebar = () => (
  <aside className="bg-white border-r border-gray-200 p-4">
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">操作面板</h2>
      <button className="w-full bg-gray-100 p-2 rounded hover:bg-gray-200 transition-colors">
        添加新视图
      </button>
    </div>
  </aside>
);

export default Sidebar;
