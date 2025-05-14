import React, { ReactNode } from "react";
import { Button, ButtonProps } from "antd";
import { motion } from "framer-motion";
import "./buttonOverride.css";

interface AnimatedButtonProps extends ButtonProps {
  children: ReactNode;
  fullWidth?: boolean;
  delay?: number;
  gradient?: "blue" | "green" | "teal" | "purple" | "custom";
  customGradient?: string;
  glow?: boolean;
}

const AnimatedButton: React.FC<AnimatedButtonProps> = ({
  children,
  fullWidth = true,
  delay = 0.6,
  gradient = "teal",
  customGradient,
  glow = true,
  className = "",
  type = "default",
  htmlType,
  loading,
  disabled,
  onClick,
  ...props
}) => {
  // 渐变预设
  const gradients = {
    blue: "from-blue-400 to-blue-600",
    green: "from-green-400 to-green-600",
    teal: "from-teal-400 to-cyan-600",
    purple: "from-purple-400 to-indigo-600",
    custom: customGradient || "from-blue-400 to-purple-600",
  };

  // 选择渐变
  const selectedGradient = gradients[gradient];

  // 发光效果
  const glowEffect = glow ? `shadow-[0_4px_14px_rgba(0,180,216,0.35)]` : "";

  // 禁用样式
  const disabledStyle = disabled
    ? "opacity-50 grayscale-[30%] cursor-not-allowed"
    : "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{
        opacity: 1,
        y: 0,
        transition: { delay, duration: 0.4 },
      }}
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      className={`${fullWidth ? "w-full" : ""} ${disabledStyle}`}
    >
      <div
        className={`relative rounded-lg overflow-hidden ${glowEffect} ${
          fullWidth ? "w-full" : ""
        }`}
      >
        {/* 渐变背景层 - 永远可见 */}
        <div
          className={`absolute inset-0 bg-gradient-to-r ${selectedGradient}`}
        ></div>

        {/* 悬停叠加层 - 悬停时出现 */}
        <div className="absolute inset-0 opacity-0 hover:opacity-100 bg-black/10 transition-opacity duration-300 z-[1]"></div>

        {/* 实际按钮，背景透明以显示下面的渐变 */}
        <Button
          type={type}
          htmlType={htmlType}
          loading={loading}
          disabled={disabled}
          onClick={onClick}
          className={`
            relative z-[2] border-0 bg-transparent
            text-white font-medium px-4 py-2
            w-full h-full ${className}
          `}
          style={{ boxShadow: "none" }}
          {...props}
        >
          {children}
        </Button>
      </div>
    </motion.div>
  );
};

export default AnimatedButton;
