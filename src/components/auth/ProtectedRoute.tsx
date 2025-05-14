import React, { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { Spin } from "antd";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string;
}

/**
 * 受保护的路由组件
 * 如果用户未登录，则重定向到登录页面
 * 如果指定了requiredRole，则还会检查用户角色
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole,
}) => {
  const { isAuthenticated, user, isLoading, fetchCurrentUser } = useAuthStore();
  const location = useLocation();

  useEffect(() => {
    // 如果已登录但没有用户信息，则获取用户信息
    if (isAuthenticated && !user) {
      fetchCurrentUser();
    }
  }, [isAuthenticated, user, fetchCurrentUser]);

  // 如果正在加载，显示加载状态
  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Spin size="large" tip="正在加载用户信息..." />
      </div>
    );
  }

  // 如果未认证，重定向到登录页面
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 如果需要特定角色但用户没有该角色，重定向到无权限页面
  if (requiredRole && user?.role !== requiredRole) {
    return <Navigate to="/unauthorized" replace />;
  }

  // 通过所有检查，渲染子组件
  return <>{children}</>;
};

export default ProtectedRoute;
