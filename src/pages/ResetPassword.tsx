import React, { useState, useEffect } from "react";
import { Form, Input } from "antd";
import { LockOutlined } from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import { PasswordResetConfirmRequest } from "@/types/auth";
import { confirmPasswordReset } from "@/services/auth";

// 引入新组件
import AuthLayout from "@/components/auth/AuthLayout";
import AnimatedForm, { AnimatedFormItem } from "@/components/auth/AnimatedForm";
import AnimatedAlert from "@/components/auth/AnimatedAlert";
import AnimatedButton from "@/components/auth/AnimatedButton";
import FormDivider from "@/components/auth/FormDivider";
import AnimatedLink from "@/components/auth/AnimatedLink";
import PasswordStrengthMeter from "@/components/auth/PasswordStrengthMeter";

const ResetPassword: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // 表单中的密码值
  const password = Form.useWatch("new_password", form);

  // 检查是否有令牌
  useEffect(() => {
    if (!token) {
      setError("无效的密码重置链接");
    }
  }, [token]);

  // 提交表单
  const onFinish = async (values: {
    new_password: string;
    confirm_password: string;
  }) => {
    if (!token) {
      setError("无效的密码重置链接");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const request: PasswordResetConfirmRequest = {
        token,
        new_password: values.new_password,
      };

      await confirmPasswordReset(request);
      setSuccess(true);

      // 重置成功后3秒跳转到登录页
      setTimeout(() => {
        navigate("/login");
      }, 3000);
    } catch (err: any) {
      setError(err.response?.data?.detail || "密码重置失败，请稍后重试");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout title="设置新密码" subtitle="请输入您的新密码">
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
        message="密码已重置"
        description="您的密码已成功重置，即将跳转到登录页面..."
      />

      <AnimatedForm
        form={form}
        name="reset-password"
        onFinish={onFinish}
        disabled={success || !token}
      >
        <AnimatedFormItem>
          <Form.Item
            name="new_password"
            rules={[
              { required: true, message: "请输入新密码" },
              { min: 8, message: "密码至少8个字符" },
              { pattern: /[A-Z]/, message: "密码必须包含至少一个大写字母" },
              { pattern: /[a-z]/, message: "密码必须包含至少一个小写字母" },
              { pattern: /[0-9]/, message: "密码必须包含至少一个数字" },
              {
                pattern: /[^A-Za-z0-9]/,
                message: "密码必须包含至少一个特殊字符",
              },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined className="text-white/50" />}
              placeholder="新密码"
              className="bg-white/10 border-gray-600/50 text-white"
            />
          </Form.Item>
        </AnimatedFormItem>

        {/* 密码强度指示器 */}
        <PasswordStrengthMeter password={password || ""} visible={!!password} />

        <AnimatedFormItem>
          <Form.Item
            name="confirm_password"
            dependencies={["new_password"]}
            rules={[
              { required: true, message: "请确认新密码" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("new_password") === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error("两次输入的密码不一致"));
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined className="text-white/50" />}
              placeholder="确认新密码"
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
              disabled={success || !token}
            >
              重置密码
            </AnimatedButton>
          </Form.Item>
        </AnimatedFormItem>
      </AnimatedForm>

      <FormDivider text="或者" />

      <AnimatedLink
        to="/login"
        delay={0.8}
        className="block text-center text-green-400 hover:text-green-300"
      >
        返回登录
      </AnimatedLink>
    </AuthLayout>
  );
};

export default ResetPassword;
