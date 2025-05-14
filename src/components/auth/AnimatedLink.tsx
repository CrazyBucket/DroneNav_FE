import React, { ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

interface AnimatedLinkProps {
  to: string;
  children: ReactNode;
  className?: string;
  delay?: number;
}

const AnimatedLink: React.FC<AnimatedLinkProps> = ({
  to,
  children,
  className = "text-green-400 hover:text-green-300",
  delay = 0,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{
        opacity: 1,
        y: 0,
        transition: { delay, duration: 0.3 },
      }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className="inline-block"
    >
      <Link to={to} className={className}>
        {children}
      </Link>
    </motion.div>
  );
};

export default AnimatedLink;
