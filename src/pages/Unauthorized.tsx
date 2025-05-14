import React from "react";
import { Result, Button } from "antd";
import { useAuthStore } from "@/store/auth";
import { motion } from "framer-motion";
import AnimatedLink from "@/components/auth/AnimatedLink";
import AnimatedButton from "@/components/auth/AnimatedButton";

const Unauthorized: React.FC = () => {
  const { logout } = useAuthStore();

  // 动画配置
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.6,
        staggerChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5 },
    },
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[linear-gradient(-30deg,_#1a3a1a_20%,_#000_80%)]">
      <motion.div
        className="text-white/90 backdrop-blur-md bg-white/10 border border-gray-600/50 rounded-xl p-8 w-full max-w-md"
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        <motion.div variants={itemVariants}>
          <Result
            status="403"
            title={<span className="text-white/90 text-2xl">访问被拒绝</span>}
            subTitle={
              <span className="text-white/70">抱歉，您没有权限访问此页面</span>
            }
            className="p-0"
          />
        </motion.div>

        <motion.div
          className="flex justify-center mt-6 space-x-4"
          variants={itemVariants}
        >
          <AnimatedLink to="/" delay={0.4}>
            <Button type="primary" className="min-w-24">
              返回首页
            </Button>
          </AnimatedLink>

          <AnimatedButton
            onClick={logout}
            danger
            className="min-w-24"
            delay={0.6}
          >
            退出登录
          </AnimatedButton>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Unauthorized;
