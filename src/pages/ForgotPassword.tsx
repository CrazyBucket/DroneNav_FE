import React, { useState } from "react";
import { Form, Input, Button } from "antd";
import { MailOutlined, SafetyCertificateOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
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
  const [verificationCode, setVerificationCode] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [step, setStep] = useState<"email" | "verify">("email");
  const [tempToken, setTempToken] = useState<string | null>(null);
  const [form] = Form.useForm();
  const navigate = useNavigate();

  // 开始倒计时
  const startCountdown = () => {
    setCountdown(60);
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // 发送验证码
  const sendVerificationCode = async () => {
    try {
      await form.validateFields(["email"]);
      const email = form.getFieldValue("email");

      setIsLoading(true);

      // 调用后端API请求验证码
      const response = await requestPasswordReset({ email });

      if (!response.exists) {
        throw new Error("该邮箱未注册");
      }

      // 存储临时令牌
      if (!response.temp_token) {
        throw new Error("获取验证码失败，请稍后重试");
      }
      setTempToken(response.temp_token);

      // 显示验证码（仅测试环境）
      const codeMatch = response.message.match(/验证码：(\d+)/);
      if (codeMatch && codeMatch[1]) {
        setVerificationCode(codeMatch[1]);
      }

      // 开始倒计时
      startCountdown();

      // 切换到验证步骤
      setStep("verify");
    } catch (err: any) {
      if (err.errorFields) {
        // 表单验证错误
        return;
      }
      setError(
        err.message ||
          err.response?.data?.detail ||
          "发送验证码失败，请稍后重试"
      );
      // 如果是邮箱不存在的错误，重置表单
      if (err.message === "该邮箱未注册") {
        form.setFields([
          {
            name: "email",
            errors: ["该邮箱未注册"],
          },
        ]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 处理表单提交
  const handleSubmit = async (values: any) => {
    if (step === "email") {
      // 如果是邮箱步骤，阻止表单提交，改为发送验证码
      await sendVerificationCode();
      return;
    }

    try {
      setIsLoading(true);

      if (!tempToken) {
        throw new Error("验证会话已过期，请重新开始密码重置流程");
      }

      // 验证成功后跳转到重置密码页面，并传递临时令牌和验证码
      navigate("/reset-password", {
        replace: true,
        state: {
          tempToken,
          verificationCode: values.verification_code,
          email: form.getFieldValue("email"),
        },
      });
    } catch (err: any) {
      setError(err.message || "验证失败，请重试");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      title="重置密码"
      subtitle={
        step === "email" ? "请输入您的电子邮箱以获取验证码" : "请输入验证码"
      }
    >
      <AnimatedAlert
        visible={!!error}
        type="error"
        message="操作失败"
        description={error}
        onClose={() => setError(null)}
      />

      {verificationCode && step === "verify" && (
        <AnimatedAlert
          visible={true}
          type="info"
          message="验证码已发送"
          description={`您的验证码是: ${verificationCode}（仅测试环境使用，实际场景下会发送到邮箱）`}
        />
      )}

      <AnimatedForm form={form} name="forgot-password" onFinish={handleSubmit}>
        {step === "email" && (
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
                onPressEnter={e => {
                  e.preventDefault();
                  if (step === "email") {
                    sendVerificationCode();
                  }
                }}
              />
            </Form.Item>
          </AnimatedFormItem>
        )}

        {step === "verify" && (
          <AnimatedFormItem>
            <Form.Item
              name="verification_code"
              rules={[
                { required: true, message: "请输入验证码" },
                { len: 6, message: "验证码必须是6位数字" },
                { pattern: /^\d+$/, message: "验证码只能包含数字" },
              ]}
            >
              <div className="flex">
                <Input
                  prefix={
                    <SafetyCertificateOutlined className="text-white/50" />
                  }
                  placeholder="验证码"
                  className="bg-white/10 border-gray-600/50 text-white flex-1"
                  onPressEnter={e => {
                    e.preventDefault();
                    form.submit();
                  }}
                />
                <Button
                  type="link"
                  disabled={countdown > 0}
                  onClick={(e: React.MouseEvent) => {
                    e.preventDefault();
                    e.stopPropagation();
                    sendVerificationCode();
                  }}
                  className="text-white/50 hover:text-white ml-2 min-w-[120px]"
                >
                  {countdown > 0 ? `${countdown}秒后重新发送` : "重新发送"}
                </Button>
              </div>
            </Form.Item>
          </AnimatedFormItem>
        )}

        <AnimatedFormItem>
          <Form.Item>
            <AnimatedButton
              type="primary"
              htmlType="submit"
              loading={isLoading}
            >
              {step === "email" ? "获取验证码" : "验证并继续"}
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
