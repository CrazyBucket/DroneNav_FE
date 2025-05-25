import {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  User,
  PasswordResetRequest,
  PasswordResetConfirmRequest,
  RefreshTokenRequest,
  PasswordResetResponse,
} from "@/types/auth";
import axios from "axios";
import { BASE_URL } from "./config";
import { getOrCreateFingerprint } from "@/utils/fingerprint";

// 创建axios实例
const authApi = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// 请求拦截器，添加设备指纹
authApi.interceptors.request.use(config => {
  // 添加设备指纹
  const fingerprint = getOrCreateFingerprint();
  config.headers["X-Device-Fingerprint"] = fingerprint;

  // 添加令牌（如果存在）
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers["Authorization"] = `Bearer ${token}`;
  }

  return config;
});

/**
 * 用户登录
 */
export const login = async (data: LoginRequest): Promise<LoginResponse> => {
  // 使用FormData格式，符合OAuth2规范
  const formData = new FormData();
  formData.append("username", data.username);
  formData.append("password", data.password);

  const response = await authApi.post<LoginResponse>(
    "/api/auth/login",
    formData,
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );

  // 存储令牌
  localStorage.setItem("access_token", response.data.access_token);
  localStorage.setItem("refresh_token", response.data.refresh_token);

  return response.data;
};

/**
 * 用户注册
 */
export const register = async (data: RegisterRequest): Promise<User> => {
  const response = await authApi.post<User>("/api/auth/register", data);
  return response.data;
};

/**
 * 获取当前用户信息
 */
export const getCurrentUser = async (): Promise<User> => {
  const response = await authApi.get<User>("/api/auth/me");
  return response.data;
};

/**
 * 刷新访问令牌
 */
export const refreshToken = async (
  data: RefreshTokenRequest
): Promise<LoginResponse> => {
  try {
    console.log("尝试刷新令牌...");
    const response = await authApi.post<LoginResponse>(
      "/api/auth/refresh",
      data
    );

    // 更新存储的访问令牌
    console.log("刷新令牌成功");
    localStorage.setItem("access_token", response.data.access_token);

    return response.data;
  } catch (error) {
    console.error("刷新令牌失败:", error);
    // 清除所有令牌
    logout();
    throw error;
  }
};

/**
 * 请求密码重置
 */
export const requestPasswordReset = async (
  data: PasswordResetRequest
): Promise<PasswordResetResponse> => {
  const response = await authApi.post<PasswordResetResponse>(
    "/api/auth/password-reset/request",
    data
  );
  return response.data;
};

/**
 * 确认密码重置
 */
export const confirmPasswordReset = async (
  data: PasswordResetConfirmRequest
): Promise<{ message: string }> => {
  const response = await authApi.post<{ message: string }>(
    "/api/auth/password-reset/confirm",
    data
  );
  return response.data;
};

/**
 * 登出
 */
export const logout = (): void => {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
};

/**
 * 检查是否已登录
 */
export const isAuthenticated = (): boolean => {
  return !!localStorage.getItem("access_token");
};

// 创建响应拦截器，处理令牌过期
authApi.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;

    // 如果是401错误且未尝试过刷新令牌且不是刷新令牌请求本身
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      originalRequest.url !== "/api/auth/refresh"
    ) {
      originalRequest._retry = true;

      try {
        const refreshTokenValue = localStorage.getItem("refresh_token");
        if (!refreshTokenValue) {
          // 如果没有刷新令牌，则直接登出
          logout();
          return Promise.reject(error);
        }

        // 尝试刷新令牌
        const response = await refreshToken({
          refresh_token: refreshTokenValue,
        });

        // 更新原始请求的授权头
        originalRequest.headers[
          "Authorization"
        ] = `Bearer ${response.access_token}`;

        // 重新发送原始请求
        return authApi(originalRequest);
      } catch (refreshError) {
        // 刷新令牌失败，清除所有令牌
        console.error("刷新令牌失败，正在登出", refreshError);
        logout();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default authApi;
