import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/store/auth";

interface PublicRouteProps {
  children: React.ReactNode;
  restricted?: boolean;
}

/**
 * 公共路由组件
 * 如果用户已登录且路由被限制（如登录页面），则重定向到主页
 */
const PublicRoute: React.FC<PublicRouteProps> = ({
  children,
  restricted = false,
}) => {
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/";

  // 如果用户已登录且路由被限制，重定向到来源页面或主页
  if (isAuthenticated && restricted) {
    return <Navigate to={from} replace />;
  }

  // 否则渲染子组件
  return <>{children}</>;
};

export default PublicRoute;
