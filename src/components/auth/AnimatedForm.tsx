import React, { ReactNode } from "react";
import { Form, FormInstance, FormProps } from "antd";
import { motion } from "framer-motion";

interface AnimatedFormProps extends FormProps {
  children: ReactNode;
  form?: FormInstance;
  onFinish: (values: any) => void;
  disabled?: boolean;
  autoComplete?: string;
}

const AnimatedForm: React.FC<AnimatedFormProps> = ({
  children,
  form,
  onFinish,
  disabled = false,
  autoComplete = "off",
  ...rest
}) => {
  // 表单动画配置
  const formVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  return (
    <motion.div variants={formVariants} initial="hidden" animate="visible">
      <Form
        form={form}
        onFinish={onFinish}
        layout="vertical"
        size="large"
        disabled={disabled}
        autoComplete={autoComplete}
        {...rest}
      >
        {children}
      </Form>
    </motion.div>
  );
};

// 表单项动画配置
export const formItemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3 },
  },
};

// 用于包装表单项的组件
export const AnimatedFormItem: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  return <motion.div variants={formItemVariants}>{children}</motion.div>;
};

export default AnimatedForm;
