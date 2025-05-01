import React from "react";
import { Divider } from "antd";
import { SettingItem } from "@/types/settingItem";
import { SetTarget } from "./SetTarget";

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
  const operations: SettingItem[] = [
    {
      id: "target-coordinates",
      title: "目标坐标",
      description: "设置无人机目标位置",
      renderControl: () => <SetTarget />,
    },
  ];

  return (
    <div className="p-2 w-full">
      {operations.map((item, index) => (
        <div key={item.id}>
          <OperationCard {...item} />
          {index !== operations.length - 1 && (
            <Divider className="!my-3 !border-white/10" />
          )}
        </div>
      ))}
    </div>
  );
};

export default Operations;
