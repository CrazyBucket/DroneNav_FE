import React, { ReactNode } from "react";
import { motion } from "framer-motion";

interface LinkContainerProps {
  children: ReactNode;
  className?: string;
  justify?: "center" | "between" | "start" | "end";
}

const LinkContainer: React.FC<LinkContainerProps> = ({
  children,
  className = "",
  justify = "center",
}) => {
  // 映射justify值到tailwind类
  const justifyClass = {
    center: "justify-center",
    between: "justify-between",
    start: "justify-start",
    end: "justify-end",
  }[justify];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{
        opacity: 1,
        transition: { delay: 0.7, duration: 0.4 },
      }}
      className={`flex ${justifyClass} ${className}`}
    >
      {children}
    </motion.div>
  );
};

export default LinkContainer;
