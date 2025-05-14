import React, { useEffect, useState } from "react";
import { Form, Input } from "antd";
import { UserOutlined, MailOutlined, LockOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { RegisterRequest } from "@/types/auth";
import { getOrCreateFingerprint } from "@/utils/fingerprint";

// 引入新组件
import AuthLayout from "@/components/auth/AuthLayout";
import AnimatedForm, { AnimatedFormItem } from "@/components/auth/AnimatedForm";
import AnimatedAlert from "@/components/auth/AnimatedAlert";
import AnimatedButton from "@/components/auth/AnimatedButton";
import FormDivider from "@/components/auth/FormDivider";
import AnimatedLink from "@/components/auth/AnimatedLink";
import PasswordStrengthMeter from "@/components/auth/PasswordStrengthMeter";

// 防止自动填充的CSS样式
const autofillOverrideStyles = {
  WebkitBoxShadow: "0 0 0 30px transparent inset !important",
  boxShadow: "0 0 0 30px transparent inset !important",
  WebkitTextFillColor: "#fff !important",
  caretColor: "#fff",
};

const Register: React.FC = () => {
  const { register, error, isLoading, clearError } = useAuthStore();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [registerSuccess, setRegisterSuccess] = useState(false);

  // 表单中的密码值
  const password = Form.useWatch("password", form);

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
  const onFinish = async (values: RegisterRequest) => {
    try {
      await register(values);
      setRegisterSuccess(true);
      setTimeout(() => {
        navigate("/login");
      }, 2000);
    } catch (err) {
      // 错误已在store中处理
    }
  };

  return (
    <AuthLayout title="注册账号" subtitle="加入DroneNav无人机导航系统">
      <AnimatedAlert
        visible={!!error}
        type="error"
        message="注册失败"
        description={error}
        onClose={clearError}
      />

      <AnimatedAlert
        visible={registerSuccess}
        type="success"
        message="注册成功"
        description="账号已创建，正在跳转到登录页面..."
      />

      <AnimatedForm
        form={form}
        name="register"
        onFinish={onFinish}
        disabled={registerSuccess}
        autoComplete="off"
        data-form-type="register"
      >
        {/* 添加隐藏的输入框分散浏览器注意力 */}
        <div style={{ display: "none" }}>
          <input type="text" name="fakeusernameremembered" />
          <input type="password" name="fakepasswordremembered" />
        </div>

        <AnimatedFormItem>
          <Form.Item
            name="username"
            rules={[
              { required: true, message: "请输入用户名" },
              { min: 3, message: "用户名至少3个字符" },
              { max: 20, message: "用户名最多20个字符" },
            ]}
          >
            <Input
              prefix={<UserOutlined className="text-white/50" />}
              placeholder="用户名"
              className="bg-white/10 border-gray-600/50 text-white"
              autoComplete="off"
              style={autofillOverrideStyles}
            />
          </Form.Item>
        </AnimatedFormItem>

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
              autoComplete="off"
              style={autofillOverrideStyles}
            />
          </Form.Item>
        </AnimatedFormItem>

        <AnimatedFormItem>
          <Form.Item
            name="password"
            rules={[
              { required: true, message: "请输入密码" },
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
              placeholder="密码"
              className="bg-white/10 border-gray-600/50 text-white"
              autoComplete="new-password"
              style={autofillOverrideStyles}
            />
          </Form.Item>
        </AnimatedFormItem>

        {/* 密码强度指示器 */}
        <PasswordStrengthMeter password={password || ""} visible={!!password} />

        <AnimatedFormItem>
          <Form.Item
            name="confirmPassword"
            dependencies={["password"]}
            rules={[
              { required: true, message: "请确认密码" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("password") === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error("两次输入的密码不一致"));
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined className="text-white/50" />}
              placeholder="确认密码"
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
              disabled={registerSuccess}
              gradient="teal"
              glow={true}
              size="large"
              className="h-12 text-lg font-semibold tracking-wide"
            >
              注册
            </AnimatedButton>
          </Form.Item>
        </AnimatedFormItem>
      </AnimatedForm>

      <FormDivider text="已有账号？" />

      <AnimatedLink
        to="/login"
        delay={0.9}
        className="block text-center text-green-400 hover:text-green-300"
      >
        返回登录
      </AnimatedLink>
    </AuthLayout>
  );
};

export default Register;
