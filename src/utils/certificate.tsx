import {
  message,
  Modal,
  App,
  type MessageInstance,
  type ModalStaticFunctions,
} from "antd";
import { WS_BASE_URL } from "@/services/config";
import React, { useEffect } from "react";

// 全局App实例引用，用于解决antd上下文警告
let globalAppInstance: ReturnType<typeof App.useApp> | null = null;

/**
 * 设置全局App实例，解决Antd上下文警告
 */
export const setGlobalAppInstance = (
  appInstance: ReturnType<typeof App.useApp>
) => {
  globalAppInstance = appInstance;
};

// 安全消息接口
interface SafeMessageAPI {
  info: (content: string, duration?: number) => void;
  error: (content: string | React.ReactNode, duration?: number) => void;
  success: (content: string, duration?: number) => void;
  warning: (content: string, duration?: number) => void;
}

/**
 * 显示安全的消息提示
 */
const safeMessage: SafeMessageAPI = {
  info: (content: string, duration?: number) => {
    if (globalAppInstance) {
      globalAppInstance.message.info(content, duration);
    } else {
      message.info(content, duration);
    }
  },
  error: (content: string | React.ReactNode, duration?: number) => {
    if (globalAppInstance) {
      globalAppInstance.message.error(content, duration);
    } else {
      message.error(content, duration);
    }
  },
  success: (content: string, duration?: number) => {
    if (globalAppInstance) {
      globalAppInstance.message.success(content, duration);
    } else {
      message.success(content, duration);
    }
  },
  warning: (content: string, duration?: number) => {
    if (globalAppInstance) {
      globalAppInstance.message.warning(content, duration);
    } else {
      message.warning(content, duration);
    }
  },
};

/**
 * 安全的Modal调用
 */
const safeModal = {
  confirm: (options: Parameters<typeof Modal.confirm>[0]) => {
    if (globalAppInstance) {
      return globalAppInstance.modal.confirm(options);
    } else {
      return Modal.confirm(options);
    }
  },
};

/**
 * 检查WS安全证书，如果需要则显示接受证书的提示
 */
export const checkWSSCertificate = async (): Promise<boolean> => {
  try {
    // 尝试通过fetch请求访问WSS服务器对应的HTTPS地址
    const baseUrl = WS_BASE_URL.replace("wss://", "https://");

    // 添加超时处理
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const res = await fetch(baseUrl, {
        method: "HEAD",
        mode: "no-cors",
        signal: controller.signal,
        cache: "no-cache", // 防止缓存导致的证书检查不准确
      });

      clearTimeout(timeoutId);
      console.log("WSS证书检查成功:", res);
      return true;
    } catch (error) {
      clearTimeout(timeoutId);

      // 判断是否为证书错误
      const errorString = String(error);
      const isCertError =
        errorString.includes("certificate") ||
        errorString.includes("SSL") ||
        errorString.includes("安全连接") ||
        errorString.includes("安全证书");

      // 只在证书错误时显示证书模态框
      if (
        isCertError ||
        !(error instanceof DOMException && error.name === "AbortError")
      ) {
        console.warn("检测到可能的证书问题:", error);
        showCertificateModal();
      }
      throw error;
    }
  } catch (error) {
    console.error("WSS证书检查失败:", error);
    return false;
  }
};

/**
 * 显示证书接受引导对话框
 */
export const showCertificateModal = () => {
  const baseUrl = WS_BASE_URL.replace("wss://", "https://");

  safeModal.confirm({
    title: "WSS安全连接需要接受证书",
    content: (
      <div>
        <p>检测到WebSocket安全连接(WSS)证书未被接受。</p>
        <p>
          为了确保实时通信功能正常工作，请点击下方按钮在新窗口中打开服务地址，并接受安全证书：
        </p>
        <ol style={{ marginTop: "10px" }}>
          <li>在新打开的页面中，您可能会看到浏览器的安全警告</li>
          <li>点击"高级"或"详细信息"按钮</li>
          <li>点击"继续前往..."或"接受风险并继续"按钮</li>
          <li>接受证书后，关闭该窗口并返回此页面</li>
          <li>然后重新尝试您的操作</li>
        </ol>
      </div>
    ),
    okText: "打开安全页面",
    cancelText: "稍后处理",
    onOk: () => {
      window.open(baseUrl, "_blank");

      // 通知用户在新窗口中接受证书
      setTimeout(() => {
        safeMessage.info("请在新窗口中接受安全证书后回到此页面", 5);
      }, 1000);
    },
    okButtonProps: {
      type: "primary",
      danger: true,
    },
  });
};

/**
 * 连接WSS前的准备工作
 */
export const prepareForWSSConnection = async (): Promise<void> => {
  try {
    // 不抛出异常，直接返回结果
    const result = await checkWSSCertificate();
    if (result) {
      console.log("WSS证书检查完成");
    }
  } catch (error) {
    console.error("WSS证书准备失败:", error);
    // 这里不抛出异常，让调用者继续执行，因为证书问题会在WebSocket连接时再次处理
  }
};

/**
 * 用于包装组件的Hook，提供安全的消息API
 */
export const useSafeMessage = () => {
  return safeMessage;
};

/**
 * 应用AppProvider的包装组件
 */
export const AppProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return (
    <App>
      <AppProviderInner>{children}</AppProviderInner>
    </App>
  );
};

const AppProviderInner: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const app = App.useApp();

  useEffect(() => {
    setGlobalAppInstance(app);
    return () => {
      if (globalAppInstance === app) {
        globalAppInstance = null;
      }
    };
  }, [app]);

  return <>{children}</>;
};
