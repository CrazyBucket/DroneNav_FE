import { ConfigProvider, theme } from "antd";
import "./index.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import { initializeAuth } from "./store/auth";
import {
  AppProvider,
  prepareForWSSConnection,
  useSafeMessage,
} from "./utils/certificate";
import { DroneProvider } from "./core/DroneContext";
import StatsMonitor from "./components/StatsMonitor";

// 页面组件
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Unauthorized from "./pages/Unauthorized";

// 路由守卫
import ProtectedRoute from "./components/auth/ProtectedRoute";
import PublicRoute from "./components/auth/PublicRoute";

function App() {
  // 获取安全消息API
  const safeMessage = useSafeMessage();

  // 初始化认证状态
  useEffect(() => {
    const init = async () => {
      console.log("正在初始化应用状态...");
      try {
        await initializeAuth();
        console.log("认证状态初始化完成");

        // 检查WSS证书状态，预先解决可能的证书问题
        setTimeout(async () => {
          try {
            console.log("正在检查WSS证书状态...");
            await prepareForWSSConnection();
            console.log("WSS证书检查完成");
          } catch (error) {
            console.warn("WSS证书检查失败，但不阻止应用继续运行:", error);
          }
        }, 2000); // 延迟检查，避免阻塞主要初始化流程
      } catch (error) {
        console.error("认证初始化失败:", error);
        // 清理可能的无效令牌
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
      }
    };
    init();
  }, []);

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: "#11482a",
          colorBgContainer: "#1A2F1A",
          colorBorder: "#2D4A2D",
          colorText: "#E5FFE5",
          colorTextBase: "#E5FFE5",
        },
        components: {
          InputNumber: {
            colorBgContainer: "#1A2F1A",
            colorBorder: "#2D4A2D",
            hoverBorderColor: "#3CB371",
            activeBorderColor: "#4DD18D",
          },
        },
      }}
    >
      <AppProvider>
        <DroneProvider>
          <BrowserRouter>
            <Routes>
              {/* 受保护的路由 */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Home />
                  </ProtectedRoute>
                }
              />

              {/* 公共路由 */}
              <Route
                path="/login"
                element={
                  <PublicRoute restricted>
                    <Login />
                  </PublicRoute>
                }
              />
              <Route
                path="/register"
                element={
                  <PublicRoute restricted>
                    <Register />
                  </PublicRoute>
                }
              />
              <Route
                path="/forgot-password"
                element={
                  <PublicRoute restricted>
                    <ForgotPassword />
                  </PublicRoute>
                }
              />
              <Route
                path="/reset-password"
                element={
                  <PublicRoute restricted>
                    <ResetPassword />
                  </PublicRoute>
                }
              />

              {/* 特殊路由 */}
              <Route path="/unauthorized" element={<Unauthorized />} />

              {/* 未匹配路由重定向到首页 */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            {/* 全局性能监控组件 */}
            <div className="absolute bottom-0 right-0">
              <StatsMonitor />
            </div>
          </BrowserRouter>
        </DroneProvider>
      </AppProvider>
    </ConfigProvider>
  );
}

export default App;
