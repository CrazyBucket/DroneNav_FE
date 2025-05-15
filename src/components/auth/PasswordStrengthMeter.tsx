import React from "react";
import { Progress, Typography } from "antd";
import { motion } from "framer-motion";
import { passwordRules } from "@/types/auth";

const { Text } = Typography;

interface PasswordStrengthMeterProps {
  password: string;
  visible: boolean;
}

const PasswordStrengthMeter: React.FC<PasswordStrengthMeterProps> = ({
  password,
  visible,
}) => {
  // 计算密码强度
  const { strength } = React.useMemo(() => {
    if (!password) {
      return { strength: 0 };
    }

    let strength = 0;

    // 检查长度
    if (password.length >= passwordRules.minLength) {
      strength += 25;
    }

    // 检查大写字母
    if (passwordRules.requireUppercase && /[A-Z]/.test(password)) {
      strength += 25;
    }

    // 检查小写字母
    if (passwordRules.requireLowercase && /[a-z]/.test(password)) {
      strength += 25;
    }

    // 检查数字和特殊字符
    if (passwordRules.requireNumber && /[0-9]/.test(password)) {
      strength += 12.5;
    }

    if (passwordRules.requireSpecialChar && /[^A-Za-z0-9]/.test(password)) {
      strength += 12.5;
    }

    return { strength };
  }, [password]);

  // 获取密码强度颜色
  const getStrengthColor = () => {
    if (strength < 50) return "#ff4d4f";
    if (strength < 75) return "#faad14";
    return "#52c41a";
  };

  // 获取密码强度文本
  const getStrengthText = () => {
    if (strength < 50) return "弱";
    if (strength < 75) return "中";
    return "强";
  };

  if (!visible) return null;

  return (
    <motion.div
      className="mb-4"
      initial={{ opacity: 0, height: 0 }}
      animate={{
        opacity: 1,
        height: "auto",
        transition: { duration: 0.3 },
      }}
    >
      <div className="flex justify-between mb-1">
        <Text className="text-white/70">密码强度: {getStrengthText()}</Text>
      </div>
      <Progress
        percent={strength}
        showInfo={false}
        strokeColor={getStrengthColor()}
        size="small"
        className="password-strength-progress"
      />
    </motion.div>
  );
};

export default PasswordStrengthMeter;
