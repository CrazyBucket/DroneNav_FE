import React, { ReactNode } from "react";
import { Card, Typography } from "antd";
import { motion } from "framer-motion";
import { SafetyOutlined } from "@ant-design/icons";
import BlurText from "../Animation/BlurText";
import Aurora from "../Animation/Aurora";

const { Title } = Typography;

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  maxWidth?: string;
  showSecurityInfo?: boolean;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({
  children,
  title,
  subtitle,
  maxWidth = "md",
  showSecurityInfo = true,
}) => {
  // 卡片出现动画
  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: "easeOut",
      },
    },
  };

  // 标题动画
  const titleVariants = {
    hidden: { opacity: 0, y: -10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        delay: 0.3,
        ease: "easeOut",
      },
    },
  };

  // 子元素动画 (内容依次出现)
  const childVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.5,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.3 },
    },
  };

  // 计算最大宽度
  const getMaxWidth = () => {
    switch (maxWidth) {
      case "sm":
        return "max-w-sm";
      case "md":
        return "max-w-md";
      case "lg":
        return "max-w-lg";
      case "xl":
        return "max-w-xl";
      default:
        return maxWidth.startsWith("max-w-") ? maxWidth : `max-w-${maxWidth}`;
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center bg-black">
      <div className="absolute inset-0 z-0">
        <Aurora
          colorStops={["#00a3e0", "#37d67a", "#2274a5"]}
          blend={0.7}
          amplitude={1.2}
          speed={0.3}
        />
      </div>

      <motion.div
        initial="hidden"
        animate="visible"
        variants={cardVariants}
        className={`w-full ${getMaxWidth()} relative z-10`}
        style={{ padding: "0px" }}
      >
        <Card className="shadow-xl backdrop-blur-md bg-black/30 border border-teal-600/30 hover:border-teal-400/40 transition-colors duration-300 rounded-2xl px-6">
          <motion.div variants={titleVariants} className="text-left mb-4">
            <Title level={2} className="text-white/90 !mb-0">
              <BlurText
                text={title}
                delay={150}
                animateBy="words"
                className="!mb-0"
              />
            </Title>
            {subtitle && (
              <BlurText
                text={subtitle}
                delay={200}
                animateBy="words"
                className="text-white/70 mt-2"
              />
            )}
          </motion.div>

          <motion.div
            variants={childVariants}
            initial="hidden"
            animate="visible"
            className="space-y-5 w-full"
          >
            {React.Children.map(children, child => (
              <motion.div variants={itemVariants} className="mb-2 w-full">
                {child}
              </motion.div>
            ))}
          </motion.div>

          {showSecurityInfo && (
            <motion.div
              variants={itemVariants}
              className="mt-8 flex items-center justify-center"
            >
              <span className="text-white/50 flex items-center">
                <SafetyOutlined className="mr-1" />
                安全连接 | 设备指纹已启用
              </span>
            </motion.div>
          )}
        </Card>
      </motion.div>
    </div>
  );
};

export default AuthLayout;
