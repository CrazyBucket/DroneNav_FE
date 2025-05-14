import React from "react";
import { motion } from "framer-motion";

interface FormDividerProps {
  text: string;
}

const FormDivider: React.FC<FormDividerProps> = ({ text }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.8, duration: 0.5 }}
    >
      <div className="border-gray-600/50 w-full flex items-center justify-center py-1">
        <div className="w-full h-[1px] bg-gray-600/50"></div>
        <span className="text-white/50 whitespace-nowrap px-2">{text}</span>
        <div className="w-full h-[1px] bg-gray-600/50"></div>
      </div>
    </motion.div>
  );
};

export default FormDivider;
