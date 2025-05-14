import React from "react";
import { Alert, AlertProps } from "antd";
import { motion, AnimatePresence } from "framer-motion";

interface AnimatedAlertProps extends AlertProps {
  visible: boolean;
  onClose?: () => void;
}

const AnimatedAlert: React.FC<AnimatedAlertProps> = ({
  visible,
  onClose,
  ...props
}) => {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, height: 0, marginBottom: 0 }}
          animate={{
            opacity: 1,
            height: "auto",
            marginBottom: 16,
            transition: { duration: 0.3 },
          }}
          exit={{
            opacity: 0,
            height: 0,
            marginBottom: 0,
            transition: { duration: 0.2 },
          }}
        >
          <Alert
            showIcon
            closable={!!onClose}
            onClose={onClose}
            className="mb-0"
            {...props}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AnimatedAlert;
