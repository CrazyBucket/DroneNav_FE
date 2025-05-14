import React, { useState } from "react";
import { Form, Input } from "antd";
import { MailOutlined } from "@ant-design/icons";
import { PasswordResetRequest } from "@/types/auth";
import { requestPasswordReset } from "@/services/auth";

// 引入新组件
import AuthLayout from "@/components/auth/AuthLayout";
import AnimatedForm, { AnimatedFormItem } from "@/components/auth/AnimatedForm";
import AnimatedAlert from "@/components/auth/AnimatedAlert";
import AnimatedButton from "@/components/auth/AnimatedButton";
import FormDivider from "@/components/auth/FormDivider";
import AnimatedLink from "@/components/auth/AnimatedLink";
import LinkContainer from "@/components/auth/LinkContainer";

const ForgotPassword: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(null);

  // 提交表单
  const onFinish = async (values: PasswordResetRequest) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await requestPasswordReset(values);
      setSuccess(true);

      // 仅在开发环境中显示重置令牌（实际生产环境中不应该这样做）
      if (response.reset_token) {
        setResetToken(response.reset_token);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || "发送重置邮件失败，请稍后重试");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      title="重置密码"
      subtitle="请输入您的电子邮箱，我们将发送重置密码的链接"
    >
      <AnimatedAlert
        visible={!!error}
        type="error"
        message="操作失败"
        description={error}
        onClose={() => setError(null)}
      />

      <AnimatedAlert
        visible={success}
        type="success"
        message="邮件已发送"
        description="如果该邮箱存在，重置链接将发送到您的邮箱"
      />

      <AnimatedAlert
        visible={!!resetToken}
        type="info"
        message="开发模式"
        description={`重置令牌: ${resetToken}`}
      />

      <AnimatedForm
        name="forgot-password"
        onFinish={onFinish}
        disabled={success}
      >
        <AnimatedFormItem>
          <Form.Item
            name="email"
            rules={[
              { required: true, message: "请输入电子邮箱" },
              { type: "email", message: "请输入有效的电子邮箱" },
            ]}
          >
            <Input
              prefix={<MailOutlined className="text-white/50" />}
              placeholder="电子邮箱"
              className="bg-white/10 border-gray-600/50 text-white"
            />
          </Form.Item>
        </AnimatedFormItem>

        <AnimatedFormItem>
          <Form.Item>
            <AnimatedButton
              type="primary"
              htmlType="submit"
              loading={isLoading}
              disabled={success}
            >
              发送重置链接
            </AnimatedButton>
          </Form.Item>
        </AnimatedFormItem>
      </AnimatedForm>

      <FormDivider text="或者" />

      <LinkContainer justify="center" className="space-x-4">
        <AnimatedLink to="/login" delay={0.8}>
          返回登录
        </AnimatedLink>
        <AnimatedLink to="/register" delay={0.9}>
          注册账号
        </AnimatedLink>
      </LinkContainer>
    </AuthLayout>
  );
};

export default ForgotPassword;
