import { create } from "zustand";
import { AuthState, LoginRequest, RegisterRequest, User } from "@/types/auth";
import * as authService from "@/services/auth";

interface AuthStore extends AuthState {
  // 登录
  login: (data: LoginRequest) => Promise<void>;
  // 注册
  register: (data: RegisterRequest) => Promise<void>;
  // 获取当前用户
  fetchCurrentUser: () => Promise<void>;
  // 登出
  logout: () => void;
  // 清除错误
  clearError: () => void;
  // 初始化
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  // 登录
  login: async (data: LoginRequest) => {
    set({ isLoading: true, error: null });
    try {
      await authService.login(data);
      await get().fetchCurrentUser();
    } catch (error: any) {
      set({
        error: error.response?.data?.detail || "登录失败，请检查用户名和密码",
        isAuthenticated: false,
        user: null,
        isLoading: false,
      });
    }
  },

  // 注册
  register: async (data: RegisterRequest) => {
    set({ isLoading: true, error: null });
    try {
      await authService.register(data);
      set({ isLoading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.detail || "注册失败，请稍后重试",
        isLoading: false,
      });
    }
  },

  // 获取当前用户
  fetchCurrentUser: async () => {
    if (!authService.isAuthenticated()) {
      set({ isAuthenticated: false, user: null });
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const user = await authService.getCurrentUser();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (error: any) {
      // 如果获取用户信息失败，可能是令牌无效
      authService.logout();
      set({
        error: error.response?.data?.detail || "会话已过期，请重新登录",
        isAuthenticated: false,
        user: null,
        isLoading: false,
      });
    }
  },

  // 登出
  logout: () => {
    authService.logout();
    set({ isAuthenticated: false, user: null });
  },

  // 清除错误
  clearError: () => {
    set({ error: null });
  },

  // 初始化
  initialize: async () => {
    try {
      if (authService.isAuthenticated()) {
        console.log("发现存储的令牌，尝试获取用户信息...");
        await get().fetchCurrentUser();
      } else {
        console.log("未找到存储的令牌，跳过认证初始化");
      }
    } catch (error) {
      console.error("认证初始化失败:", error);
      // 清理状态确保一致性
      authService.logout();
      set({ isAuthenticated: false, user: null, isLoading: false });
    }
  },
}));

// 在应用启动时初始化认证状态
export const initializeAuth = async () => {
  await useAuthStore.getState().initialize();
};
