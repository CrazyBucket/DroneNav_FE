import React, { useEffect } from "react";
import { Form, Input } from "antd";
import { UserOutlined, LockOutlined } from "@ant-design/icons";
import { useAuthStore } from "@/store/auth";
import { LoginRequest } from "@/types/auth";
import { getOrCreateFingerprint } from "@/utils/fingerprint";

// 引入新组件
import AuthLayout from "@/components/auth/AuthLayout";
import AnimatedForm, { AnimatedFormItem } from "@/components/auth/AnimatedForm";
import AnimatedAlert from "@/components/auth/AnimatedAlert";
import AnimatedButton from "@/components/auth/AnimatedButton";
import FormDivider from "@/components/auth/FormDivider";
import AnimatedLink from "@/components/auth/AnimatedLink";
import LinkContainer from "@/components/auth/LinkContainer";

// 防止自动填充的CSS样式
const autofillOverrideStyles = {
  WebkitBoxShadow: "0 0 0 30px transparent inset !important",
  boxShadow: "0 0 0 30px transparent inset !important",
  WebkitTextFillColor: "#fff !important",
  caretColor: "#fff",
};

const Login: React.FC = () => {
  const { login, error, isLoading, clearError } = useAuthStore();

  // 生成设备指纹
  useEffect(() => {
    getOrCreateFingerprint();
  }, []);

  // 清除错误
  useEffect(() => {
    return () => {
      clearError();
    };
  }, [clearError]);

  // 提交表单
  const onFinish = (values: LoginRequest) => {
    login(values);
  };

  return (
    <AuthLayout title="Drone Nav" subtitle="Autonomous Skies Start Here.">
      <AnimatedAlert
        visible={!!error}
        type="error"
        message="登录失败"
        description={error}
        onClose={clearError}
      />

      <AnimatedForm
        name="login"
        initialValues={{ remember: true }}
        onFinish={onFinish}
        autoComplete="off"
        data-form-type="login"
      >
        {/* 添加隐藏的输入框分散浏览器注意力 */}
        <div style={{ display: "none" }}>
          <input type="text" name="fakeusernameremembered" />
          <input type="password" name="fakepasswordremembered" />
        </div>

        <AnimatedFormItem>
          <Form.Item
            name="username"
            rules={[{ required: true, message: "请输入用户名" }]}
          >
            <Input
              prefix={<UserOutlined className="text-white/50" />}
              placeholder="用户名"
              className="bg-white/10 border-gray-600/50 text-white"
              autoComplete="new-password"
              style={autofillOverrideStyles}
            />
          </Form.Item>
        </AnimatedFormItem>

        <AnimatedFormItem>
          <Form.Item
            name="password"
            rules={[{ required: true, message: "请输入密码" }]}
          >
            <Input.Password
              prefix={<LockOutlined className="text-white/50" />}
              placeholder="密码"
              className="bg-white/10 border-gray-600/50 text-white"
              autoComplete="new-password"
              style={autofillOverrideStyles}
            />
          </Form.Item>
        </AnimatedFormItem>

        <AnimatedFormItem>
          <Form.Item>
            <AnimatedButton
              type="primary"
              htmlType="submit"
              loading={isLoading}
              gradient="teal"
              glow={true}
              size="large"
              className="h-12 text-lg font-semibold tracking-wide"
            >
              登录
            </AnimatedButton>
          </Form.Item>
        </AnimatedFormItem>
      </AnimatedForm>

      <FormDivider text="或者" />

      <LinkContainer justify="between">
        <AnimatedLink to="/register" delay={0.8}>
          注册账号
        </AnimatedLink>
        <AnimatedLink to="/forgot-password" delay={0.9}>
          忘记密码？
        </AnimatedLink>
      </LinkContainer>
    </AuthLayout>
  );
};

export default Login;
