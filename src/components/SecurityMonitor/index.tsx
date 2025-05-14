import React, { useEffect, useState } from "react";
import { Card, Typography, List, Badge, Tag, Tooltip, Divider } from "antd";
import {
  WarningOutlined,
  SafetyOutlined,
  LockOutlined,
  SecurityScanOutlined,
} from "@ant-design/icons";
import { getSecurityStats, loadSecurityStats } from "@/utils/security";

const { Text, Paragraph } = Typography;

const SecurityMonitor: React.FC = () => {
  const [stats, setStats] = useState(getSecurityStats());
  const [lastUpdated, setLastUpdated] = useState<string>(
    new Date().toLocaleTimeString()
  );

  useEffect(() => {
    // 加载保存的安全统计
    loadSecurityStats();
    setStats(getSecurityStats());

    // 定期更新安全统计
    const interval = setInterval(() => {
      setStats(getSecurityStats());
      setLastUpdated(new Date().toLocaleTimeString());
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // 计算安全等级
  const getSecurityLevel = () => {
    if (stats.xssAttempts > 0 || stats.csrfAttempts > 0) {
      return {
        level: "警告",
        color: "orange",
        icon: <WarningOutlined />,
      };
    }
    return {
      level: "安全",
      color: "green",
      icon: <SafetyOutlined />,
    };
  };

  const securityLevel = getSecurityLevel();

  return (
    <Card className="security-monitor shadow-md m-2" size="small">
      <div className="mb-3">
        <Badge
          status={securityLevel.color as any}
          text={
            <Text strong>
              当前安全状态: {securityLevel.level}
              <Tag color={securityLevel.color} className="ml-2">
                {securityLevel.icon}
              </Tag>
            </Text>
          }
        />
      </div>

      <List
        size="small"
        bordered
        dataSource={[
          { label: "XSS攻击拦截", value: stats.xssAttempts },
          { label: "CSRF攻击拦截", value: stats.csrfAttempts },
          {
            label: "最近攻击时间",
            value: stats.lastAttemptTime
              ? new Date(stats.lastAttemptTime).toLocaleString()
              : "无",
          },
        ]}
        renderItem={item => (
          <List.Item>
            <div className="flex justify-between w-full">
              <Text>{item.label}</Text>
              <Text strong>{item.value}</Text>
            </div>
          </List.Item>
        )}
      />

      <Divider className="my-2" />

      <div className="mb-2">
        <Tooltip title="本应用使用AES加密算法保护敏感数据">
          <div className="flex items-center text-xs text-gray-300">
            <LockOutlined className="ml-3 mr-1" />
            <Text className="text-xs text-gray-300">
              token存储加密:
              <Tag color="green" className="ml-1">
                已启用
              </Tag>
            </Text>
          </div>
        </Tooltip>
      </div>

      <div className="mt-2 text-right text-xs text-gray-400">
        最后更新: {lastUpdated}
      </div>
    </Card>
  );
};

export default SecurityMonitor;
